import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/language.service';

// Map the app's language code to a day-first BCP-47 locale so English resolves
// to en-GB ("27 May") rather than en-US ("May 27"). Other languages keep their
// own natural ordering via Intl.
const LOCALE_MAP: Record<string, string> = {
  En: 'en-GB',
  Hu: 'hu-HU',
  De: 'de-DE',
  Tr: 'tr-TR',
  Fr: 'fr-FR',
  Lv: 'lv-LV',
  Es: 'es-ES',
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(
  cacheKey: string,
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let f = formatterCache.get(cacheKey);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      // Invalid/garbage IANA timeZone string — fall back to no timezone rather
      // than throwing (same graceful-degradation stance as formatPropertyInstant).
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: undefined });
    }
    formatterCache.set(cacheKey, f);
  }
  return f;
}

// pure: false because the 'dayMonth' branch reads the LanguageService signal —
// must re-run when the active language changes (same pattern as TranslatePipe).
@Pipe({
  name: 'localizedDate',
  standalone: true,
  pure: false,
})
export class LocalizedDatePipe implements PipeTransform {
  private lang = inject(LanguageService);

  // `timeZone` (IANA name, e.g. from PropertySettingsService) is only meaningful
  // for 'dayMonth' — it exists for full UTC-instant strings like a reservation's
  // `created_datetime`/`onboard_time` that (unlike arrival_date/departure_date)
  // have no separate calendar-date field to read from. Same UTC-instant
  // assumption as `formatPropertyInstant` — the naive "YYYY-MM-DD HH:MM:SS" is
  // appended a 'Z' before conversion.
  transform(
    value: string | null | undefined,
    format: 'full' | 'dayMonth' = 'full',
    timeZone?: string | null,
  ): string {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return '—';
    const parseable = timeZone ? `${value.replace(' ', 'T')}Z` : value;
    const d = new Date(parseable);
    if (Number.isNaN(d.getTime())) return '—';

    if (format === 'dayMonth') {
      const locale = LOCALE_MAP[this.lang.currentLanguage()] ?? 'en-GB';
      return getFormatter(`dayMonth|${locale}|${timeZone ?? ''}`, locale, {
        day: 'numeric',
        month: 'short',
        ...(timeZone ? { timeZone } : {}),
      }).format(d);
    }

    return getFormatter('full', undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }
}
