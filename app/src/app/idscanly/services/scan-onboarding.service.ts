import { Injectable, signal } from '@angular/core';
import { Config } from '../../config/config';
import { StorageService } from '../../services/storage';

/**
 * Tracks whether this device has ever dismissed the first-run Scan-screen walkthrough (the
 * Document form toggle + Skip button callouts). A "seen once ever" flag, not a per-session
 * preference — mirrors the single-purpose, one-signal init()-at-boot pattern already used by
 * CapturePreferenceService/BiometricService.autoLockMinutes, so `seen()` is already hydrated by
 * the time the Scan page's first ionViewWillEnter runs and there's no first-paint flash.
 */
@Injectable({ providedIn: 'root' })
export class ScanOnboardingService {
  readonly seen = signal(false);

  constructor(private readonly storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<boolean>(Config.STORAGE_SCAN_ONBOARDING_SEEN_KEY);
    if (stored === true) {
      this.seen.set(true);
    }
  }

  async markSeen(): Promise<void> {
    this.seen.set(true);
    await this.storage.set(Config.STORAGE_SCAN_ONBOARDING_SEEN_KEY, true);
  }

  /** Debug-only: lets QA re-trigger the walkthrough on demand (Settings → Reset Scan Tour,
   *  gated to the internal test property) instead of needing a fresh install/cleared storage
   *  to see it again. */
  async reset(): Promise<void> {
    this.seen.set(false);
    await this.storage.set(Config.STORAGE_SCAN_ONBOARDING_SEEN_KEY, false);
  }
}
