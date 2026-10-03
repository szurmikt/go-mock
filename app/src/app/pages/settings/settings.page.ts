import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { AppVersionService } from '../../services/app-version';
import { BiometricService } from '../../services/biometric';
import { LiveUpdateService } from '../../services/live-update';
import { MixpanelService } from '../../services/mixpanel';
import { LanguageService } from '../../services/language.service';
import { FeedbackSheetComponent } from '../../components/feedback-sheet/feedback-sheet.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LOCK_DEBUG_PROPERTY_ID } from './lock-debug.const';
import { PropertyConfigService } from '../../services/property-config.service';
import { TipsService } from '../../services/tips.service';
import { ScanOnboardingService } from '../../idscanly/services/scan-onboarding.service';
import { FilterTourService } from '../../services/filter-tour.service';
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [IonContent, FeedbackSheetComponent, TranslatePipe],
})
export class SettingsPage implements OnInit {
  loggingOut = signal(false);
  loadingLangs = signal(false);
  langOpen = signal(false);
  autoLockOpen = signal(false);
  @ViewChild('fb', { static: true }) feedbackSheet!: FeedbackSheetComponent;
  lang = inject(LanguageService);
  biometric = inject(BiometricService);
  private mixpanel = inject(MixpanelService);
  private route = inject(ActivatedRoute);
  private propertyConfig = inject(PropertyConfigService);
  private tips = inject(TipsService);
  private scanOnboarding = inject(ScanOnboardingService);
  private filterTour = inject(FilterTourService);

  scanTourReset = signal(false);
  filterTourReset = signal(false);
  tipsReset = signal(false);

  private appVersionService = inject(AppVersionService);
  // Same source AppComponent already resolved at boot (AppVersionService.init()) — read
  // here rather than calling App.getInfo() a second time.
  appVersion = this.appVersionService.version;
  appBuild = this.appVersionService.build;

  // Which OTA bundle is actually running — with live updates, the native version alone no longer
  // identifies the running code, so this is what a support call needs.
  private liveUpdate = inject(LiveUpdateService);
  bundleId = this.liveUpdate.currentBundleId;
  // Ground truth for on-device debugging of the rollback-fallback: the running bundle alone
  // can't tell you whether it's confirmed for real or just circularly matching a stale value —
  // this is the field the 2026-09-16 investigation needed and didn't have visibility into.
  lastHealthyBundleId = this.liveUpdate.lastHealthyBundleId;
  copied = signal(false);

  /** Copy the full version triple — that's what's useful when debugging a specific hotel. */
  async copyDiagnostics(): Promise<void> {
    const text = `v${this.appVersion()} (${this.appBuild()}) · bundle ${this.bundleId()} · lastHealthy ${this.lastHealthyBundleId() ?? 'none'}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* clipboard unavailable (insecure context / denied) — the text is on screen regardless */
    }
  }

  readonly lockButtonEnabled = computed(
    () => String(this.auth.selectedProperty()?.property_id) === LOCK_DEBUG_PROPERTY_ID,
  );

  // Shared gate for the Reset Scan Tour / Reset Tip Cards debug buttons below (moved here from
  // the Help & Tips page) — properties on the 'dev' OTA channel are the internal test cohort,
  // reused instead of yet another hardcoded property-ID const.
  readonly devDebugEnabled = computed(() => this.propertyConfig.liveUpdateChannel() === 'dev');

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  /** Deep-link target for the Auto-Lock/Language/Feedback Help & tips cards' "Try it" button —
   *  lands the user directly on the open bottom sheet, not just the bare Settings page. */
  ngOnInit(): void {
    const open = this.route.snapshot.queryParamMap.get('open');
    if (open === 'autoLock') this.openAutoLockPicker();
    else if (open === 'language') this.openLangPicker();
    else if (open === 'feedback') this.feedbackSheet.open();
  }

  back() { window.history.back(); }

  goHelpTips() {
    this.router.navigate(['/help-tips']);
  }

  async openLangPicker() {
    this.langOpen.set(true);
    this.loadingLangs.set(true);
    await Promise.all([
      this.lang.fetchLanguages().catch(() => {}),
      this.lang.fetchEnabledLanguages().catch(() => {}),
    ]);
    this.loadingLangs.set(false);
  }

  closeLangPicker() { this.langOpen.set(false); }

  async selectLang(code: string) {
    await this.lang.setLanguage(code);
    this.langOpen.set(false);
  }

  lockNow() {
    this.biometric.lockSession();
  }

  openAutoLockPicker() {
    this.autoLockOpen.set(true);
  }

  closeAutoLockPicker() {
    this.autoLockOpen.set(false);
  }

  async selectAutoLock(minutes: number) {
    await this.biometric.setAutoLockMinutes(minutes);
    this.mixpanel.setAutoLockInterval(minutes);
    this.autoLockOpen.set(false);
  }

  async resetScanTour() {
    await this.scanOnboarding.reset();
    this.scanTourReset.set(true);
    setTimeout(() => this.scanTourReset.set(false), 2000);
  }

  async resetFilterTour() {
    await this.filterTour.reset();
    this.filterTourReset.set(true);
    setTimeout(() => this.filterTourReset.set(false), 2000);
  }

  async resetTips() {
    await this.tips.reset(this.auth.userId());
    this.tipsReset.set(true);
    setTimeout(() => this.tipsReset.set(false), 2000);
  }

  async logout() {
    this.loggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
