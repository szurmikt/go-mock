import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { LockOverlayComponent } from './components/lock-overlay/lock-overlay.component';
import { AuthService } from './services/auth';
import { BiometricService } from './services/biometric';
import { OptionsService } from './services/options.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, LockOverlayComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  loading = signal(true);

  private inactivityTimer?: ReturnType<typeof setTimeout>;
  private readonly LOCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes

  private options = inject(OptionsService);

  constructor(
    readonly auth: AuthService,
    readonly biometric: BiometricService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.auth.loadStoredAuth().then(async () => {
      if (this.auth.isAuthenticated()) {
        await this.biometric.checkAndLock();
        if (this.auth.selectedProperty()) {
          await this.options.load();
        }
      }

      const url = !this.auth.isAuthenticated()
        ? '/login'
        : this.auth.selectedProperty()
          ? '/home'
          : '/property-select';
      await this.router.navigateByUrl(url, { replaceUrl: true });
      this.loading.set(false);

      if (this.auth.isAuthenticated()) this.resetInactivityTimer();
    });

    App.addListener('appStateChange', async ({ isActive }) => {
      if (!this.auth.isAuthenticated()) return;
      if (!isActive) {
        await this.biometric.recordBackground();
        clearTimeout(this.inactivityTimer);
      } else {
        await this.biometric.checkAndLock();
        if (!this.biometric.sessionLocked()) this.resetInactivityTimer();
      }
    });
  }

  @HostListener('touchstart')
  @HostListener('click')
  onUserActivity(): void {
    if (this.auth.isAuthenticated() && !this.biometric.sessionLocked()) {
      this.resetInactivityTimer();
    }
  }

  private resetInactivityTimer(): void {
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (this.auth.isAuthenticated()) this.biometric.lockSession();
    }, this.LOCK_AFTER_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.inactivityTimer);
  }
}
