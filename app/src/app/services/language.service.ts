import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

import { ApiService } from './api';
import { StorageService } from './storage';
import { ApiResponse } from '../models/auth.interfaces';
import { TRANSLATIONS, TranslationMap } from './translations';
import { environment } from '../../environments/environment';

export interface Language {
  code: string;
  name: string;
}

interface LanguagesResponse {
  languages: Language[];
  translations: TranslationMap;
}

const STORAGE_KEY_LANG = 'language';
const STORAGE_KEY_TRANSLATIONS = 'translations';
const STORAGE_KEY_LANGUAGES = 'languages';
const STORAGE_KEY_ENABLED_LANGS = 'enabledLanguages';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private storage = inject(StorageService);
  private api = inject(ApiService);

  readonly currentLanguage = signal<string>('En');
  readonly translations = signal<TranslationMap>(TRANSLATIONS);
  readonly availableLanguages = signal<Language[]>([]);
  /** Codes enabled remotely via Supabase app_config.languages. null = no restriction (fail-open). */
  readonly enabledLanguages = signal<string[] | null>(null);

  readonly displayLanguages = computed<Language[]>(() => {
    const langs = this.availableLanguages();
    const list = langs.length > 0 ? langs : [{ code: 'En', name: 'English' }];
    const enabled = this.enabledLanguages();
    if (!enabled) return list;
    const filtered = list.filter(l => enabled.includes(l.code));
    return filtered.length > 0 ? filtered : list;
  });

  async init(): Promise<void> {
    const stored = await this.storage.get<string>(STORAGE_KEY_LANG);
    const deviceLang = await this.getDeviceLang();
    this.currentLanguage.set(this.normalize(stored ?? deviceLang));

    const cached = await this.storage.get<TranslationMap>(
      STORAGE_KEY_TRANSLATIONS,
    );
    if (cached) this.translations.set(cached);

    const cachedLangs = await this.storage.get<Language[]>(
      STORAGE_KEY_LANGUAGES,
    );
    if (cachedLangs) this.availableLanguages.set(cachedLangs);

    const cachedEnabled = await this.storage.get<string[]>(
      STORAGE_KEY_ENABLED_LANGS,
    );
    if (cachedEnabled) this.enabledLanguages.set(cachedEnabled);

    // Fire-and-forget: update translations + enabled-languages restriction in the
    // background without blocking app start
    this.fetchLanguages().catch(() => {});
    this.fetchEnabledLanguages().catch(() => {});
  }

  /**
   * Instant translation lookup for use in TS code (alerts, error signals, sheet
   * titles) where the `tr` template pipe isn't available.
   *
   * Resolution order: active (merged) map → bundled English `TRANSLATIONS`
   * (ultimate EN floor, covers a key the API stripped) → the raw key.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) return key;

    const ns = key.slice(0, dotIndex);
    const prop = key.slice(dotIndex + 1);
    let text =
      this.translations()?.[ns]?.[prop] ?? TRANSLATIONS?.[ns]?.[prop] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{{${k}}}`, String(v));
      }
    }

    return text;
  }

  async setLanguage(code: string): Promise<void> {
    this.currentLanguage.set(this.normalize(code));
    await this.storage.set(STORAGE_KEY_LANG, this.currentLanguage());
    await this.fetchLanguages();
  }

  async fetchLanguages(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.api.get<ApiResponse<LanguagesResponse>>('languages'),
      );
      if (!response.success) return;

      const merged = this.mergeTranslations(
        TRANSLATIONS,
        response.data.translations,
      );
      this.translations.set(merged);
      this.availableLanguages.set(response.data.languages);

      await this.storage.set(STORAGE_KEY_TRANSLATIONS, merged);
      await this.storage.set(STORAGE_KEY_LANGUAGES, response.data.languages);
    } catch {
      // Network error: keep current translations (cached or fallback English)
    }
  }

  /**
   * Restricted-languages gate, driven by Supabase app_config.languages (per platform row).
   * Mirrors PropertyConfigService's raw-fetch pattern — no @supabase/supabase-js in this app.
   */
  async fetchEnabledLanguages(): Promise<void> {
    try {
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      const url =
        `${environment.supabaseUrl}/rest/v1/app_config` +
        `?platform=eq.${platform}&select=languages&limit=1`;

      const res = await fetch(url, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
        },
      });
      if (!res.ok) return;

      const rows: { languages: string[] }[] = await res.json();
      const codes = (rows[0]?.languages ?? []).map(c => this.normalize(c));
      this.enabledLanguages.set(codes.length ? codes : null);
      await this.storage.set(STORAGE_KEY_ENABLED_LANGS, this.enabledLanguages());
    } catch {
      // Network error: keep whatever was cache-hydrated (or the null fail-open default)
    }
  }

  private mergeTranslations(
    fallback: TranslationMap,
    api: TranslationMap,
  ): TranslationMap {
    const merged: TranslationMap = { ...fallback };
    for (const group in api) {
      merged[group] = { ...(merged[group] ?? {}), ...api[group] };
    }
    return merged;
  }

  private normalize(code: string): string {
    if (!code) return 'En';
    return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  }

  private async getDeviceLang(): Promise<string> {
    try {
      const { value } = await Device.getLanguageCode();
      return value ?? 'en';
    } catch {
      return 'en';
    }
  }
}
