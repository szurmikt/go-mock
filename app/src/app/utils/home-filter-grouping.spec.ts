import { computeFilterCounts, computeFilterGroups } from './home-filter-grouping';
import { HomeFilter } from '../models/home-filter.interface';
import { ReservationInterface } from '../models/reservation.interface';

const TODAY = '2026-06-15'; // Monday
const YESTERDAY = '2026-06-14';
const TOMORROW = '2026-06-16';
const TODAY_PLUS_2 = '2026-06-17';
const TODAY_PLUS_6 = '2026-06-21'; // last day of next_7_days' window (today..today+6)
const TODAY_PLUS_7 = '2026-06-22';
const TODAY_PLUS_13 = '2026-06-28'; // last day of next_14_days' window (today..today+13)
const TODAY_PLUS_14 = '2026-06-29';

let nextId = 1;

function makeReservation(overrides: Partial<ReservationInterface> = {}): ReservationInterface {
  const id = String(nextId++);
  return {
    id,
    reservation_code: `CODE${id}`,
    partner: undefined,
    booker: { booker_id: id, first_name: 'Guest', last_name: id, email: '' },
    arrival_date: TODAY,
    departure_date: TODAY,
    created_datetime: '2026-06-01 10:00:00',
    checked_in_time: '',
    onboard_time: '',
    checked_out_time: '',
    status: 'confirmed',
    room_type_id: '1',
    room_type_name: 'Standard',
    room_id: '1',
    room_name: '',
    guest_count: { adults: 1, children: 0, infants: 0 },
    number_of_guests: 1,
    nights: 1,
    open_in_pms: false,
    notes: [],
    ...overrides,
  };
}

function makeFilter(overrides: Partial<HomeFilter> = {}): HomeFilter {
  return {
    id: 'f1',
    guests: 'arrivals',
    day: 'today',
    sort: 'room',
    name: 'Test filter',
    nameEdited: false,
    isPreset: false,
    ...overrides,
  };
}

