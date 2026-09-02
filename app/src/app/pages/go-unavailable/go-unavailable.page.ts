import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-go-unavailable',
  templateUrl: './go-unavailable.page.html',
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class GoUnavailablePage {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  // This screen is always reached via replaceUrl, so there's no prior route to pop back to —
  // "back" here means the same thing it does everywhere else in the app when access can't
  // proceed: log out and return to login (matches SettingsPage.logout()).
  async back() {
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}
