import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { StorageService } from './storage';
import { LanguageService } from './language.service';
import { AppVersionService } from './app-version';
import { isVersionBelow } from '../utils/version';
import { TipCard, TipCardAction } from '../models/tip-card.interface';

interface RawTipCardTranslation {
  title: string;
  summary: string;
  body: string;
  actionLabel?: string;
}

interface RawTipCard {
  id: string;
  category: string;
  translations: Record<string, RawTipCardTranslation>;
  image: string;
  action: TipCardAction | null;
  featured: boolean;
  sort_order: number;
  min_app_version: string | null;
  enabled: boolean;
  updated_at: string;
}

const STORAGE_KEY_RAW_CARDS = 'remoteTipCards';

/** Falls back to the `en` entry per-field, not the whole object, so a card partially
 *  translated into the current language (e.g. missing a just-added actionLabel) still shows
 *  real text for every field instead of blanking the ones that happen to be missing. */
function resolveForLanguage(row: RawTipCard, lang: string): TipCard {
  const entry = row.translations[lang];
  const en = row.translations['en'];
  return {
    id: row.id,
    category: row.category,
    title: entry?.title ?? en?.title ?? '',
    summary: entry?.summary ?? en?.summary ?? '',
    body: entry?.body ?? en?.body ?? '',
    actionLabel: entry?.actionLabel ?? en?.actionLabel,
    image: row.image,
    action: row.action ?? undefined,
    featured: row.featured,
    updatedAt: row.updated_at,
  };
}

/**
 * Remote TipCards content (Supabase `tip_cards` table) — the text/translations/metadata half of
 * the feature-education cards shown on Home and the Help & Tips list. Image storage/rendering
 * is unaffected by this service — `image` is passed through as-is, whether it's a bundled
 * asset path or a full Storage URL (see TipCardComponent).
 *
 * Stale-while-revalidate, mirroring LanguageService.init()'s exact shape: cache-hydrate from
 * StorageService, then refetch in the background. A transient fetch failure leaves whatever
 * was already cached (or empty, if there's never been a successful fetch) untouched — there is
 * deliberately no bundled fallback set of cards.
 */
@Injectable({ providedIn: 'root' })
export class RemoteTipsService {
  private storage = inject(StorageService);
  private lang = inject(LanguageService);
  private appVersion = inject(AppVersionService);

  /** Raw multi-language rows, unfiltered by app version — filtering is applied in `cards`
   *  below rather than before caching, so a version bump alone (with no new fetch) can still
   *  reveal a previously-gated card from already-cached data. */
  private raw = signal<RawTipCard[]>([]);

  /** Resolved for the current language and app version. A computed() off both
   *  LanguageService.currentLanguage and AppVersionService.version, so an in-app language
   *  switch re-resolves instantly with no network call. */
  readonly cards = computed<TipCard[]>(() => {
    const version = this.appVersion.version();
    const lang = this.lang.currentLanguage().toLowerCase();
    return this.raw()
      .filter(row => !row.min_app_version || !isVersionBelow(version, row.min_app_version))
      .map(row => resolveForLanguage(row, lang));
  });

  async init(): Promise<void> {
    const cached = await this.storage.get<RawTipCard[]>(STORAGE_KEY_RAW_CARDS);
    if (cached) this.raw.set(cached);
    this.fetchCards().catch(() => {});
  }

  async fetchCards(): Promise<void> {
    try {
      const url =
        `${environment.supabaseUrl}/rest/v1/tip_cards` +
        `?select=*&enabled=eq.true&order=sort_order.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
      });
      if (!res.ok) return; // SWR: leave existing cache/signal untouched on a real HTTP error too

      const rows: RawTipCard[] = await res.json();
      this.raw.set(rows);
      await this.storage.set(STORAGE_KEY_RAW_CARDS, rows);
    } catch {
      // Network error: keep whatever was cache-hydrated (or empty) — no bundled fallback,
      // per the agreed design.
    }
  }
}