describe('computeFilterGroups — guests × day combinations', () => {
  it('arrivals: matches arrival_date for yesterday/today/tomorrow', () => {
    const reservations = [
      makeReservation({ arrival_date: YESTERDAY }),
      makeReservation({ arrival_date: TODAY }),
      makeReservation({ arrival_date: TOMORROW }),
    ];
    expect(
      computeFilterGroups(makeFilter({ guests: 'arrivals', day: 'yesterday' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[0]]);
    expect(
      computeFilterGroups(makeFilter({ guests: 'arrivals', day: 'today' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[1]]);
    expect(
      computeFilterGroups(makeFilter({ guests: 'arrivals', day: 'tomorrow' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[2]]);
  });

  it('departures: matches departure_date for yesterday/today/tomorrow', () => {
    const reservations = [
      makeReservation({ departure_date: YESTERDAY }),
      makeReservation({ departure_date: TODAY }),
      makeReservation({ departure_date: TOMORROW }),
    ];
    expect(
      computeFilterGroups(makeFilter({ guests: 'departures', day: 'yesterday' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[0]]);
    expect(
      computeFilterGroups(makeFilter({ guests: 'departures', day: 'today' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[1]]);
    expect(
      computeFilterGroups(makeFilter({ guests: 'departures', day: 'tomorrow' }), reservations, TODAY)[0].rows,
    ).toEqual([reservations[2]]);
  });

  it('arrivals/departures: next_7_days and next_14_days group by day', () => {
    const r1 = makeReservation({ arrival_date: TODAY_PLUS_2 });
    const r2 = makeReservation({ arrival_date: TODAY_PLUS_6 });
    const groups7 = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'next_7_days' }),
      [r1, r2],
      TODAY,
    );
    expect(groups7.length).toBe(2);
    expect(groups7.map(g => g.day)).toEqual([TODAY_PLUS_2, TODAY_PLUS_6]);
  });
});

describe('computeFilterGroups — in_house', () => {
  it('ignores `day` entirely', () => {
    const r = makeReservation({ status: 'checkedin', departure_date: TODAY_PLUS_6 });
    const a = computeFilterGroups(makeFilter({ guests: 'in_house', day: 'today' }), [r], TODAY);
    const b = computeFilterGroups(makeFilter({ guests: 'in_house', day: 'next_14_days' }), [r], TODAY);
    expect(a).toEqual(b);
  });

  it('excludes a checkedin/onboard reservation whose departure_date is in the past', () => {
    const r = makeReservation({ status: 'checkedin', departure_date: YESTERDAY });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(groups[0].rows).toEqual([]);
  });

  it('includes a checkedin/onboard reservation departing exactly today', () => {
    const r = makeReservation({ status: 'onboard', departure_date: TODAY });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(groups[0].rows).toEqual([r]);
  });

  it('includes a checkedin/onboard reservation departing in the future', () => {
    const r = makeReservation({ status: 'checkedin', departure_date: TODAY_PLUS_6 });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(groups[0].rows).toEqual([r]);
  });

  it('excludes a non-checkedin/onboard reservation regardless of dates', () => {
    const r = makeReservation({ status: 'confirmed', arrival_date: YESTERDAY, departure_date: TODAY_PLUS_6 });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(groups[0].rows).toEqual([]);
  });

  it('has no completed section, ever — all countable rows land in `rows`, `completed` is always empty', () => {
    const r1 = makeReservation({ status: 'checkedin', departure_date: TODAY_PLUS_6 });
    const r2 = makeReservation({ status: 'onboard', departure_date: TODAY });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r1, r2], TODAY);
    expect(groups[0].completed).toEqual([]);
    expect(groups[0].rows.length).toBe(2);
  });
});

describe('computeFilterGroups — multi-day window boundaries', () => {
  it('next_7_days includes today and runs through today+6, excludes yesterday and today+7', () => {
    const inWindow = [
      makeReservation({ arrival_date: TODAY }),
      makeReservation({ arrival_date: TODAY_PLUS_6 }),
    ];
    const outside = [
      makeReservation({ arrival_date: YESTERDAY }),
      makeReservation({ arrival_date: TODAY_PLUS_7 }),
    ];
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'next_7_days' }),
      [...inWindow, ...outside],
      TODAY,
    );
    const days = groups.map(g => g.day);
    expect(days).toContain(TODAY);
    expect(days).toContain(TODAY_PLUS_6);
    expect(days).not.toContain(YESTERDAY);
    expect(days).not.toContain(TODAY_PLUS_7);
  });

  it('next_14_days includes today and runs through today+13, excludes yesterday and today+14', () => {
    const inWindow = [
      makeReservation({ arrival_date: TODAY }),
      makeReservation({ arrival_date: TODAY_PLUS_13 }),
    ];
    const outside = [
      makeReservation({ arrival_date: YESTERDAY }),
      makeReservation({ arrival_date: TODAY_PLUS_14 }),
    ];
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'next_14_days' }),
      [...inWindow, ...outside],
      TODAY,
    );
    const days = groups.map(g => g.day);
    expect(days).toContain(TODAY);
    expect(days).toContain(TODAY_PLUS_13);
    expect(days).not.toContain(YESTERDAY);
    expect(days).not.toContain(TODAY_PLUS_14);
  });
});

