import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/angular';
import { Config } from '../config/config';
import { isVersionBelow } from '../utils/version';
import { SupabaseService } from './supabase';

export interface AppConfig {
  platform: string;
  minimum_version: string;
}

export interface GateResult {
  blocked: boolean;
}

const CONFIG_TIMEOUT_MS = 3000;

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private supabase = inject(SupabaseService);

  /**
   * Fetches the app_config row for the given platform, racing against a 3s
   * timeout. Returns null on timeout, query error, or any thrown error so the
   * caller can fail open.
   */
  private async getConfig(platform: string): Promise<AppConfig | null> {
    const timeout = new Promise<null>(resolve =>
      setTimeout(() => resolve(null), CONFIG_TIMEOUT_MS),
    );

    const query = (async (): Promise<AppConfig | null> => {
      const { data, error } = await this.supabase.db
        .from('app_config')
        .select('platform, minimum_version')
        .eq('platform', platform)
        .single();
      if (error || !data) return null;
      return data as AppConfig;
    })().catch(() => null);

    return Promise.race([query, timeout]);
  }

  /**
   * Resolves the device platform (web/PWA reads the android row), reads the
   * minimum_version, and blocks if the running app version is below it.
   * Fails open (returns { blocked: false }) when config is unavailable.
   */
  async runVersionGate(): Promise<GateResult> {
    const raw = Capacitor.getPlatform();
    const platform = raw === 'ios' ? 'ios' : 'android';

    const config = await this.getConfig(platform);

    if (config === null) {
      Sentry.captureException(new Error('version_gate config unavailable'), {
        tags: { context: 'version_gate' },
      });
      return { blocked: false };
    }

    if (isVersionBelow(Config.APP_VERSION, config.minimum_version)) {
      Sentry.captureMessage('app gated', { level: 'info', tags: { platform } });
      return { blocked: true };
    }

    return { blocked: false };
  }
}
