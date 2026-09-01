import { Injectable, signal } from '@angular/core';
import { Config } from '../../config/config';
import { StorageService } from '../../services/storage';
import { CaptureBucket } from '../models/document-type';

/**
 * Remembers the user's last Card/Passport capture-screen toggle choice across sessions.
 * Kept as its own service rather than folded into CaptureSessionService — that service's whole
 * contract is "wipe everything on reset()/every abandon path", which a cross-session preference
 * doesn't belong in. Mirrors the single-purpose, one-signal init()-at-boot pattern already used by
 * BiometricService.autoLockMinutes / ApiEnvironmentService.
 */
@Injectable({ providedIn: 'root' })
export class CapturePreferenceService {
  /** Cold start defaults to Card — the more common of the two buckets. */
  readonly bucket = signal<CaptureBucket>('card');

  constructor(private readonly storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<CaptureBucket>(Config.STORAGE_SCAN_BUCKET_KEY);
    if (stored === 'card' || stored === 'passport') {
      this.bucket.set(stored);
    }
  }

  async setBucket(bucket: CaptureBucket): Promise<void> {
    this.bucket.set(bucket);
    await this.storage.set(Config.STORAGE_SCAN_BUCKET_KEY, bucket);
  }
}
