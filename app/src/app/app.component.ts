import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import * as Sentry from '@sentry/angular';
import { IonApp, IonRouterOutlet, createAnimation, Animation } from '@ionic/angular/standalone';
import { LockOverlayComponent } from './components/lock-overlay/lock-overlay.component';
import { ApiEnvironmentService } from './services/api-environment';
import { AppConfigService } from './services/app-config';
import { AppVersionService } from './services/app-version';
import { AuthService, GO_SUBSCRIPTION_MODULE } from './services/auth';
import { BiometricService } from './services/biometric';
import { CapturePreferenceService } from './idscanly/services/capture-preference.service';
import { LiveUpdateService } from './services/live-update';
import { MixpanelService } from './services/mixpanel';
import { OptionsService } from './services/options.service';
import {
  BOOT_SETUP_BUDGET_NATIVE_MS,
  BOOT_SETUP_BUDGET_OTA_MS,
  BOOT_SETUP_CAPTION_DELAY_MS,
  BOOT_SETUP_RELOAD_MARGIN_MS,
  MIN_BACKGROUND_MS_FOR_RELOAD,
  READY_TIMEOUT_MS,
} from './config/live-update.const';
import { TranslatePipe } from './pipes/translate.pipe';

const SLIDE_DURATION = 280;
const SLIDE_EASING = 'cubic-bezier(0.3, 0, 0, 1)';

/** Slop for Angular bootstrap, which runs before ngOnInit can read the clock. */
const PRE_BOOT_MARGIN_MS = 2000;
/** Headroom for ready() + telemetry to execute before the native rollback timer fires. */
const READY_SAFETY_MARGIN_MS = 1500;

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
  imports: [IonApp, IonRouterOutlet, LockOverlayComponent, TranslatePipe],
})
export class AppComponent implements OnInit, OnDestroy {
  loading = signal(true);
  /**
   * Translation key captioning the boot splash, or null for a bare spinner. Set by the pre-login
   * setup gate once it has been running long enough to be worth explaining.
   */
  bootMessage = signal<string | null>(null);
  readonly slideTransition = slideTransition;

  private inactivityTimer?: ReturnType<typeof setTimeout>;

  /**
   * When the app last went to background, for the live-update reload gate. 0 = we have not seen a
   * background this session, so a resume is not a real return and must not trigger a reload.
   * Separate from BiometricService's persisted timestamp, which serves the session lock.
   */
  private backgroundedAt = 0;

  private options = inject(OptionsService);
  private apiEnv = inject(ApiEnvironmentService);
  private appConfig = inject(AppConfigService);
  private mixpanel = inject(MixpanelService);
  private appVersion = inject(AppVersionService);
  private liveUpdate = inject(LiveUpdateService);
  private capturePreference = inject(CapturePreferenceService);

  constructor(
    readonly auth: AuthService,
    readonly biometric: BiometricService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    // Approximates "time since the bundle loaded", for the live-update ready() budget below.
    // The real elapsed time is larger (Angular bootstrap already ran) — PRE_BOOT_MARGIN_MS
    // covers that gap, since it isn't measurable from here.
    const bootStart = Date.now();

    // Global tag so every Sentry event/log carries the platform — mirrors Mixpanel's
    // existing `platform` super property (same Capacitor.getPlatform() source). Set first,
    // before anything else, so it's present even on an error that happens during boot.
    Sentry.setTag('platform', Capacitor.getPlatform());

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      document.body.classList.add('ios-native');
      Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open'));
      Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open'));
    }

    const initialUrl = window.location.pathname + window.location.search;
    const authlessRoutes = ['/login', '/mfa', '/property-select', '/'];

    // Resolve the real installed app version first (AppVersionService — via App.getInfo(),
    // same source SettingsPage uses). Must be ready before apiEnv.init(), since the API
    // interceptor's App-Version header and the force-update gate both read it on the very
    // first request/check.
    await this.appVersion.init();
    // Purely local read (the persisted auto-lock interval) — no network dependency, must resolve
    // before the inactivity timer or biometric.checkAndLock() can fire.
    await this.biometric.init();
    // Purely local read (the remembered Card/Passport scan toggle) — no network dependency.
    await this.capturePreference.init();
    await this.apiEnv.init();
    // Which OTA bundle is running — a purely local read, deliberately not gated on any backend
    // call, so bundle_version is correct on the very first event even on a flaky network.
    await this.liveUpdate.initBundleVersion();
    // Reconcile what the plugin reports against what we persisted (did a staged bundle apply? did
    // the binary change? did the watchdog roll back?) and prune old bundles. Entirely local, no
    // network — it sits ahead of the version gate so its result is available to registerSuperProps
    // below, and so a rollback is classified before anything else reads the bundle state.
    await this.liveUpdate.resolveBundleState();

