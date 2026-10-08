import { Injectable, inject, signal } from '@angular/core';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { AuthService } from './auth';

export type CountryUsageField = 'citizenship' | 'country_code';

type FieldCounts = Record<string, number>;
type UsageBlob = Record<string, Partial<Record<CountryUsageField, FieldCounts>>>;

const TOP_LIMIT = 10;

/**
 * Per-property, per-device popularity counts for the country pickers — drives the "top 10"
 * section at the top of CountryPickerSheetComponent. A count goes up only when a guest save
 * actually sets a new/different country (see record()), so re-saving a guest for an unrelated
 * edit doesn't inflate it. Local only by design: no backend, a new device starts empty.
 */
@Injectable({ providedIn: 'root' })
export class CountryUsageService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);

  private usage = signal<UsageBlob>({});

  async init(): Promise<void> {
    try {
      this.usage.set((await this.storage.get<UsageBlob>(Config.STORAGE_COUNTRY_USAGE_KEY)) ?? {});
    } catch {
      this.usage.set({});
    }
  }

  /** Counts `next` for the current property when it differs from `previous`. Never throws. */
  record(field: CountryUsageField, previous: string | null | undefined, next: string | null | undefined): void {
    const code = (next ?? '').trim();
    if (!code || code === (previous ?? '').trim()) return;
    const pid = this.propertyId();
    if (!pid) return;

    const blob = this.usage();
    const forProperty = blob[pid] ?? {};
    const counts = forProperty[field] ?? {};
    const updated: UsageBlob = {
      ...blob,
      [pid]: { ...forProperty, [field]: { ...counts, [code]: (counts[code] ?? 0) + 1 } },
    };
    this.usage.set(updated);
    this.storage.set(Config.STORAGE_COUNTRY_USAGE_KEY, updated).catch(() => {});
  }

  /** Up to 10 country codes for the current property, most used first (ties by code). */
  topCodes(field: CountryUsageField): string[] {
    const pid = this.propertyId();
    const counts = pid ? this.usage()[pid]?.[field] : undefined;
    if (!counts) return [];
    return Object.entries(counts)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .slice(0, TOP_LIMIT)
      .map(([code]) => code);
  }

  private propertyId(): string | null {
    const id = this.auth.selectedProperty()?.property_id;
    return id == null ? null : String(id);
  }
}
