import { FilterDay, FilterGuests } from '../models/home-filter.interface';

const DAY_PREFIX: Partial<Record<FilterDay, string>> = {
  yesterday: "Yesterday's",
  today: "Today's",
  tomorrow: "Tomorrow's",
};

const MULTI_DAY_SUFFIX: Partial<Record<FilterDay, string>> = {
  next_7_days: 'next 7 days',
  next_14_days: 'next 14 days',
};

const GUESTS_LABEL: Record<FilterGuests, string> = {
  arrivals: 'arrivals',
  departures: 'departures',
  in_house: 'In-house',
};

/**
 * Builds the auto-generated filter name shown in the Filter Editor's Name field and used
 * as a seed filter's initial name — e.g. "Today's arrivals", "Arrivals · next 7 days",
 * "In-house". The user can overwrite it; once they do (HomeFilter.nameEdited), this
 * function is never called again for that filter (see FilterService).
 */
export function autoFilterName(guests: FilterGuests, day: FilterDay): string {
  if (guests === 'in_house') return GUESTS_LABEL.in_house;

  const prefix = DAY_PREFIX[day];
  if (prefix) return `${prefix} ${GUESTS_LABEL[guests]}`;

  const suffix = MULTI_DAY_SUFFIX[day];
  const label = GUESTS_LABEL[guests];
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized} · ${suffix}`;
}
