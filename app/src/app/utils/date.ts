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

let localInstantFormatter: Intl.DateTimeFormat | null = null;
function getLocalInstantFormatter(): Intl.DateTimeFormat {
  if (!localInstantFormatter) {
    localInstantFormatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return localInstantFormatter;
}

/**
 * Formats an "instant" timestamp from the API — e.g. a reservation's
 * `checked_in_time`/`checked_out_time`, or (once it ships) a comment's
 * created-at — as a 24h `HH:MM` string. Unlike `toInputDate` above, this is for
 * fields that represent a specific moment in time, not a calendar day.
 *
 * The API sends these as naive `"YYYY-MM-DD HH:MM:SS"` strings with no
 * timezone marker, and — as of this writing — never tells us the property's
 * timezone. Until it does, `timeZone` should be omitted: the naive string is
 * read as if it's already in the viewer's own local time (exactly how this
 * function's predecessor, the inline logic in `LocalizedTimePipe`, has always
 * behaved). This is NOT a degraded fallback — it's the only path any current
 * caller exercises, and its behavior must stay byte-for-byte stable except by
 * a deliberate, reviewed change, since every user sees it today.
 *
 * Once the API sends a real property timezone (an IANA name, e.g.
 * "Europe/Budapest"), pass it as `timeZone` and the value is instead treated
 * as a UTC instant and converted to that zone for display. ⚠️ That branch is
 * UNVERIFIED against a real payload — the exact future wire format (a naive
 * string that's secretly UTC vs. a real ISO string with a `Z`/offset vs. a
 * Unix epoch) is not yet known. Confirm and adjust this branch against a real
 * API response before relying on it.
 */
export function formatPropertyInstant(
  value: string | null | undefined,
  timeZone?: string | null,
): string {
  if (value == null || value.trim() === '') return '';
  const normalized = value.replace(' ', 'T');

  if (!timeZone) {
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) {
      const m = value.match(/(\d{1,2}:\d{2})/);
      return m ? m[1] : '';
    }
    return getLocalInstantFormatter().format(d);
  }

  // Provisional UTC-instant assumption — see the "UNVERIFIED" note above.
  const d = new Date(`${normalized}Z`);
  if (Number.isNaN(d.getTime())) {
    const m = value.match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(d);
  } catch {
    // Invalid/garbage IANA string — fall back to the no-timezone rendering
    // rather than throwing or blanking the UI.
    return getLocalInstantFormatter().format(d);
  }
}
