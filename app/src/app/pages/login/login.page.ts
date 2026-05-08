import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent],
})
export class LoginPage {
  email = '';
  password = '';
  loading = false;
  lang = 'en';
  errorMessage = '';
  errorOpen = false;

  readonly languages = [
    { code: 'en', label: 'EN' },
    { code: 'hu', label: 'HU' },
    { code: 'de', label: 'DE' },
    { code: 'tr', label: 'TR' },
    { code: 'fr', label: 'FR' },
    { code: 'lv', label: 'LV' },
    { code: 'es', label: 'ES' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async submit(e: Event) {
    e.preventDefault();
    if (this.loading || !this.email.trim() || !this.password) return;

    this.loading = true;
    try {
      const { mfaToken } = await this.auth.login(this.email.trim(), this.password);
      await this.router.navigate(['/mfa'], { state: { mfaToken, email: this.email.trim() }, replaceUrl: true });
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

  private extractMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { errors?: string; message?: string } }).error;
      if (e?.errors) return e.errors;
      if (e?.message) return e.message;
    }
    return 'The email or password you entered is incorrect. Please check your credentials and try again.';
  }
}
