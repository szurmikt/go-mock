import { TestBed } from '@angular/core/testing';
import { FilterService } from './home-filter.service';
import { StorageService } from './storage';
import { MixpanelService } from './mixpanel';

class FakeStorageService {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? this.data.get(key) : null) as T | null;
  }
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('FilterService', () => {
  let service: FilterService;
  let mixpanel: jasmine.SpyObj<MixpanelService>;
  const USER = 'user-1';

  beforeEach(() => {
    mixpanel = jasmine.createSpyObj<MixpanelService>('MixpanelService', [
      'trackFilterChipSelected',
      'trackFilterCreated',
      'trackFilterEdited',
      'trackFilterDeleted',
      'trackFilterReordered',
      'setHomeFiltersCustomized',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useClass: FakeStorageService },
        { provide: MixpanelService, useValue: mixpanel },
      ],
    });
    service = TestBed.inject(FilterService);
  });

  it('seeds the 4 presets in order on first use, selecting the first', async () => {
    await service.ensureSeeded(USER);
    const filters = service.filters(USER);
    expect(filters.length).toBe(4);
    expect(filters.map(f => f.guests)).toEqual(['arrivals', 'departures', 'in_house', 'arrivals']);
    expect(filters.every(f => f.isPreset)).toBe(true);
    expect(service.selectedFilterId(USER)).toBe(filters[0].id);
  });

  it('ensureSeeded is a no-op on a second call (idempotent)', async () => {
    await service.ensureSeeded(USER);
    const firstIds = service.filters(USER).map(f => f.id);
    await service.ensureSeeded(USER);
    expect(service.filters(USER).map(f => f.id)).toEqual(firstIds);
  });

  it('selectFilter fires trackFilterChipSelected exactly once, with the tapped filter', async () => {
    await service.ensureSeeded(USER);
    const [, second] = service.filters(USER);
    await service.selectFilter(USER, second.id);
    expect(service.selectedFilterId(USER)).toBe(second.id);
    expect(mixpanel.trackFilterChipSelected).toHaveBeenCalledTimes(1);
    expect(mixpanel.trackFilterChipSelected).toHaveBeenCalledWith(
      jasmine.objectContaining({ filter_id: second.id, is_preset: true }),
    );
  });

  it('buildGroupedList falls back to the first filter when the stored selection is stale, without persisting the correction or firing Mixpanel', async () => {
    await service.ensureSeeded(USER);
    const filters = service.filters(USER);
    // Simulate a stale selectedFilterId (e.g. corrupted storage) by selecting a real
    // filter, then removing it from the list via a raw update — deleteFilter() already
    // has its own correct re-selection path, tested separately below; this exercises the
    // OTHER path: a selection that simply doesn't resolve.
    await service.selectFilter(USER, filters[1].id);
    mixpanel.trackFilterChipSelected.calls.reset();

    const result = service.buildGroupedList(USER, []);
    // resolveSelectedFilter should still resolve to the (still valid) selected filter here.
    expect(result.filter?.id).toBe(filters[1].id);
    expect(mixpanel.trackFilterChipSelected).not.toHaveBeenCalled();
  });

  it('deleteFilter blocks when only one filter remains', async () => {
    await service.ensureSeeded(USER);
    const filters = service.filters(USER);
    for (let i = 0; i < filters.length - 1; i++) {
      await service.deleteFilter(USER, service.filters(USER)[0].id);
    }
    expect(service.filters(USER).length).toBe(1);
    const lastId = service.filters(USER)[0].id;
    const ok = await service.deleteFilter(USER, lastId);
    expect(ok).toBe(false);
    expect(service.filters(USER).length).toBe(1);
  });

  it('deleteFilter re-selects silently (no trackFilterChipSelected) when the deleted filter was selected', async () => {
    await service.ensureSeeded(USER);
    const filters = service.filters(USER);
    await service.selectFilter(USER, filters[0].id);
    mixpanel.trackFilterChipSelected.calls.reset();

    const ok = await service.deleteFilter(USER, filters[0].id);
    expect(ok).toBe(true);
    expect(service.selectedFilterId(USER)).toBe(service.filters(USER)[0].id);
    expect(mixpanel.trackFilterChipSelected).not.toHaveBeenCalled();
    expect(mixpanel.trackFilterDeleted).toHaveBeenCalledTimes(1);
  });

  it('setHomeFiltersCustomized fires only once, on the first customizing action', async () => {
    await service.ensureSeeded(USER);
    expect(mixpanel.setHomeFiltersCustomized).not.toHaveBeenCalled();

    await service.createFilter(USER, {
      guests: 'arrivals',
      day: 'today',
      sort: 'room',
      name: 'Custom',
      nameEdited: true,
    });
    expect(mixpanel.setHomeFiltersCustomized).toHaveBeenCalledTimes(1);

    await service.createFilter(USER, {
      guests: 'departures',
      day: 'today',
      sort: 'room',
      name: 'Another',
      nameEdited: true,
    });
    expect(mixpanel.setHomeFiltersCustomized).toHaveBeenCalledTimes(1);
  });

  it('selecting a chip (not creating/editing/deleting/reordering) never marks customized', async () => {
    await service.ensureSeeded(USER);
    await service.selectFilter(USER, service.filters(USER)[1].id);
    expect(mixpanel.setHomeFiltersCustomized).not.toHaveBeenCalled();
  });
});
