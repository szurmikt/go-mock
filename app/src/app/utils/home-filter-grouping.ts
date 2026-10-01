import { HomeFilter, FilterDay, FilterSort } from '../models/home-filter.interface';
import { ReservationInterface } from '../models/reservation.interface';
import { dateOffsetStr } from './date';
import { naturalCompare } from './natural-sort';

export interface FilterDayGroup {
  /** ISO date string for a multi-day group, or null for a single-implicit-day filter
   *  (yesterday/today/tomorrow/in_house) where no sticky day header should render. */
  day: string | null;
  /** Display label for a multi-day group's sticky header (e.g. "Today · Wed 30 Sep").
   *  Null whenever `day` is null. */
  label: string | null;
  /** Pending rows, sorted, followed by dimmed cancelled/no-show rows, sorted
   *  independently — the two halves never interleave regardless of `sort`. Both are
   *  rendered; only the cancelled/no-show half is dimmed. */
  rows: ReservationInterface[];
  /** `rows.slice(0, pendingCount)` are the pending half; the rest are cancelled/no-show.
   *  Kept separate from `rows.length` because counts must never include the
   *  cancelled/no-show half. */
  pendingCount: number;
  /** Collapsible "Checked in (n)"/"Checked out (n)" section. Always empty for `in_house`
   *  — that mode has no completed/pending split at all. */
  completed: ReservationInterface[];
}

export interface FilterCounts {
  /** Present only for a single-day arrivals/departures filter (per the chip-strip spec —
   *  a multi-day or in_house chip shows a plain total only). */
  pending?: number;
  total: number;
}

function bookerName(r: ReservationInterface): string {
  return `${r.booker.first_name} ${r.booker.last_name}`.trim();
}

function compareRoomName(a: string, b: string): number {
  const aEmpty = !a || a.trim() === '';
  const bEmpty = !b || b.trim() === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return naturalCompare(a, b);
}

function compareBySort(sort: FilterSort, a: ReservationInterface, b: ReservationInterface): number {
  switch (sort) {
    case 'room':
      return compareRoomName(a.room_name, b.room_name);
    case 'name':
      return naturalCompare(bookerName(a), bookerName(b));
    case 'created':
      // Newest first — created_datetime is a "YYYY-MM-DD HH:MM:SS" string, so a plain
      // lexicographic compare is already chronological.
      return (b.created_datetime ?? '').localeCompare(a.created_datetime ?? '');
  }
}

function isCancelledOrNoShow(r: ReservationInterface): boolean {
  return r.status === 'cancelled' || r.status === 'noshow';
}

/** In-house: has arrived and not yet checked out, AND hasn't already departed — a guest
 *  who left without ever being checked out in the PMS must not linger as "in house"
 *  indefinitely. A guest departing exactly `today` still counts (departure_date >= today). */
function isInHouse(r: ReservationInterface, today: string): boolean {
  return (r.status === 'checkedin' || r.status === 'onboard') && r.departure_date >= today;
}

function matchesDateField(guests: 'arrivals' | 'departures', r: ReservationInterface, day: string): boolean {
  return guests === 'arrivals' ? r.arrival_date === day : r.departure_date === day;
}

/** Pure "YYYY-MM-DD" + N days arithmetic, anchored to a caller-supplied date string rather
 *  than the system clock — keeps the whole module's day-window math testable with an
 *  injected `today`. Uses local Y/M/D components (never `new Date("YYYY-MM-DD")`, which
 *  parses as UTC midnight and can drift a day west of UTC). */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** The day(s) an arrivals/departures filter matches against. `yesterday`/`today`/`tomorrow`
 *  are exactly those single days. The two multi-day options deliberately start at
 *  `today+2` (the day after tomorrow), NOT `today` — `today`/`tomorrow` are already fully
 *  covered by the dedicated Today's/Tomorrow's arrivals presets, so including them here too
 *  would list the same reservations under two different chips. `today+15` (the last day of
 *  next_14_days) sits one full day inside the app's reservation fetch window (`now+16d`,
 *  widened from `now+14d` in ReservationService.fetchReservations specifically to keep this
 *  same margin once the window moved) — a deliberate day of margin, not a boundary match. */
