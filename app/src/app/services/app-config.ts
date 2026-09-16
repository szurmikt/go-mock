import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/angular';
import { AppVersionService } from './app-version';
import { isVersionBelow } from '../utils/version';
import { environment } from '../../environments/environment';

export interface GateResult {
  blocked: boolean;
  /**
   * Whether a real response came back, as opposed to the timeout/network-failure fail-open path.
   * Consumed by AppComponent's pre-login setup gate to decide between syncAndInstallNow() (apply
   * behind the splash) and a stage-only checkAndApply() — NOT by the live-update ready()
   * confirmation, which moved to LanguageService's SabeeApp-API-backed probe: this Supabase Edge
   * Function proved itself an independent point of failure (a ~2.5h platform-side degradation
   * false-flagged 15 healthy bundles as broken on 2026-09-16), and isn't a dependency the app
   * otherwise needs, unlike the SabeeApp API itself.
   */
  reachedBackend: boolean;
}

const CONFIG_TIMEOUT_MS = 3000;
const CONFIG_FN_URL = `${environment.supabaseUrl}/functions/v1/config`;

/** Why a fetchConfigOnce attempt came back with no usable data — surfaced for diagnostics only;
 *  every kind is handled identically (fail open) by both callers. */
type ConfigFetchFailureKind = 'timeout' | 'fetch_error' | 'http_error';

interface ConfigFetchResult {
  data: { app_config: { minimum_version: string } | null; property_config: unknown } | null;
  kind?: ConfigFetchFailureKind;
  status?: number;
}

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private appVersion = inject(AppVersionService);

  private async fetchConfigOnce(
    params: Record<string, string>,
    timeoutMs: number,
  ): Promise<ConfigFetchResult> {
    const timeout = new Promise<ConfigFetchResult>(resolve =>
      setTimeout(() => resolve({ data: null, kind: 'timeout' }), timeoutMs),
    );

    const query = (async (): Promise<ConfigFetchResult> => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${CONFIG_FN_URL}?${qs}`, {
        headers: { apikey: environment.supabaseAnonKey },
      });
      if (!res.ok) return { data: null, kind: 'http_error', status: res.status };
      return { data: await res.json() };
    })().catch((): ConfigFetchResult => ({ data: null, kind: 'fetch_error' }));

    return Promise.race([query, timeout]);
  }

  private platform(): string {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  }

  async runVersionGate(): Promise<GateResult> {
    const platform = this.platform();

    const { data: result, kind, status } = await this.fetchConfigOnce(
      { platform },
      CONFIG_TIMEOUT_MS,
    );

    if (!result?.app_config) {
      // Expected/transient (slow or unreachable network) — the caller already fails open, so this
      // is a Log for diagnosability, not an Issue requiring triage. Mirrors the token-refresh
      // precedent in api.interceptor.ts: only a genuinely broken state raises an Issue.
      Sentry.logger.warn('version_gate config unavailable', {
        context: 'version_gate',
        platform,
        kind: kind ?? 'unknown',
        status,
      });
      return { blocked: false, reachedBackend: false };
    }

    if (isVersionBelow(this.appVersion.version(), result.app_config.minimum_version)) {
      Sentry.captureMessage('app gated', { level: 'info', tags: { platform } });
      return { blocked: true, reachedBackend: true };
    }

    return { blocked: false, reachedBackend: true };
  }
}
