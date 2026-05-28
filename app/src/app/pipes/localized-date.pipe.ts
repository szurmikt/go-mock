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
    f = new Intl.DateTimeFormat(locale, opts);
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

  transform(
    value: string | null | undefined,
    format: 'full' | 'dayMonth' = 'full',
  ): string {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';

    if (format === 'dayMonth') {
      const locale = LOCALE_MAP[this.lang.currentLanguage()] ?? 'en-GB';
      return getFormatter(`dayMonth|${locale}`, locale, {
        day: 'numeric',
        month: 'short',
      }).format(d);
    }

    return getFormatter('full', undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }
}
