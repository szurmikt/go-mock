import { Component, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Events } from './services/event.service';
import { PlatformService } from './services/platform.service';
import { ModalService } from './services/modal.service';
import { Storage } from '@ionic/storage-angular';
import { StorageService } from './services/storage.service';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { SettingsService } from './services/settings.service';
import { WidgetsService } from './services/widgets.service';
import { App } from '@capacitor/app';

/** config */
import { OptionsService } from './services/options.service';
import { BiometricService } from './services/biometric.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
  providers: [
    Events,
    PlatformService,
    ModalService,
    Storage,
    StorageService,
    ApiService,
    SettingsService,
    WidgetsService,
    OptionsService,
  ],
})
export class AppComponent {
  platform = inject(Platform);
  router: Router = inject(Router);
  authService: AuthService = inject(AuthService);
  userService: UserService = inject(UserService);
  biometricService: BiometricService = inject(BiometricService);

  authenticated: boolean = false;
  diffLimit = 60 * 0.5;

  constructor() {
    App.addListener('appStateChange', async ({ isActive }) => {
      let now = new Date();
      if (!isActive) {
        localStorage.setItem('lastActive', now.getTime().toString());
      } else {
        console.log('this.authenticated', this.authenticated);
        await this.checkAuthentication();
        if (this.authenticated) {
          let lastActive = localStorage.getItem('lastActive');
          console.log('lastActive', lastActive);

          localStorage.removeItem('lastActive');
          if (lastActive) {
            let diff = now.getTime() - parseInt(lastActive);
            let diffSec = Math.floor(diff / 1000);
            console.log('Inactive seconds:', diffSec);
            if (diffSec >= this.diffLimit) {
              // more than 15 minutes inactive, log out the user
              this.biometricScan();
            }
          }
        }
      }
      console.log('App state changed. Is active?', isActive);
    });

    App.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data);
    });

    App.addListener('appRestoredResult', (data) => {
      console.log('App state changed Restored state:', data);
    });
  }

  async checkAuthentication() {
    await this.authService
      .isAuthenticated()
      .then((obs) => {
        obs.subscribe((isAuth) => {
          console.log('this.authService.isAuthenticated() isAuth', isAuth);

          this.authenticated = isAuth;
        });
      })
      .catch((err) => {
        console.error('Failed to get authentication observable', err);
      });
  }

  async biometricScan() {
    try {
      let isAvailable = await this.biometricService.checkBiometric();
      console.log('checkBiometric isAvailable', isAvailable);
      if (isAvailable) {
        let verified = await this.biometricService.verify();
        console.log('verify verified', verified);
        if (!verified) {
          this.userService.logout().subscribe({
            next: (_) => {
              this.router.navigate(['login']).then();
            },
            error: (error) => {},
          });
        }
      }
    } catch (error) {
      console.error('biometricScan failed', error);
    }
  }
}
