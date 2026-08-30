import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks flows that must not be interrupted by a live-update reload (which discards all in-memory
 * state). Any flow holding unsaved work registers itself here; LiveUpdateService defers applying
 * a staged bundle while anything is registered, and retries on the next resume.
 *
 * Deliberately generic — more flows will need this. Keys are arbitrary; a Set means repeated
 * acquires of the same key collapse, and one flow releasing never clears another's claim.
 */
@Injectable({ providedIn: 'root' })
export class BusyGuardService {
  private readonly keys = signal<Set<string>>(new Set());

  readonly isBusy = computed(() => this.keys().size > 0);

  acquire(key: string): void {
    if (this.keys().has(key)) return;
    const next = new Set(this.keys());
    next.add(key);
    this.keys.set(next);
  }

  release(key: string): void {
    if (!this.keys().has(key)) return;
    const next = new Set(this.keys());
    next.delete(key);
    this.keys.set(next);
  }
}
