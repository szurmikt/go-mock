import { Injectable, signal } from '@angular/core';
import { BiometryType, NativeBiometric } from 'capacitor-native-biometric';
import { Config } from '../config/config';
import { StorageService } from './storage';

/** What caused the session to lock — carried through to the Mixpanel unlock-result event so it
 *  doesn't need to be re-derived from timers at the point the overlay resolves. */
export type LockTrigger = 'inactivity' | 'background' | 'cold_start';

const BIOMETRY_TYPE_NAMES: Record<BiometryType, string> = {
  [BiometryType.NONE]: 'none',
  [BiometryType.TOUCH_ID]: 'touch_id',
  [BiometryType.FACE_ID]: 'face_id',
  [BiometryType.FINGERPRINT]: 'fingerprint',
  [BiometryType.FACE_AUTHENTICATION]: 'face_authentication',
  [BiometryType.IRIS_AUTHENTICATION]: 'iris_authentication',
  [BiometryType.MULTIPLE]: 'multiple',
};

@Injectable({ providedIn: 'root' })
export class BiometricService {
  readonly sessionLocked = signal(false);

  /** Set whenever a lock is triggered; read once by the lock overlay when it reports the
   *  eventual unlock/abandon outcome. Not cleared on unlock — only ever overwritten by the next
   *  lock, so it's always defined by the time the overlay needs it. */
  readonly lastLockTrigger = signal<LockTrigger>('inactivity');

  /** User-configurable via Settings; 10 min matches the previous hardcoded default. */
  readonly AUTO_LOCK_OPTIONS: readonly number[] = [10, 30, 60, 90, 120];
  readonly autoLockMinutes = signal<number>(10);

  private get lockAfterMs(): number {
    return this.autoLockMinutes() * 60 * 1000;
  }

  constructor(private storage: StorageService) {}

  /** Hydrate the persisted auto-lock interval. Purely local — call early at boot. */
  async init(): Promise<void> {
    const minutes = await this.storage.get<number>(Config.STORAGE_AUTO_LOCK_MINUTES_KEY);
    if (minutes) this.autoLockMinutes.set(minutes);
  }

  async setAutoLockMinutes(minutes: number): Promise<void> {
    await this.storage.set(Config.STORAGE_AUTO_LOCK_MINUTES_KEY, minutes);
    this.autoLockMinutes.set(minutes);
  }

  async recordBackground(): Promise<void> {
    await this.storage.set(Config.STORAGE_BACKGROUND_AT_KEY, Date.now());
  }

  async checkAndLock(trigger: LockTrigger): Promise<void> {
    const ts = await this.storage.get<number>(Config.STORAGE_BACKGROUND_AT_KEY);
    if (!ts) return;
    await this.storage.remove(Config.STORAGE_BACKGROUND_AT_KEY);
    if (Date.now() - ts >= this.lockAfterMs) {
      this.lockSession(trigger);
    }
  }

  lockSession(trigger: LockTrigger = 'inactivity'): void {
    this.lastLockTrigger.set(trigger);
    this.sessionLocked.set(true);
  }

  unlockSession(): void {
    this.sessionLocked.set(false);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  /**
   * Best-effort label for the enrolled biometric hardware (Face ID / Touch ID / fingerprint /
   * none) — for the Mixpanel unlock-result event only. This is NOT proof of which method
   * unlocked a given session: `NativeBiometric.verifyIdentity()` resolves with no payload on
   * success, so a passcode-fallback unlock is indistinguishable from a biometric one at the JS
   * level. This just reports what's enrolled on the device.
   */
  async getBiometryType(): Promise<string> {
    try {
      const result = await NativeBiometric.isAvailable();
      return BIOMETRY_TYPE_NAMES[result.biometryType] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Confirm your identity to continue',
        title: 'SabeeApp Go',
        subtitle: '',
        description: '',
        // Without this, a device with no enrolled biometrics (or a failed biometric
        // read) throws immediately with no OS prompt at all — trapping the user with
        // no way in but forceLogout(). This falls back to the device passcode/PIN.
        useFallback: true,
        fallbackTitle: 'Use Passcode',
      });
      return true;
    } catch {
      return false;
    }
  }
}
