import { Injectable, inject, signal } from '@angular/core';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { MixpanelService } from './mixpanel';
import { HomeFilter, FilterDay, FilterGuests, FilterSort, SEED_PRESETS } from '../models/home-filter.interface';
import { ReservationInterface } from '../models/reservation.interface';
import { autoFilterName } from '../utils/filter-name';
import {
  FilterCounts,
  FilterDayGroup,
  computeFilterCounts,
  computeFilterGroups,
} from '../utils/home-filter-grouping';

export interface GroupedResult {
  filter: HomeFilter | null;
  days: FilterDayGroup[];
}

export interface FilterDraft {
  guests: FilterGuests;
  day: FilterDay;
  sort: FilterSort;
  name: string;
  nameEdited: boolean;
}

interface UserFilterState {
  filters: HomeFilter[];
  selectedFilterId: string;
  customized: boolean;
}

type FilterStore = Record<string, UserFilterState>;

const EMPTY_STATE: UserFilterState = { filters: [], selectedFilterId: '', customized: false };

/**
 * Owns everything about Home's filter chips — device-local storage (keyed by userId, see
 * Config.STORAGE_HOME_FILTERS_KEY), CRUD, selection, first-launch seeding, Mixpanel
 * wiring, and the derived "filtered + grouped + sorted + counted" data (delegated to the
 * pure functions in utils/home-filter-grouping.ts so that logic is unit-testable with no
 * Angular TestBed/HTTP). Deliberately not part of ReservationService (stays a generic
 * fetch/CRUD service shared by Home/Search/Reservation-Detail) and not inline in HomePage
 * (keeps the logic testable, mirrors how pillStatus/STATUS_STEPS live as free functions in
 * reservation.ts rather than page-local logic).
 */
@Injectable({ providedIn: 'root' })
export class FilterService {
  private storage = inject(StorageService);
  private mixpanel = inject(MixpanelService);

  private store = signal<FilterStore>({});

  async init(): Promise<void> {
    const stored = await this.storage.get<FilterStore>(Config.STORAGE_HOME_FILTERS_KEY);
    if (stored) this.store.set(stored);
  }

  /** Idempotent — seeds the 4 presets only the first time this user has no stored filters
   *  at all. Safe to call from every entry point (Home, Manage Filters) defensively. */
  async ensureSeeded(userId: string): Promise<void> {
    if (!userId || this.store()[userId]) return;
    const filters: HomeFilter[] = SEED_PRESETS.map(p => ({
      id: this.uuid(),
      guests: p.guests,
      day: p.day,
      sort: p.sort,
      name: autoFilterName(p.guests, p.day),
      nameEdited: false,
      isPreset: true,
    }));
    this.store.update(s => ({
      ...s,
      [userId]: { filters, selectedFilterId: filters[0].id, customized: false },
    }));
    await this.persist();
    this.mixpanel.setHomeFilterCount(filters.length);
  }

  filters(userId: string): HomeFilter[] {
    return this.userState(userId).filters;
  }

  selectedFilterId(userId: string): string | null {
    return this.userState(userId).selectedFilterId || null;
  }

  /**
   * Every chip's count is derived this way against the same shared reservation array — no
   * per-chip fetch. See computeFilterCounts's own doc for the pending/total shape.
   */
  countsFor(filter: HomeFilter, reservations: ReservationInterface[]): FilterCounts {
    return computeFilterCounts(filter, reservations);
  }

  /**
   * Filters + sorts + groups the given reservations for the currently-selected filter.
   * Falls back to the first filter (read-only — does NOT persist a correction) when the
   * stored selection doesn't match any current filter, e.g. right after a delete that
   * hasn't gone through deleteFilter()'s own correction yet.
   */
  buildGroupedList(userId: string, reservations: ReservationInterface[]): GroupedResult {
    const filter = this.resolveSelectedFilter(userId);
    return { filter, days: filter ? computeFilterGroups(filter, reservations) : [] };
  }

  /** Public, user-initiated only — the ONE path that fires trackFilterChipSelected. */
  async selectFilter(userId: string, filterId: string): Promise<void> {
    const filters = this.filters(userId);
    const position = filters.findIndex(f => f.id === filterId);
    if (position < 0) return;
    const filter = filters[position];
    await this.setSelection(userId, filterId);
    this.mixpanel.trackFilterChipSelected({
      filter_id: filter.id,
      is_preset: filter.isPreset,
      guests: filter.guests,
      day: filter.day,
      sort: filter.sort,
      position,
    });
  }

