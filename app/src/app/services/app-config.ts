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
   * Consumed by the live-update ready() confirmation, which must not treat "we gave up and let
   * the user through" as proof the backend is reachable.
   */
  reachedBackend: boolean;
}

const CONFIG_TIMEOUT_MS = 3000;
/** Per-attempt timeout inside waitForBackendReachable — shorter, so several attempts fit. */
const REACHABILITY_ATTEMPT_TIMEOUT_MS = 1500;
const REACHABILITY_RETRY_GAP_MS = 500;
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

  /**
   * Retry the same probe until one attempt succeeds or the budget runs out. Only called when
   * runVersionGate()'s single attempt already failed — the caller short-circuits otherwise.
   *
   * Exists because the gate's one-shot 3s timeout is tuned for keeping the routing decision
   * responsive, which is far too twitchy to decide whether a bundle is healthy: on ordinary slow
   * hotel wifi that would revert perfectly good bundles, and with autoBlockRolledBackBundles the
   * device then stays pinned to the old bundle. The budget is computed by the caller from the
   * clock, so retries can never outlive the native readyTimeout.
   */
  async waitForBackendReachable(budgetMs: number): Promise<boolean> {
    const deadline = Date.now() + budgetMs;
    const platform = this.platform();

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const { data: result } = await this.fetchConfigOnce(
        { platform },
        Math.min(REACHABILITY_ATTEMPT_TIMEOUT_MS, remaining),
      );
      if (result?.app_config) return true;

      if (Date.now() + REACHABILITY_RETRY_GAP_MS >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, REACHABILITY_RETRY_GAP_MS));
    }

    return false;
  }
}