    // Moved ahead of registerSuperProps so the live-update ready() decision (below) can reuse
    // its result: this is the qualifying "real backend round-trip" for rollback confirmation.
    const gate = await this.appConfig.runVersionGate();

    // Analytics: register super properties (incl. api_mode) and open the boot session.
    // NOTE: property is not yet known here (loadStoredAuth() hasn't resolved), so the very
    // first session_started of a cold boot fires without property_id/property_name. This
    // self-heals: setActiveProperty() below (once loadStoredAuth resolves) persists the
    // super property via localStorage, so it's present for every session from then on.
    this.mixpanel.registerSuperProps(
      this.apiEnv.mode(),
      this.appVersion.analyticsVersion(),
      this.liveUpdate.currentBundleId(),
      this.liveUpdate.bundleState(),
    );
    this.mixpanel.handleAppActive();

    // Confirm this bundle works (cancels the native rollback timer). Fire-and-forget — it must
    // not delay routing. The gate's own attempt is proof enough when it succeeded, which is the
    // overwhelmingly common case; only when it failed do we retry, and then strictly within
    // whatever is left of readyTimeout, so the retry can never outlive the native deadline it
    // is racing.
    if (gate.reachedBackend) {
      this.liveUpdate.callReady(true);
    } else {
      const budget = Math.max(
        0,
        READY_TIMEOUT_MS - PRE_BOOT_MARGIN_MS - READY_SAFETY_MARGIN_MS - (Date.now() - bootStart),
      );
      this.appConfig
        .waitForBackendReachable(budget)
        .then(reachable => this.liveUpdate.callReady(reachable));
    }

