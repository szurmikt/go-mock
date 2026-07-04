import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent } from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';
import { ApiEnvironmentService } from '../../services/api-environment';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { OptionsService } from '../../services/options.service';
import { ReservationService } from '../../services/reservation';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent, TranslatePipe],
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
      this.logLoginError(err);
      this.errorMessage = this.extractMessage(err);
      this.errorOpen = true;
    } finally {
      this.loading = false;
    }
  }

  /** Detailed diagnostics for a failed /token call — console + Sentry. */
  private logLoginError(err: unknown) {
    const detail: Record<string, unknown> = {
      apiMode: this.apiEnv.isTest() ? 'test' : 'live',
      apiUrl: this.apiEnv.apiUrl(),
    };
    if (err instanceof HttpErrorResponse) {
      detail['status'] = err.status;
      detail['statusText'] = err.statusText;
      detail['url'] = err.url;
      detail['name'] = err.name;
      detail['message'] = err.message;
      detail['errorBody'] = err.error;
      // status 0 ⇒ no HTTP response reached the app (CORS block / network / DNS / TLS)
      detail['likelyCause'] =
        err.status === 0
          ? 'No response reached the browser — CORS block, network, DNS, or TLS failure (not a credential error).'
          : 'Server responded with an HTTP error.';
    } else {
      detail['error'] = String(err);
      if (err && typeof err === 'object' && 'apiErrors' in err) {
        detail['apiErrors'] = (err as { apiErrors?: unknown }).apiErrors;
      }
    }
    console.error('Login failed', detail);
    Sentry.captureException(err, {
      tags: { context: 'login', api_mode: detail['apiMode'] as string },
      extra: detail,
    });
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

  /**
   * Pick a user-facing message by failure type — don't surface raw API internals.
   *   • no HTTP response reached the app (status 0 — network / CORS / DNS / TLS) → noInternet
   *   • credential rejection (API 200 {success:false}, thrown with apiErrors, or HTTP 401) → incorrect
   *   • anything else unexpected (e.g. 5xx) → generic
   * Keys live in the `login` namespace so they resolve pre-token (see translations.ts).
   */
  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return this.lang.t('login.errNoInternet');
    }
    if (
      (err instanceof HttpErrorResponse && err.status === 401) ||
      (err !== null && typeof err === 'object' && 'apiErrors' in err)
    ) {
      return this.lang.t('login.errIncorrect');
    }
    return this.lang.t('login.errGeneric');
  }
}
