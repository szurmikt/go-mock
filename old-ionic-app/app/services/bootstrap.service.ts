import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { Platform } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { LanguageService } from 'src/app/services/languages/language.service';
import { OptionsService } from 'src/app/services/options.service';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { StorageService } from 'src/app/services/storage.service';
// import { RegulaService } from 'src/app/services/regula.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BootstrapService {
  router: Router = inject(Router);
  platform = inject(Platform);
  authService: AuthService = inject(AuthService);
  userService: UserService = inject(UserService);
  languageService: LanguageService = inject(LanguageService);
  optionsService: OptionsService = inject(OptionsService);
  localStorage: StorageService = inject(StorageService);
  // regulaService = inject(RegulaService);
  docuscanService = inject(DocuscanService);

  loading = false;
  logData: string[] = [];

  firstPage = 'reservations';

  public bootstrapBS: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );

  constructor() {
    // this.init();
  }

  init() {
    console.log('BootstrapService init()');
    // console.trace(new Error().stack?.split('\n')[2]?.trim().split(' ')[1]);
    const authToken = this.authService.getToken();
    const expiresAt = this.authService.getExpiresAt();
    // console.log('authToken', authToken);
    // console.log('expiresAt', expiresAt);

    this.platform.ready().then((_) => {
      this.log('Platform Ready');
      this.authService.onReady().then(() => {
        this.log('AuthService Ready');
        this.languageService.onReady().then(() => {
          this.log('LanguageService Ready');
          console.log(
            'AppComponent initApp languageService.getLanguages()',
            this.languageService.languages,
          );
          if (authToken && expiresAt && new Date() < new Date(expiresAt)) {
            // this.router.navigate([this.firstPage]).then();
            this.initApp();
          } else {
            const refreshToken = this.authService.getRefreshToken();
            // console.log('refreshToken', refreshToken);

            if (refreshToken) {
              this.log('Refresh AccessToken');
              this.authService.generateNewToken().subscribe({
                next: (response) => {
                  this.log('Token Refreshed');
                  console.log(
                    'BootstrapService refreshToken authService.generateNewToken response',
                    response,
                  );
                  // this.router.navigate([this.firstPage]).then();
                  this.initApp();
                },
                error: (error) => {
                  console.log(
                    'BootstrapService refreshToken authService.generateNewToken error',
                    error,
                  );
                  this.log('Token Refresh Failed');
                  this.log('Navigate to Login');
                  this.doLogout();
                },
              });
            } else {
              this.log('Navigate to Login');
              this.doLogout();
            }
          }
        });
      });
    });
  }

  isInitialized() {
    if (!this.optionsService.isLoaded()) {
      return false;
    }
    if (!this.docuscanService.isLoaded()) {
      return false;
    }
    if (!this.userService.isLoaded()) {
      return false;
    }
    if (!this.languageService.isLoaded()) {
      return false;
    }
    // if (!this.regulaService.isRegulaDBLoaded) {
    //   return false;
    // }
    return true;
  }

  initApp() {
    this.userService.loadUser().then(() => {
      this.log('User Loaded');
      this.userService.loadProperty().then(async () => {
        this.log('Properties Loaded');
        await this.optionsService.load();
        await this.docuscanService.load();
        let props = await this.userService.loadProperties();
        console.log('userService.loadProperties props', props);

        let opt = this.optionsService.get();
        let fields = this.docuscanService.get();

        console.log('BootstrapService opt', opt);
        console.log('BootstrapService fields', fields);
        this.log('Options Loaded');
        this.loading = false;
        this.bootstrapBS.next(true);
        // this.regulaService.initRegulaDB().subscribe((dbStatus) => {
        //   this.log('initRegulaDB');
        //   console.log(
        //     'BootstrapService regulaService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
        //     dbStatus,
        //   );
        //   if (this.regulaService.checkIsRegulaDBLoaded(dbStatus)) {
        //     this.log('checkIsRegulaDBLoaded');
        //     console.log(
        //       'BootstrapService regulaService.checkIsRegulaDBLoaded(dbStatus) TRUE',
        //     );
        //     if (this.regulaService.isRegulaSDKInitialized) {
        //       this.regulaService.initRegulaSDK().then((_) => {
        //         this.log('initRegulaSDK');
        //         this.localStorage
        //           .setLocalData('lastCheckedRegulaDB', new Date().getTime())
        //           .then(() => {
        //             this.localStorage
        //               .getLocalData('lastCheckedRegulaDB')
        //               .then();
        //             // this.initialized = true;
        //             this.loading = false;
        //             this.bootstrapBS.next(true);
        //             // this.router.navigate(['dashboard']).then();
        //           });
        //       });
        //     } else {
        //       console.log(
        //         'BootstrapService isRegulaSDKInitialized TRUE',
        //         this.optionsService.get(),
        //       );
        //       this.loading = false;
        //       this.bootstrapBS.next(true);
        //     }
        //   } else {
        //     console.log(
        //       'BootstrapService regulaService.checkIsRegulaDBLoaded(dbStatus) FALSE',
        //     );
        //     // this.initialized = true;
        //   }
        // });
        this.platform.ready().then((_) => {});
      });
    });
  }

  doLogout() {
    this.userService.logout().subscribe({
      next: (_) => {
        this.router.navigate(['login']).then();
      },
      error: (error) => {},
    });
  }

  log(s: string) {
    this.logData.unshift(s);
  }

  getOptions() {
    return this.optionsService.get();
  }
  getFieldsToScan() {
    return this.docuscanService.get();
  }
  getUser() {
    return this.userService.getUser();
  }
  getProperty() {
    return this.userService.getProperty();
  }
  getProperties() {
    return this.userService.getProperties();
  }
  getLanguages() {
    return this.languageService.languages;
  }
  getTranslations() {
    return this.languageService.translations;
  }
  getCurrentLanguage() {
    return this.languageService.currentLanguage;
  }
}
