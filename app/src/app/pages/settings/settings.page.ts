import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { BiometricService } from '../../services/biometric';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [IonContent],
})
export class SettingsPage {
  loggingOut = signal(false);

  constructor(
    public auth: AuthService,
    private biometric: BiometricService,
    private router: Router,
  ) {}

  back() {
    window.history.back();
  }

  lock() {
    this.biometric.lockSession();
  }

  async logout() {
    this.loggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
