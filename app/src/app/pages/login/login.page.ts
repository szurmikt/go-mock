import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { ApiEnvironmentService } from '../../services/api-environment';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { OptionsService } from '../../services/options.service';
import { ReservationService } from '../../services/reservation';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent],
})
export class LoginPage implements OnDestroy {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  errorOpen = false;

  lang = inject(LanguageService);
  apiEnv = inject(ApiEnvironmentService);
  private res = inject(ReservationService);
  private options = inject(OptionsService);

  tapCounterMessage = signal<string | null>(null);
  private tapCount = 0;
  private tapResetTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  changeLang(event: Event) {
    const code = (event.target as HTMLSelectElement).value;
    this.lang.setLanguage(code);
  }

  async submit(e: Event) {
    e.preventDefault();
    if (this.loading || !this.email.trim() || !this.password) return;

    this.loading = true;
    try {
      const { mfaToken } = await this.auth.login(
        this.email.trim(),
        this.password,
      );
      await this.router.navigate(['/mfa'], {
        state: { mfaToken, email: this.email.trim() },
        replaceUrl: true,
      });
    } catch (err: unknown) {
      this.errorMessage = this.extractMessage(err);
      this.errorOpen = true;
    } finally {
      this.loading = false;
    }
  }

  dismissError() {
    this.errorOpen = false;
  }

  async onSecretTap() {
    clearTimeout(this.tapResetTimer);
    this.tapCount++;
    const targetMode = this.apiEnv.isTest() ? 'Live' : 'Test';
    const remaining = 7 - this.tapCount;

    if (this.tapCount >= 7) {
      this.tapCount = 0;
      this.tapCounterMessage.set(null);
      const next = this.apiEnv.isTest() ? 'live' : 'test';
      await this.auth.logout();
      this.res.clear();
      this.options.clear();
      await this.apiEnv.setMode(next);
      return;
    }
    if (this.tapCount >= 4) {
      this.tapCounterMessage.set(
        `${remaining} more tap${remaining === 1 ? '' : 's'} to switch to ${targetMode} Mode`,
      );
    }
    this.tapResetTimer = setTimeout(() => {
      this.tapCount = 0;
      this.tapCounterMessage.set(null);
    }, 2000);
  }

  ngOnDestroy() {
    clearTimeout(this.tapResetTimer);
  }

  private extractMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { errors?: string; message?: string } })
        .error;
      if (e?.errors) return e.errors;
      if (e?.message) return e.message;
    }
    return 'The email or password you entered is incorrect. Please check your credentials and try again.';
  }
}
