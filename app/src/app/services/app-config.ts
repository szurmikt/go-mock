import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/angular';
import { Config } from '../config/config';
import { isVersionBelow } from '../utils/version';
import { environment } from '../../environments/environment';

export interface GateResult {
  blocked: boolean;
}

const CONFIG_TIMEOUT_MS = 3000;
const CONFIG_FN_URL = `${environment.supabaseUrl}/functions/v1/config`;

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private async fetchConfig(params: Record<string, string>): Promise<{ app_config: { minimum_version: string } | null; property_config: unknown } | null> {
    const timeout = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), CONFIG_TIMEOUT_MS),
    );

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

  async runVersionGate(): Promise<GateResult> {
    const raw = Capacitor.getPlatform();
    const platform = raw === 'ios' ? 'ios' : 'android';

    const result = await this.fetchConfig({ platform });

    if (!result?.app_config) {
      Sentry.captureException(new Error('version_gate config unavailable'), {
        tags: { context: 'version_gate' },
      });
      return { blocked: false };
    }

    if (isVersionBelow(Config.APP_VERSION, result.app_config.minimum_version)) {
      Sentry.captureMessage('app gated', { level: 'info', tags: { platform } });
      return { blocked: true };
    }

    return { blocked: false };
  }
}