    // Registered before the gate.blocked early-return below, so it still runs for a user who is
    // gated at boot. It re-checks the version gate on every foreground transition.
    App.addListener('appStateChange', async ({ isActive }) => {
      // Session analytics — runs regardless of auth/gate state. Refresh the active-property
      // super property before handleAppActive() so it's already registered if this foreground
      // starts a new session (session_started).
      if (isActive) {
        this.mixpanel.setActiveProperty(
          this.auth.selectedProperty()?.property_id,
          this.auth.selectedProperty()?.property_name,
        );
        this.mixpanel.handleAppActive();
      } else this.mixpanel.handleAppBackground();

      if (!isActive) this.backgroundedAt = Date.now();

      if (isActive) {
        const resumeGate = await this.appConfig.runVersionGate();
        if (resumeGate.blocked) {
          await this.router.navigateByUrl('/update-required', { replaceUrl: true });
          return;
        }
        // Only once the native binary is confirmed current. Resume is the one place allowed to
        // reload — but only on a genuine return: a brief glance away is not "leaving the app",
        // and reloading on it is as jarring as reloading at launch. Below the threshold the
        // bundle still downloads and stays staged for a later resume.
        const awayMs = this.backgroundedAt ? Date.now() - this.backgroundedAt : 0;
        await this.liveUpdate.checkAndApply(awayMs >= MIN_BACKGROUND_MS_FOR_RELOAD);
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

    if (gate.blocked) {
      await this.router.navigateByUrl('/update-required', { replaceUrl: true });
      this.loading.set(false);
      return; // skip loadStoredAuth, biometric, options, inactivity timer
    }

    // Pre-login setup gate: hold the splash briefly while a new bundle is fetched and applied.
    //
    // This does NOT contradict "boot stages, resume applies" — that rule rejected a self-restart
    // seconds after the user taps the icon, because it reads as a crash. Here the app has not been
    // shown yet and the reload happens behind the splash: a longer launch, not a restart.
    //
    // Fail-open is structural, not best-effort. The release timer is armed BEFORE anything that
    // can throw or await, `finish` is wired to both settle paths of the promise, and the whole
    // block is wrapped — so a bug below can never strand the app on a spinner, which would be a
    // worse outcome than any amount of staleness.
    let releaseGate!: () => void;
    const setupGate = new Promise<void>(resolve => {
      releaseGate = resolve;
    });
    const onNative = this.liveUpdate.currentBundleId() === 'native';
    const setupBudget = onNative ? BOOT_SETUP_BUDGET_NATIVE_MS : BOOT_SETUP_BUDGET_OTA_MS;
    // A plain number, read off the same clock as the release timer — not a mutable "still allowed"
    // flag that some later edit could forget to clear.
    const reloadDeadline = Date.now() + setupBudget - BOOT_SETUP_RELOAD_MARGIN_MS;
    const releaseTimer = setTimeout(releaseGate, setupBudget);
    // Stay silent for a moment so a fast check shows no text at all; past this, the caption is what
    // makes a longer hold read as progress rather than a hang.
    const captionTimer = setTimeout(
      () => this.bootMessage.set('login.settingUp'),
      BOOT_SETUP_CAPTION_DELAY_MS,
    );
    const finishSetup = () => {
      clearTimeout(releaseTimer);
      clearTimeout(captionTimer);
      releaseGate();
    };

    try {
      if (gate.reachedBackend) {
        this.liveUpdate.syncAndInstallNow(reloadDeadline).then(finishSetup, finishSetup);
      } else {
        // Already know the network is unreliable — stage only, and never hold the screen for it.
        this.liveUpdate.checkAndApply(false);
        finishSetup();
      }
    } catch {
      finishSetup();
    }

    this.auth.loadStoredAuth().then(async () => {
      if (this.auth.isAuthenticated()) {
        await this.biometric.checkAndLock();
        if (this.auth.selectedProperty()) {
          await this.options.load().catch(() => {});
        }
      }

      // Backfill the active-property super property as soon as it's known after a cold
      // boot, so it's persisted (localStorage) in time for every session from here on.
      const restoredProp = this.auth.selectedProperty();
      this.mixpanel.setActiveProperty(restoredProp?.property_id, restoredProp?.property_name);

      let url: string;
      if (!this.auth.isAuthenticated()) {
        url = '/login';
      } else if (!this.auth.selectedProperty()) {
        url = '/property-select';
      } else {
        // A restored session with an active property is the boot-time equivalent of
        // login — re-verify eligibility before letting it straight through to /home:
        // re-fetch /properties (a PID can drop out of eligibility between sessions,
        // and the API now excludes ineligible PIDs from this response entirely) and
        // re-check /me's subscription. Fail-closed on either request failing.
        const selected = this.auth.selectedProperty()!;
        let freshProperties = null as Awaited<ReturnType<AuthService['loadProperties']>> | null;
        try {
          freshProperties = await this.auth.loadProperties();
        } catch {
          freshProperties = null;
        }
        const meResult = await this.auth.fetchUser();
        if (freshProperties === null || !meResult.ok) {
          url = '/service-unavailable';
        } else if (freshProperties.length === 0 || !meResult.subscription.includes(GO_SUBSCRIPTION_MODULE)) {
          url = '/go-unavailable';
        } else if (!freshProperties.some(p => p.property_id === selected.property_id)) {
          await this.auth.clearSelectedProperty();
          url = '/property-select';
        } else {
          url = initialUrl && !authlessRoutes.includes(initialUrl.split('?')[0]) ? initialUrl : '/home';
        }
      }

      // Join the setup gate only here, at the last possible moment. Running it in parallel with
      // loadStoredAuth() means the common case (nothing new to fetch) costs ~0, while an update
      // still holds the splash until it is installed. Navigating is also what closes the reload
      // window — past this point syncAndInstallNow()'s deadline check declines to reload.
      await setupGate;
      this.bootMessage.set(null);

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
    this.inactivityTimer = setTimeout(
      () => {
        if (this.auth.isAuthenticated()) this.biometric.lockSession();
      },
      this.biometric.autoLockMinutes() * 60 * 1000,
    );
  }

  ngOnDestroy(): void {
    clearTimeout(this.inactivityTimer);
  }
}
