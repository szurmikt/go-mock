import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { AppVersionService } from '../../services/app-version';
import { BiometricService } from '../../services/biometric';
import { LiveUpdateService } from '../../services/live-update';
import { LanguageService } from '../../services/language.service';
import { FeedbackSheetComponent } from '../../components/feedback-sheet/feedback-sheet.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LOCK_DEBUG_PROPERTY_ID } from './lock-debug.const';
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [IonContent, FeedbackSheetComponent, TranslatePipe],
})
export class SettingsPage {
  loggingOut = signal(false);
  loadingLangs = signal(false);
  langOpen = signal(false);
  lang = inject(LanguageService);
  biometric = inject(BiometricService);

  private appVersionService = inject(AppVersionService);
  // Same source AppComponent already resolved at boot (AppVersionService.init()) — read
  // here rather than calling App.getInfo() a second time.
  appVersion = this.appVersionService.version;
  appBuild = this.appVersionService.build;

  // Which OTA bundle is actually running — with live updates, the native version alone no longer
  // identifies the running code, so this is what a support call needs.
  private liveUpdate = inject(LiveUpdateService);
  bundleId = this.liveUpdate.currentBundleId;
  copied = signal(false);

  /** Copy the full version triple — that's what's useful when debugging a specific hotel. */
  async copyDiagnostics(): Promise<void> {
    const text = `v${this.appVersion()} (${this.appBuild()}) · bundle ${this.bundleId()}`;
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

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  back() { window.history.back(); }

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

  async logout() {
    this.loggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
