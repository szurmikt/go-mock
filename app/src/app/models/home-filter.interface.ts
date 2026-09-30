export type FilterGuests = 'arrivals' | 'departures' | 'in_house';
export type FilterDay = 'yesterday' | 'today' | 'tomorrow' | 'next_7_days' | 'next_14_days';
export type FilterSort = 'room' | 'name' | 'created';

export interface HomeFilter {
  id: string;
  guests: FilterGuests;
  day: FilterDay;
  sort: FilterSort;
  name: string;
  /** Once the user edits the name by hand, the auto-generated name stops updating it. */
  nameEdited: boolean;
  /** Seeded on first launch — still editable/deletable/reorderable like any other filter.
   *  Only affects the `is_preset` Mixpanel payload field. */
  isPreset: boolean;
}

/** The 4 presets seeded on first launch, in this exact order — see
 *  app/docs/home-filter-chips-handoff.md. `id`/`name` are filled in by
 *  FilterService.ensureSeeded() (stable uuid + autoFilterName()). */
export const SEED_PRESETS: { guests: FilterGuests; day: FilterDay; sort: FilterSort }[] = [
  { guests: 'arrivals', day: 'today', sort: 'room' },
  { guests: 'departures', day: 'today', sort: 'room' },
  { guests: 'in_house', day: 'today', sort: 'room' },
  { guests: 'arrivals', day: 'tomorrow', sort: 'room' },
];
