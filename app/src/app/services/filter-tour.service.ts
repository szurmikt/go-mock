import { Injectable, inject, signal } from '@angular/core';
import { Config } from '../config/config';
import { StorageService } from './storage';

/**
 * Tracks whether this device has ever dismissed the first-run "My filters" walkthrough (New /
 * Reorder / Edit / Delete callouts). A "seen once ever" flag — same shape and boot-time init()
 * pattern as ScanOnboardingService, so `seen()` is already hydrated before the page's first
 * render and there's no flash.
 */
@Injectable({ providedIn: 'root' })
export class FilterTourService {
  private readonly storage = inject(StorageService);
  readonly seen = signal(false);
  /** Separate flag for the short Home walkthrough (chip strip + filter icon), started by tapping
   *  the pulsing dot on the filter icon. Doubles as "hide the dot". */
  readonly homeSeen = signal(false);

  async init(): Promise<void> {
    const stored = await this.storage.get<boolean>(Config.STORAGE_FILTER_TOUR_SEEN_KEY);
    if (stored === true) {
      this.seen.set(true);
    }
    if ((await this.storage.get<boolean>(Config.STORAGE_HOME_FILTER_TOUR_SEEN_KEY)) === true) {
      this.homeSeen.set(true);
    }
  }

  async markHomeSeen(): Promise<void> {
    this.homeSeen.set(true);
    await this.storage.set(Config.STORAGE_HOME_FILTER_TOUR_SEEN_KEY, true);
  }

  async markSeen(): Promise<void> {
    this.seen.set(true);
    await this.storage.set(Config.STORAGE_FILTER_TOUR_SEEN_KEY, true);
  }

  /** Debug-only: re-trigger both filter walkthroughs and the Home dot on demand (Settings → Reset Filter Tour). */
  async reset(): Promise<void> {
    this.seen.set(false);
    await this.storage.set(Config.STORAGE_FILTER_TOUR_SEEN_KEY, false);
    this.homeSeen.set(false);
    await this.storage.set(Config.STORAGE_HOME_FILTER_TOUR_SEEN_KEY, false);
  }
}
