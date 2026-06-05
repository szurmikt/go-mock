/**
 * Coerces a scanned/stored date string into the strict `YYYY-MM-DD` form that
 * `<input type="date">` requires. Accepts:
 *   - already-ISO `YYYY-MM-DD` (and ISO with a time component, e.g. `1985-06-22T00:00:00`)
 *   - `dd.mm.yyyy` and `dd/mm/yyyy` (day-first — the common European document form)
 * Returns '' when the value is empty or cannot be parsed to a real calendar date,
 * so callers can fall back to the existing field value.
 */
export function toInputDate(value: string | null | undefined): string {
  if (value == null) return '';
  const s = value.trim();
  if (s === '') return '';

  // ISO `YYYY-MM-DD`, optionally followed by a time component.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    return isValid(y, m, d) ? `${y}-${m}-${d}` : '';
  }

  // Day-first `dd.mm.yyyy` or `dd/mm/yyyy` (separators may be '.', '/', or '-').
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return isValid(y, m, d) ? `${y}-${m}-${d}` : '';
  }

  return '';
}

function isValid(y: string, m: string, d: string): boolean {
  const year = +y;
  const month = +m;
  const day = +d;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Reject impossible day-of-month (e.g. 2025-02-30) via round-trip.
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}