  async createFilter(userId: string, draft: FilterDraft): Promise<HomeFilter> {
    const filter: HomeFilter = { id: this.uuid(), isPreset: false, ...draft };
    this.store.update(s => {
      const state = this.userState(userId);
      return { ...s, [userId]: { ...state, filters: [...state.filters, filter] } };
    });
    await this.persist();
    await this.markCustomizedOnce(userId);
    this.mixpanel.trackFilterCreated({
      filter_id: filter.id,
      guests: filter.guests,
      day: filter.day,
      sort: filter.sort,
    });
    this.mixpanel.setHomeFilterCount(this.filters(userId).length);
    return filter;
  }

  async updateFilter(userId: string, filter: HomeFilter): Promise<void> {
    this.store.update(s => {
      const state = this.userState(userId);
      return {
        ...s,
        [userId]: { ...state, filters: state.filters.map(f => (f.id === filter.id ? filter : f)) },
      };
    });
    await this.persist();
    await this.markCustomizedOnce(userId);
    this.mixpanel.trackFilterEdited({
      filter_id: filter.id,
      guests: filter.guests,
      day: filter.day,
      sort: filter.sort,
      is_preset: filter.isPreset,
    });
  }

  /** Blocks (returns false, changes nothing) when this is the last remaining filter — a
   *  user must always have at least one. Re-selects via the silent path when the deleted
   *  filter was the selected one. */
  async deleteFilter(userId: string, filterId: string): Promise<boolean> {
    const state = this.userState(userId);
    if (state.filters.length <= 1) return false;
    const deleted = state.filters.find(f => f.id === filterId);
    if (!deleted) return false;
    const remaining = state.filters.filter(f => f.id !== filterId);
    const wasSelected = state.selectedFilterId === filterId;
    this.store.update(s => ({
      ...s,
      [userId]: {
        ...state,
        filters: remaining,
        selectedFilterId: wasSelected ? remaining[0].id : state.selectedFilterId,
      },
    }));
    await this.persist();
    await this.markCustomizedOnce(userId);
    this.mixpanel.trackFilterDeleted({ filter_id: filterId, is_preset: deleted.isPreset });
    this.mixpanel.setHomeFilterCount(remaining.length);
    return true;
  }

  async reorderFilters(userId: string, orderedIds: string[]): Promise<void> {
    const state = this.userState(userId);
    const byId = new Map(state.filters.map(f => [f.id, f]));
    const reordered = orderedIds.map(id => byId.get(id)).filter((f): f is HomeFilter => !!f);
    this.store.update(s => ({ ...s, [userId]: { ...state, filters: reordered } }));
    await this.persist();
    await this.markCustomizedOnce(userId);
    this.mixpanel.trackFilterReordered({ filter_id_order: orderedIds });
  }

  private resolveSelectedFilter(userId: string): HomeFilter | null {
    const filters = this.filters(userId);
    if (filters.length === 0) return null;
    const selectedId = this.selectedFilterId(userId);
    return filters.find(f => f.id === selectedId) ?? filters[0];
  }

  // SILENT — no Mixpanel. Used by selectFilter() itself (after resolving the real filter)
  // and by deleteFilter()'s automatic re-selection.
  private async setSelection(userId: string, filterId: string): Promise<void> {
    this.store.update(s => ({ ...s, [userId]: { ...this.userState(userId), selectedFilterId: filterId } }));
    await this.persist();
  }

  private async markCustomizedOnce(userId: string): Promise<void> {
    if (this.userState(userId).customized) return;
    this.store.update(s => ({ ...s, [userId]: { ...this.userState(userId), customized: true } }));
    await this.persist();
    this.mixpanel.setHomeFiltersCustomized();
  }

  private userState(userId: string): UserFilterState {
    return this.store()[userId] ?? EMPTY_STATE;
  }

  private persist(): Promise<void> {
    return this.storage.set(Config.STORAGE_HOME_FILTERS_KEY, this.store());
  }

  // Same fallback-safe UUID generation as MixpanelService's private uuid() helper.
  private uuid(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
