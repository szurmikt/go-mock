import { Component, ErrorHandler, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { AuthService } from '../../services/auth';
import { BiometricService } from '../../services/biometric';
import { LanguageService } from '../../services/language.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [IonContent],
})
export class SettingsPage {
  loggingOut = signal(false);
  loadingLangs = signal(false);
  langOpen = signal(false);
  lang = inject(LanguageService);
  readonly isDev = !environment.production;
  private errorHandler = inject(ErrorHandler);

  appVersion = signal('');
  appBuild = signal('');

  constructor(
    public auth: AuthService,
    private biometric: BiometricService,
    private router: Router,
  ) {
    App.getInfo().then(info => {
      this.appVersion.set(info.version);
      this.appBuild.set(info.build);
    }).catch(() => {});
  }

  back() { window.history.back(); }
  lock() { this.biometric.lockSession(); }

  async openLangPicker() {
    this.langOpen.set(true);
    this.loadingLangs.set(true);
    await this.lang.fetchLanguages().catch(() => {});
    this.loadingLangs.set(false);
  }

  closeLangPicker() { this.langOpen.set(false); }

  async selectLang(code: string) {
    await this.lang.setLanguage(code);
    this.langOpen.set(false);
  }

  testSentry() {
    this.errorHandler.handleError(new Error('Sentry test — triggered manually from Settings'));
  }

  async logout() {
    this.loggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
