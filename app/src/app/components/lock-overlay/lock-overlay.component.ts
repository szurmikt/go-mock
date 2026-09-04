import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { BiometricService } from '../../services/biometric';
import { MixpanelService } from '../../services/mixpanel';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-lock-overlay',
  templateUrl: './lock-overlay.component.html',
  styleUrls: ['./lock-overlay.component.scss'],
  standalone: true,
  imports: [TranslatePipe],
})
export class LockOverlayComponent implements OnInit {
  readonly failCount = signal(0);
  readonly attempting = signal(false);

  constructor(
    private biometric: BiometricService,
    private auth: AuthService,
    private router: Router,
    private mixpanel: MixpanelService,
  ) {}

  ngOnInit(): void {
    this.tryUnlock();
  }

  async tryUnlock(): Promise<void> {
    if (this.attempting()) return;
    this.attempting.set(true);
    const ok = await this.biometric.authenticate();
    this.attempting.set(false);
    if (ok) {
      this.trackUnlockResult('unlocked', this.failCount() + 1);
      this.biometric.unlockSession();
    } else {
      this.failCount.update(n => n + 1);
    }
  }

  async forceLogout(): Promise<void> {
    this.trackUnlockResult('abandoned_logout', this.failCount());
    await this.auth.logout();
    this.biometric.unlockSession();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private trackUnlockResult(outcome: 'unlocked' | 'abandoned_logout', attempts: number): void {
    this.biometric.getBiometryType().then(biometry_type => {
      this.mixpanel.trackSessionUnlockResult({
        outcome,
        attempts,
        trigger: this.biometric.lastLockTrigger(),
        auto_lock_minutes: this.biometric.autoLockMinutes(),
        biometry_type,
      });
    });
  }
}
