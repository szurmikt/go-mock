import { toInputDate } from './date';

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
