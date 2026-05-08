import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { BiometricService } from '../../services/biometric';

@Component({
  selector: 'app-lock-overlay',
  templateUrl: './lock-overlay.component.html',
  styleUrls: ['./lock-overlay.component.scss'],
  standalone: true,
})
export class LockOverlayComponent implements OnInit {
  readonly failCount = signal(0);
  readonly attempting = signal(false);

  constructor(
    private biometric: BiometricService,
    private auth: AuthService,
    private router: Router,
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
      this.biometric.unlockSession();
    } else {
      this.failCount.update(n => n + 1);
    }
  }

  async forceLogout(): Promise<void> {
    await this.auth.logout();
    this.biometric.unlockSession();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
