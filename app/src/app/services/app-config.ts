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

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private appVersion = inject(AppVersionService);

  private async fetchConfigOnce(
    params: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ app_config: { minimum_version: string } | null; property_config: unknown } | null> {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));

    const query = (async () => {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${CONFIG_FN_URL}?${qs}`, {
        headers: { apikey: environment.supabaseAnonKey },
      });
      if (!res.ok) return null;
      return res.json();
    })().catch(() => null);

    return Promise.race([query, timeout]);
  }

  private platform(): string {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  }

  async runVersionGate(): Promise<GateResult> {
    const platform = this.platform();

    const result = await this.fetchConfigOnce({ platform }, CONFIG_TIMEOUT_MS);

    if (!result?.app_config) {
      Sentry.captureException(new Error('version_gate config unavailable'), {
        tags: { context: 'version_gate' },
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
      const result = await this.fetchConfigOnce(
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
