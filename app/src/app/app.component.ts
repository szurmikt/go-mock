import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    await this.auth.loadStoredAuth();

    if (this.auth.isAuthenticated()) {
      const hasProperty = this.auth.selectedProperty() !== null;
      await this.router.navigateByUrl(hasProperty ? '/home' : '/property-select', {
        replaceUrl: true,
      });
    } else {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
