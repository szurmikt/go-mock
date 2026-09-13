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
 * timezone marker. `GET /properties/settings` now returns the property's real
 * timezone as an IANA name (e.g. "Europe/Budapest") in `property_time_zone`
 * (see `PropertySettingsService`, wired through `AuthService` and consumed by
 * `ReservationDetailPage`) — confirmed live (2026-09-13) that the naive
 * strings are true UTC instants, not property-local wall-clock time. When a
 * `timeZone` is passed, the value is treated as a UTC instant (`Z` appended)
 * and converted to that zone for display.
 *
 * Omitting `timeZone` is the graceful-degradation path — a property with no
 * timezone on record, or a failed `PropertySettingsService.load()` — and reads
 * the naive string as if it's already in the viewer's own local time (exactly
 * how this function's predecessor, the inline logic in `LocalizedTimePipe`,
 * has always behaved). Its behavior must stay byte-for-byte stable except by
 * a deliberate, reviewed change, since it's still what renders whenever the
 * real timezone isn't available.
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

  // Confirmed UTC-instant assumption — see the doc comment above.
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
