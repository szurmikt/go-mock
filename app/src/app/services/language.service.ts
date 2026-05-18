import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Device } from '@capacitor/device';

import { ApiService } from './api';
import { StorageService } from './storage';
import { ApiResponse } from '../models/auth.interfaces';
import { TRANSLATIONS, TranslationMap } from './translations';

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

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private storage = inject(StorageService);
  private api = inject(ApiService);

  readonly currentLanguage = signal<string>('En');
  readonly translations = signal<TranslationMap>(TRANSLATIONS);
  readonly availableLanguages = signal<Language[]>([]);

  readonly displayLanguages = computed<Language[]>(() => {
    const langs = this.availableLanguages();
    if (langs.length > 0) return langs;
    return [{ code: 'En', name: 'English' }];
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

    // Fire-and-forget: update translations in the background without blocking app start
    this.fetchLanguages().catch(() => {});
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
