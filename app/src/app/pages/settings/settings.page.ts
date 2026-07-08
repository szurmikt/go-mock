import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { FeedbackSheetComponent } from '../../components/feedback-sheet/feedback-sheet.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
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

  appVersion = signal('');
  appBuild = signal('');

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {
    App.getInfo().then(info => {
      this.appVersion.set(info.version);
      this.appBuild.set(info.build);
    }).catch(() => {});
  }

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

  async logout() {
    this.loggingOut.set(true);
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
