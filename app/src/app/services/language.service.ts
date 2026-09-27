import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

import { ApiService } from './api';
import { StorageService } from './storage';
import { MixpanelService } from './mixpanel';
import { ApiResponse } from '../models/auth.interfaces';
import { TRANSLATIONS, TranslationMap } from './translations';
import { environment } from '../../environments/environment';

/** Per-attempt timeout inside waitForBackendReachable — mirrors the shape AppConfigService's
 *  own version-gate reachability retry used before the live-update probe moved here. */
const REACHABILITY_ATTEMPT_TIMEOUT_MS = 1500;
const REACHABILITY_RETRY_GAP_MS = 500;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

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
  private mixpanel = inject(MixpanelService);

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

  /**
   * The init()-time fetchLanguages() call, captured so waitForBackendReachable() can reuse it
   * instead of firing a second request — normally already settled by the time anything asks.
   * Starts resolved-false so a call before init() has run (shouldn't happen, but this is a
   * `providedIn: 'root'` singleton with no guaranteed construction order) never hangs.
   */
  private bootProbe: Promise<boolean> = Promise.resolve(false);

  async init(): Promise<void> {
    const stored = await this.storage.get<string>(STORAGE_KEY_LANG);
    const deviceLang = await this.getDeviceLang();
    this.currentLanguage.set(this.normalize(stored ?? deviceLang));
    this.mixpanel.setLanguage(this.currentLanguage());

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
    // background without blocking app start. Captured (not just fired) — this exact request is
    // what the live-update ready() confirmation reuses via waitForBackendReachable(), rather
    // than firing a second one of its own.
    this.bootProbe = this.fetchLanguages();
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
    this.mixpanel.setLanguage(this.currentLanguage());
    await this.storage.set(STORAGE_KEY_LANG, this.currentLanguage());
    await this.fetchLanguages();
  }

  /**
   * Returns whether a real round trip to the SabeeApp API completed — NOT whether the business
   * call succeeded. `response.success: false` still means the request reached the backend and
   * got a well-formed answer, so it counts; only a genuine network failure doesn't. This return
   * value is what the live-update ready() confirmation is built on (see waitForBackendReachable)
   * — it needs "is this bundle able to reach the real backend", which is a different question
   * from "did the language list come back", though the same request answers both.
   *
   * `timeoutMs`, when given, races the request against a local timeout — used by
   * waitForBackendReachable's retry loop so one slow attempt can't consume the whole budget.
   * Omitted for the plain init()/setLanguage() callers, which just want the normal request.
   */
  async fetchLanguages(timeoutMs?: number): Promise<boolean> {
    try {
      const request = firstValueFrom(
        this.api.get<ApiResponse<LanguagesResponse>>('languages'),
      );
      const response = await (timeoutMs ? Promise.race([request, timeout(timeoutMs)]) : request);
      if (!response.success) return true;

      const merged = this.mergeTranslations(
        TRANSLATIONS,
        response.data.translations,
      );
      this.translations.set(merged);
      this.availableLanguages.set(response.data.languages);

      await this.storage.set(STORAGE_KEY_TRANSLATIONS, merged);
      await this.storage.set(STORAGE_KEY_LANGUAGES, response.data.languages);
      return true;
    } catch (err) {
      // Network error: keep current translations (cached or fallback English). A real HTTP error
      // response (any status but 0) still proves the network — and this bundle's own HTTP
      // client/interceptor wiring — reached SabeeApp's infrastructure; only status 0 (no response
      // at all: DNS failure, connection refused, or our own `timeout()` above) means genuinely
      // unreachable. Same status-0 rule LoginPage.extractMessage already uses.
      return err instanceof HttpErrorResponse && err.status !== 0;
    }
  }

  /**
   * Retry until a round trip completes or the budget runs out. Starts by reusing the boot probe
   * already in flight from init() (normally already settled, so the common case costs nothing
   * extra) before falling back to fresh attempts of its own.
   *
   * Exists because a bundle's ready() confirmation needs to tell "the backend is reachable" apart
   * from "we gave up and let the user through" — a single twitchy attempt would revert perfectly
   * good bundles on ordinary slow hotel wifi, and with autoBlockRolledBackBundles the device then
   * stays pinned to the old one. The budget is computed by the caller from the clock, so retries
   * can never outlive the native readyTimeout.
   */
  async waitForBackendReachable(budgetMs: number): Promise<boolean> {
    const deadline = Date.now() + budgetMs;

    const bootResult = await Promise.race([
      this.bootProbe,
      new Promise<boolean>(resolve =>
        setTimeout(() => resolve(false), Math.max(0, deadline - Date.now())),
      ),
    ]);
    if (bootResult) return true;

    // The boot probe above may still be in flight past the deadline race (unusually slow), in
    // which case this fires a genuinely separate request rather than waiting on it further —
    // acceptable: this only happens when the very first attempt was already exceptionally slow.
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      if (await this.fetchLanguages(Math.min(REACHABILITY_ATTEMPT_TIMEOUT_MS, remaining))) {
        return true;
      }

      if (Date.now() + REACHABILITY_RETRY_GAP_MS >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, REACHABILITY_RETRY_GAP_MS));
    }

    return false;
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
