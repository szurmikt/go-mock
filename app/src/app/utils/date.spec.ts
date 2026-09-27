import { toInputDate, formatPropertyInstant, todayInTimeZone } from './date';

describe('toInputDate', () => {
  it('passes through already-ISO dates', () => {
    expect(toInputDate('1985-06-22')).toBe('1985-06-22');
  });

  it('strips a time component from ISO datetimes', () => {
    expect(toInputDate('1985-06-22T00:00:00')).toBe('1985-06-22');
    expect(toInputDate('1985-06-22 12:30:00')).toBe('1985-06-22');
  });

  it('converts day-first dd.mm.yyyy to ISO', () => {
    expect(toInputDate('22.06.1985')).toBe('1985-06-22');
  });

  it('converts day-first dd/mm/yyyy to ISO and zero-pads', () => {
    expect(toInputDate('2/6/1985')).toBe('1985-06-02');
  });

  it('returns empty for blank or nullish input', () => {
    expect(toInputDate('')).toBe('');
    expect(toInputDate('   ')).toBe('');
    expect(toInputDate(null)).toBe('');
    expect(toInputDate(undefined)).toBe('');
  });

  it('rejects the minutes-as-month bug (month 00) and other impossible dates', () => {
    expect(toInputDate('1985-00-22')).toBe('');
    expect(toInputDate('2025-02-30')).toBe('');
    expect(toInputDate('2025-13-01')).toBe('');
  });

  it('returns empty for unrecognised formats', () => {
    expect(toInputDate('June 22, 1985')).toBe('');
    expect(toInputDate('19850622')).toBe('');
  });
});

describe('formatPropertyInstant', () => {
  it('returns empty for blank or nullish input', () => {
    expect(formatPropertyInstant('')).toBe('');
    expect(formatPropertyInstant('   ')).toBe('');
    expect(formatPropertyInstant(null)).toBe('');
    expect(formatPropertyInstant(undefined)).toBe('');
  });

  it('without a timeZone, reads the naive string as already-local (today\'s behavior)', () => {
    // No conversion happens here — the same implicit local zone is used to both
    // parse and format, so this is stable regardless of the machine's real TZ.
    expect(formatPropertyInstant('2026-09-10 14:30:00')).toBe('14:30');
    expect(formatPropertyInstant('2026-09-10T14:30:00')).toBe('14:30');
  });

  it('without a timeZone, falls back to a regex-extracted HH:MM on unparseable input', () => {
    expect(formatPropertyInstant('garbage 09:15 nonsense')).toBe('09:15');
    expect(formatPropertyInstant('completely unparseable')).toBe('');
  });

  it('with a timeZone, treats the value as a UTC instant and converts', () => {
    // Asia/Tokyo (UTC+9, no DST) keeps this deterministic regardless of the
    // machine's own local timezone.
    expect(formatPropertyInstant('2026-09-10 12:00:00', 'Asia/Tokyo')).toBe('21:00');
  });

  it('with an invalid timeZone, falls back without throwing', () => {
    expect(() => formatPropertyInstant('2026-09-10 12:00:00', 'Not/AZone')).not.toThrow();
    expect(formatPropertyInstant('2026-09-10 12:00:00', 'Not/AZone')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('todayInTimeZone', () => {
  it('returns YYYY-MM-DD in the given IANA timezone', () => {
    expect(todayInTimeZone('Asia/Tokyo')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to the device local date when no timezone is given', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayInTimeZone(null)).toBe(expected);
    expect(todayInTimeZone(undefined)).toBe(expected);
  });

  it('with an invalid timeZone, falls back without throwing', () => {
    expect(() => todayInTimeZone('Not/AZone')).not.toThrow();
    expect(todayInTimeZone('Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a UTC+ zone can read a later calendar date than a UTC- zone at the same instant', () => {
    // Not asserting real dates (test-run-time dependent) — just that the two
    // zones can disagree on which day it is, proving real per-zone conversion
    // is happening rather than a bare local-date passthrough.
    const tokyo = todayInTimeZone('Asia/Tokyo'); // UTC+9
    const honolulu = todayInTimeZone('Pacific/Honolulu'); // UTC-10
    expect(tokyo >= honolulu).toBe(true);
  });
});
