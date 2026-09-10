import { toInputDate, formatPropertyInstant } from './date';

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
