import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { IonApp, IonRouterOutlet, createAnimation, Animation } from '@ionic/angular/standalone';
import { LockOverlayComponent } from './components/lock-overlay/lock-overlay.component';
import { ApiEnvironmentService } from './services/api-environment';
import { AppConfigService } from './services/app-config';
import { AuthService } from './services/auth';
import { BiometricService } from './services/biometric';
import { MixpanelService } from './services/mixpanel';
import { OptionsService } from './services/options.service';
import { PropertyGatingService } from './services/property-gating.service';

const SLIDE_DURATION = 280;
const SLIDE_EASING = 'cubic-bezier(0.3, 0, 0, 1)';

const slideTransition = (_: HTMLElement, opts: any): Animation => {
  const forward = opts.direction !== 'back';

  const enterAnim = createAnimation()
    .addElement(opts.enteringEl)
    .duration(SLIDE_DURATION)
    .easing(SLIDE_EASING)
    .beforeRemoveClass('ion-page-invisible')
  .beforeStyles({ 'z-index': forward ? '1' : '0', position: 'absolute', width: '100%', height: '100%' })
    .afterClearStyles(['z-index', 'position', 'width', 'height'])
    .fromTo('transform', `translateX(${forward ? '100%' : '-30%'})`, 'translateX(0)');

  if (!opts.leavingEl) return createAnimation().addAnimation([enterAnim]);

  const leaveAnim = createAnimation()
    .addElement(opts.leavingEl)
    .duration(SLIDE_DURATION)
    .easing(SLIDE_EASING)
    .beforeStyles({ 'z-index': forward ? '0' : '1', position: 'absolute', width: '100%', height: '100%' })
    .afterClearStyles(['z-index', 'position', 'width', 'height'])
    .fromTo('transform', 'translateX(0)', `translateX(${forward ? '-30%' : '100%'})`);

  return createAnimation().addAnimation([enterAnim, leaveAnim]);
};

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, LockOverlayComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  loading = signal(true);
  readonly slideTransition = slideTransition;

  private inactivityTimer?: ReturnType<typeof setTimeout>;
  private readonly LOCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes

  private options = inject(OptionsService);
  private apiEnv = inject(ApiEnvironmentService);
  private appConfig = inject(AppConfigService);
  private propertyGating = inject(PropertyGatingService);
  private mixpanel = inject(MixpanelService);

  constructor(
    readonly auth: AuthService,
    readonly biometric: BiometricService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      document.body.classList.add('ios-native');
      Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open'));
      Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open'));
    }

    const initialUrl = window.location.pathname + window.location.search;
    const authlessRoutes = ['/login', '/mfa', '/property-select', '/'];

    await this.apiEnv.init();

    // Analytics: register super properties (incl. api_mode) and open the boot session.
    this.mixpanel.registerSuperProps(this.apiEnv.mode());
    this.mixpanel.handleAppActive();

    // Register the resume listener first so it runs even if the user is gated
    // at boot. It re-checks the version gate on every foreground transition.
    App.addListener('appStateChange', async ({ isActive }) => {
      // Session analytics — runs regardless of auth/gate state.
      if (isActive) this.mixpanel.handleAppActive();
      else this.mixpanel.handleAppBackground();

      if (isActive) {
        const gate = await this.appConfig.runVersionGate();
        if (gate.blocked) {
          await this.router.navigateByUrl('/update-required', { replaceUrl: true });
          return;
        }
      }
      if (!this.auth.isAuthenticated()) return;
      if (!isActive) {
        await this.biometric.recordBackground();
        clearTimeout(this.inactivityTimer);
      } else {
        await this.biometric.checkAndLock();
        if (!this.biometric.sessionLocked()) this.resetInactivityTimer();
      }
    });

    const gate = await this.appConfig.runVersionGate();
    if (gate.blocked) {
      await this.router.navigateByUrl('/update-required', { replaceUrl: true });
      this.loading.set(false);
      return; // skip loadStoredAuth, biometric, options, inactivity timer
    }

    this.auth.loadStoredAuth().then(async () => {
      if (this.auth.isAuthenticated()) {
        await this.biometric.checkAndLock();
        if (this.auth.selectedProperty()) {
          await this.options.load().catch(() => {});
        }
      }

      let url: string;
      if (!this.auth.isAuthenticated()) {
        url = '/login';
      } else if (!this.auth.selectedProperty()) {
        url = '/property-select';
      } else {
        // A restored session with an active property is the boot-time equivalent of
        // login — re-verify the property is still Go-enabled before letting it
        // straight through to /home (see PropertyGatingService; fail-closed by design).
        const selected = this.auth.selectedProperty()!;
        const allowed = await this.propertyGating.resolveEnabledPropertyIds(
          this.auth.properties().map(p => p.property_id),
        );
        if (allowed === null) {
          url = '/service-unavailable';
        } else if (allowed.size === 0) {
          url = '/go-unavailable';
        } else if (!allowed.has(selected.property_id)) {
          await this.auth.clearSelectedProperty();
          this.auth.setGoEnabledPropertyIds(allowed);
          url = '/property-select';
        } else {
          this.auth.setGoEnabledPropertyIds(allowed);
          url = initialUrl && !authlessRoutes.includes(initialUrl.split('?')[0]) ? initialUrl : '/home';
        }
      }

      await this.router.navigateByUrl(url, { replaceUrl: true });
      this.loading.set(false);

      if (this.auth.isAuthenticated()) this.resetInactivityTimer();
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