describe('computeFilterGroups — completed split', () => {
  it('arrivals (today): only onboard/checkedout count as arrived — an online check-in (checkedin) stays pending', () => {
    const pending = makeReservation({ arrival_date: TODAY, status: 'confirmed' });
    const checkedIn = makeReservation({ arrival_date: TODAY, status: 'checkedin' });
    const onboard = makeReservation({ arrival_date: TODAY, status: 'onboard' });
    const checkedOut = makeReservation({ arrival_date: TODAY, status: 'checkedout' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today' }),
      [pending, checkedIn, onboard, checkedOut],
      TODAY,
    );
    expect(groups[0].pendingCount).toBe(2);
    expect(groups[0].rows).toEqual(jasmine.arrayContaining([pending, checkedIn]));
    expect(groups[0].completed.length).toBe(2);
    expect(groups[0].completed).toEqual(jasmine.arrayContaining([onboard, checkedOut]));
  });

  it('arrivals (tomorrow): checkedin (online check-in ahead of arrival) folds into completed', () => {
    const notYet = makeReservation({ arrival_date: TOMORROW, status: 'confirmed' });
    const online = makeReservation({ arrival_date: TOMORROW, status: 'checkedin' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'tomorrow' }),
      [notYet, online],
      TODAY,
    );
    expect(groups[0].pendingCount).toBe(1);
    expect(groups[0].completed).toEqual([online]);
  });

  it('arrivals: a reservation that already checked out counts as "arrived", not "not yet arrived" — regression for a real bug (a one-night Yesterday\'s-arrivals stay, already checked out, was showing up under the "Not yet arrived" header)', () => {
    const alreadyGone = makeReservation({ arrival_date: YESTERDAY, status: 'checkedout' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'yesterday' }),
      [alreadyGone],
      TODAY,
    );
    expect(groups[0].pendingCount).toBe(0);
    expect(groups[0].completed).toEqual([alreadyGone]);
  });

  it('departures: checkedout folds into completed, everything else countable stays pending', () => {
    const pending = makeReservation({ departure_date: TODAY, status: 'confirmed' });
    const checkedOut = makeReservation({ departure_date: TODAY, status: 'checkedout' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'departures', day: 'today' }),
      [pending, checkedOut],
      TODAY,
    );
    expect(groups[0].pendingCount).toBe(1);
    expect(groups[0].completed).toEqual([checkedOut]);
  });

  it('in_house: no split at all — completed is always empty', () => {
    const r = makeReservation({ status: 'checkedin', departure_date: TODAY });
    const groups = computeFilterGroups(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(groups[0].completed).toEqual([]);
  });
});

describe('computeFilterGroups — cancelled / no-show', () => {
  it('appear in rows but never in pendingCount or completed', () => {
    const cancelled = makeReservation({ arrival_date: TODAY, status: 'cancelled', room_name: '1' });
    const noshow = makeReservation({ arrival_date: TODAY, status: 'noshow', room_name: '2' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today' }),
      [cancelled, noshow],
      TODAY,
    );
    expect(groups[0].pendingCount).toBe(0);
    expect(groups[0].completed).toEqual([]);
    expect(groups[0].rows.length).toBe(2);
  });

  it('always sort after every pending row, regardless of sort mode', () => {
    // Cancelled row has an alphabetically/numerically EARLIER room name than the pending
    // one — if it were merged into the same sorted pass it would sort first; it must not.
    const cancelled = makeReservation({ arrival_date: TODAY, status: 'cancelled', room_name: '1' });
    const pending = makeReservation({ arrival_date: TODAY, status: 'confirmed', room_name: '9' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today', sort: 'room' }),
      [cancelled, pending],
      TODAY,
    );
    expect(groups[0].rows).toEqual([pending, cancelled]);
    expect(groups[0].pendingCount).toBe(1);
  });

  it('a checkedout-but-cancelled edge case never happens in practice, but cancelled always wins the split regardless of status', () => {
    const r = makeReservation({ departure_date: TODAY, status: 'cancelled' });
    const groups = computeFilterGroups(makeFilter({ guests: 'departures', day: 'today' }), [r], TODAY);
    expect(groups[0].pendingCount).toBe(0);
    expect(groups[0].completed).toEqual([]);
    expect(groups[0].rows).toEqual([r]);
  });
});

describe('computeFilterGroups — multi-day grouping edge cases', () => {
  it('skips a day with zero matches', () => {
    const r = makeReservation({ arrival_date: TODAY_PLUS_2 });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'next_7_days' }),
      [r],
      TODAY,
    );
    expect(groups.length).toBe(1);
    expect(groups[0].day).toBe(TODAY_PLUS_2);
  });

  it('still renders a day whose only reservation is already completed', () => {
    const completed = makeReservation({ arrival_date: TODAY_PLUS_6, status: 'onboard' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'next_7_days' }),
      [completed],
      TODAY,
    );
    const group = groups.find(g => g.day === TODAY_PLUS_6);
    expect(group).toBeTruthy();
    expect(group!.rows).toEqual([]);
    expect(group!.completed).toEqual([completed]);
  });
});