function resolveDayWindow(day: FilterDay, today: string): string[] {
  switch (day) {
    case 'yesterday':
      return [addDays(today, -1)];
    case 'today':
      return [today];
    case 'tomorrow':
      return [addDays(today, 1)];
    case 'next_7_days':
      return Array.from({ length: 7 }, (_, i) => addDays(today, i + 2));
    case 'next_14_days':
      return Array.from({ length: 14 }, (_, i) => addDays(today, i + 2));
  }
}

function formatDayLabel(day: string, today: string, tomorrow: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const base = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  if (day === today) return `Today · ${base}`;
  if (day === tomorrow) return `Tomorrow · ${base}`;
  return base;
}

function splitIntoGroup(
  filter: HomeFilter,
  matches: ReservationInterface[],
  day: string | null,
  label: string | null,
): FilterDayGroup {
  const countable = matches.filter(r => !isCancelledOrNoShow(r));
  const excluded = matches.filter(isCancelledOrNoShow);

  let pending: ReservationInterface[];
  let completed: ReservationInterface[];

  if (filter.guests === 'arrivals') {
    completed = countable.filter(r => r.status === 'checkedin' || r.status === 'onboard');
    pending = countable.filter(r => !(r.status === 'checkedin' || r.status === 'onboard'));
  } else if (filter.guests === 'departures') {
    completed = countable.filter(r => r.status === 'checkedout');
    pending = countable.filter(r => r.status !== 'checkedout');
  } else {
    // in_house: no completed/pending split — every countable row is just "pending".
    completed = [];
    pending = countable;
  }

  const sortFn = (list: ReservationInterface[]) =>
    [...list].sort((a, b) => compareBySort(filter.sort, a, b));
  const sortedPending = sortFn(pending);
  const sortedExcluded = sortFn(excluded);

  return {
    day,
    label,
    // Cancelled/no-show rows always sort after every pending row, never interleaved by
    // the chosen sort key.
    rows: [...sortedPending, ...sortedExcluded],
    pendingCount: sortedPending.length,
    completed: sortFn(completed),
  };
}

/**
 * Filters + sorts + (for multi-day) groups-by-day a reservation list for one `HomeFilter`.
 * Pure — given the same `filter`/`reservations`/`today`, always returns the same result; no
 * dependency on the system clock beyond `today`'s default. `today` is injectable so tests
 * can exercise exact date-boundary behavior deterministically.
 */
export function computeFilterGroups(
  filter: HomeFilter,
  reservations: ReservationInterface[],
  today: string = dateOffsetStr(0),
): FilterDayGroup[] {
  if (filter.guests === 'in_house') {
    const matches = reservations.filter(r => isInHouse(r, today));
    return [splitIntoGroup(filter, matches, null, null)];
  }

  const guests = filter.guests;
  const days = resolveDayWindow(filter.day, today);

  if (days.length === 1) {
    const matches = reservations.filter(r => matchesDateField(guests, r, days[0]));
    return [splitIntoGroup(filter, matches, null, null)];
  }

  const tomorrow = addDays(today, 1);
  const groups: FilterDayGroup[] = [];
  for (const day of days) {
    const matches = reservations.filter(r => matchesDateField(guests, r, day));
    const group = splitIntoGroup(filter, matches, day, formatDayLabel(day, today, tomorrow));
    // A day with only cancelled/no-show reservations is still rendered (dimmed) — "empty"
    // means nothing at all to show, i.e. no rows AND no completed.
    if (group.rows.length === 0 && group.completed.length === 0) continue;
    groups.push(group);
  }
  return groups;
}

/**
 * Chip-count derivation for ANY filter (not only the selected one) — every chip's count
 * is computed this way against the same shared reservation array, with no extra fetch.
 * `pending` is present only for a single-day arrivals/departures filter, per the
 * chip-strip spec — a multi-day or in_house chip shows a plain total only.
 */
export function computeFilterCounts(
  filter: HomeFilter,
  reservations: ReservationInterface[],
  today: string = dateOffsetStr(0),
): FilterCounts {
  const groups = computeFilterGroups(filter, reservations, today);
  const pending = groups.reduce((s, g) => s + g.pendingCount, 0);
  const completed = groups.reduce((s, g) => s + g.completed.length, 0);
  const isMultiDay = filter.day === 'next_7_days' || filter.day === 'next_14_days';
  const showsPending = (filter.guests === 'arrivals' || filter.guests === 'departures') && !isMultiDay;
  return showsPending ? { pending, total: pending + completed } : { total: pending + completed };
}
