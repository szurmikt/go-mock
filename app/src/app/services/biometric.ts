import { Injectable, signal } from '@angular/core';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Config } from '../config/config';
import { StorageService } from './storage';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  readonly sessionLocked = signal(false);

  private readonly LOCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private storage: StorageService) {}

  async recordBackground(): Promise<void> {
    await this.storage.set(Config.STORAGE_BACKGROUND_AT_KEY, Date.now());
  }

  async checkAndLock(): Promise<void> {
    const ts = await this.storage.get<number>(Config.STORAGE_BACKGROUND_AT_KEY);
    if (!ts) return;
    await this.storage.remove(Config.STORAGE_BACKGROUND_AT_KEY);
    if (Date.now() - ts >= this.LOCK_AFTER_MS) {
      this.sessionLocked.set(true);
    }
  }

  lockSession(): void {
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