describe('computeFilterGroups — sort modes', () => {
  it('room: natural sort, mixed numeric/text, no-room-assigned goes last', () => {
    const r10 = makeReservation({ arrival_date: TODAY, room_name: '10' });
    const r2 = makeReservation({ arrival_date: TODAY, room_name: '2' });
    const rCity = makeReservation({ arrival_date: TODAY, room_name: 'City Panorama' });
    const rNone = makeReservation({ arrival_date: TODAY, room_name: '' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today', sort: 'room' }),
      [r10, rNone, rCity, r2],
      TODAY,
    );
    expect(groups[0].rows).toEqual([r2, r10, rCity, rNone]);
  });

  it('name: natural sort by booker first+last name', () => {
    const a = makeReservation({ arrival_date: TODAY, booker: { booker_id: '1', first_name: 'Alice', last_name: 'Adams', email: '' } });
    const b = makeReservation({ arrival_date: TODAY, booker: { booker_id: '2', first_name: 'Bob', last_name: 'Brown', email: '' } });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today', sort: 'name' }),
      [b, a],
      TODAY,
    );
    expect(groups[0].rows).toEqual([a, b]);
  });

  it('created: real chronological compare, newest first', () => {
    const older = makeReservation({ arrival_date: TODAY, created_datetime: '2026-06-01 09:00:00' });
    const newer = makeReservation({ arrival_date: TODAY, created_datetime: '2026-06-10 09:00:00' });
    const groups = computeFilterGroups(
      makeFilter({ guests: 'arrivals', day: 'today', sort: 'created' }),
      [older, newer],
      TODAY,
    );
    expect(groups[0].rows).toEqual([newer, older]);
  });
});

describe('computeFilterCounts', () => {
  it('single-day arrivals/departures: pending + total, excluding cancelled/no-show', () => {
    const pending = makeReservation({ arrival_date: TODAY, status: 'confirmed' });
    const completed = makeReservation({ arrival_date: TODAY, status: 'onboard' });
    const cancelled = makeReservation({ arrival_date: TODAY, status: 'cancelled' });
    const counts = computeFilterCounts(
      makeFilter({ guests: 'arrivals', day: 'today' }),
      [pending, completed, cancelled],
      TODAY,
    );
    expect(counts).toEqual({ pending: 1, total: 2 });
  });

  it('in_house: total only, no pending field', () => {
    const r = makeReservation({ status: 'checkedin', departure_date: TODAY });
    const counts = computeFilterCounts(makeFilter({ guests: 'in_house' }), [r], TODAY);
    expect(counts).toEqual({ total: 1 });
  });

  it('multi-day arrivals: total only (no pending field), even though the single-day case has one', () => {
    const r = makeReservation({ arrival_date: TODAY_PLUS_2, status: 'confirmed' });
    const counts = computeFilterCounts(
      makeFilter({ guests: 'arrivals', day: 'next_7_days' }),
      [r],
      TODAY,
    );
    expect(counts).toEqual({ total: 1 });
  });

  it('never counts cancelled/no-show toward pending or total', () => {
    const cancelled = makeReservation({ arrival_date: TODAY, status: 'cancelled' });
    const noshow = makeReservation({ arrival_date: TODAY, status: 'noshow' });
    const counts = computeFilterCounts(
      makeFilter({ guests: 'arrivals', day: 'today' }),
      [cancelled, noshow],
      TODAY,
    );
    expect(counts).toEqual({ pending: 0, total: 0 });
  });
});
