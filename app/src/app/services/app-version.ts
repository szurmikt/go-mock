import { Injectable, computed, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Config } from '../config/config';

/**
 * Resolves the real installed app version + build (native MARKETING_VERSION/versionName
 * and CURRENT_PROJECT_VERSION/versionCode) via Capacitor's App.getInfo(), once, at boot.
 * `version` defaults to Config.APP_VERSION until resolved, so every synchronous reader
 * (API interceptor, force-update gate, feedback, Mixpanel, Settings) has a value
 * immediately — the fallback is only ever actually used on platforms without the native
 * App plugin (web/ionic serve), where there's no real app-store version to report anyway.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  readonly version = signal<string>(Config.APP_VERSION);
  readonly build = signal<string>('');

  /**
   * Version string for purely-descriptive/analytics consumers (Mixpanel, feedback) — the
   * unambiguous '0.0.0' sentinel on platforms without the native App plugin, instead of
   * the numeric Config.APP_VERSION fallback, so a browser/dev session can never be
   * mistaken for a real device on a specific shipped version. Consumers that need a real,
   * comparable version string — the App-Version API header, the force-update gate — must
   * keep reading `version` directly instead: the gate in particular relies on a
   * numeric-parseable, plausible value for its intentional web testing path (ionic serve
   * reads the Android minimum_version row) — '0.0.0' there would permanently fail
   * isVersionBelow() against any real minimum_version and force-block every web session.
   */
  readonly analyticsVersion = computed(() =>
    Capacitor.isNativePlatform() ? this.version() : '0.0.0',
  );

  async init(): Promise<void> {
    try {
      const info = await App.getInfo();
      this.version.set(info.version);
      this.build.set(info.build);
    } catch {
      /* web/dev — no native App plugin; keep the Config fallback for version, '' for build */
    }
  }
}
