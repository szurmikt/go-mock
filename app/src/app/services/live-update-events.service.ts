import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { Config } from '../config/config';
import { PropertyInterface } from '../models/property.interface';
import { ApiEnvironmentService } from './api-environment';
import { AppVersionService } from './app-version';
import { StorageService } from './storage';

/**
 * Durable, server-side record of live-update rollbacks.
 *
 * Exists because the Mixpanel equivalent is fire-and-forget from a webview that is in the middle
 * of reloading — during the OTA acceptance pass the rollback itself was confirmed three
 * independent ways while `bundle_failed{reason:'rollback'}` never arrived. Rollbacks being
 * invisible at fleet scale is the gap this closes.
 *
 * ⚠️ Two constraints on this file, both load-bearing:
 *
 * 1. Its dependencies are limited to StorageService, ApiEnvironmentService and AppVersionService.
 *    Injecting AuthService would close the cycle AuthService → LiveUpdateService → here, a class
 *    of bug this codebase has hit before: it compiles cleanly and then blank-screens at bootstrap.
 * 2. It resolves the device id itself rather than reading AuthService.deviceId(). The only caller
 *    runs at boot, long before loadStoredAuth() populates that signal, so it would be '' against
 *    a NOT NULL column.
 *
 * Known limitation, accepted: a rollback usually happens on a bad network, which is exactly when
 * this fetch fails. Rows will be lost, so Mixpanel stays the primary counter and this table is the
 * joinable detail view. A persist-and-retry-next-boot queue is the obvious v2; not built here.
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdateEventsService {
  private readonly apiEnv = inject(ApiEnvironmentService);
  private readonly appVersion = inject(AppVersionService);
  private readonly storage = inject(StorageService);

  private deviceId: string | null = null;

  /**
   * Dynamically imported and fallback literal both mirror AuthService.loadDeviceId(), so web/dev
   * rows carry the same identity as the rest of the app and the plugin is never touched at module
   * load on a platform that lacks it.
   */
  private async resolveDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    try {
      const { Device } = await import('@capacitor/device');
      this.deviceId = (await Device.getId()).identifier;
    } catch {
      this.deviceId = 'web-dev-device';
    }
    return this.deviceId;
  }

  /**
   * Never throws — a failure here must not disturb a boot that is already recovering from a
   * rollback. `reason` shares its vocabulary with Mixpanel's bundle_failed / bundle_fallback_*
   * so the two join.
   *
   * `rollback_fallback_applied` reuses `previous_bundle_id` for a different meaning than plain
   * `rollback` does: there, it's the bundle that failed; here (no dedicated column exists, and
   * none is needed for one event type), it's the bundle the fallback landed ON. Always read
   * `reason` alongside it.
   */
  async record(p: {
    reason: 'rollback' | 'rollback_fallback_applied';
    previousBundleId: string | null;
    downloadedBundleIds: string[];
  }): Promise<void> {
    try {
      const property = await this.storage.get<PropertyInterface>(Config.STORAGE_PROPERTY_KEY);

      await fetch(`${environment.supabaseUrl}/rest/v1/live_update_events`, {
        method: 'POST',
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${environment.supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          environment: this.apiEnv.mode(),
          device_id: await this.resolveDeviceId(),
          // Null pre-login, which is the common case for a rollback boot — the column allows it.
          property_id: property ? String(property.property_id) : null,
          previous_bundle_id: p.previousBundleId,
          // What was still on disk at rollback time. This is what will say how often a viable
          // last-working target actually existed, before that feature is designed for it.
          downloaded_bundle_ids: p.downloadedBundleIds,
          reason: p.reason,
          app_version: this.appVersion.version(),
          platform: Capacitor.getPlatform(),
        }),
      });
    } catch {
      /* swallowed by design — see the class comment */
    }
  }
}
