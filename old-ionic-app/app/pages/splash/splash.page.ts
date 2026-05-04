import { Component, inject, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { IonSpinner } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { LanguageService } from 'src/app/services/languages/language.service';
import { OptionsService } from 'src/app/services/options.service';
import { Router } from '@angular/router';
import { DocuscanService } from 'src/app/services/docuscan.service';
import { StorageService } from 'src/app/services/storage.service';
// import { RegulaService } from 'src/app/services/regula.service';
import { BootstrapService } from 'src/app/services/bootstrap.service';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: true,
  imports: [IonSpinner, FormsModule],
})
export class SplashPage implements OnInit {
  bootstrapService = inject(BootstrapService);
  platform = inject(Platform);
  router: Router = inject(Router);
  authService: AuthService = inject(AuthService);
  userService: UserService = inject(UserService);
  languageService: LanguageService = inject(LanguageService);
  optionsService: OptionsService = inject(OptionsService);
  localStorage: StorageService = inject(StorageService);
  // regulaService = inject(RegulaService);
  docuscanService = inject(DocuscanService);

  loading = false;

  // initialized = false;

  logData: string[] = [];
  firstPage = 'reservations';

  constructor() {
    console.log('SplashPage constructor');
    this.loading = true;
  }

  ngOnInit() {
    console.log('SplashPage ngOnInit');
    this.log('Init');
    this.firstPage = this.bootstrapService.firstPage;
  }

  ionViewWillEnter() {
    console.log('SplashPage ionViewWillEnter');
    const authToken = this.authService.getToken();
    const expiresAt = this.authService.getExpiresAt();
    console.log('authToken', authToken);
    console.log('expiresAt', expiresAt);
    this.log('ViewWillEnter');
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
            this.router.navigate([this.firstPage]).then();
            this.initApp();
          } else {
            const refreshToken = this.authService.getRefreshToken();
            console.log('refreshToken', refreshToken);

            if (refreshToken) {
              this.log('Refresh AccessToken');
              this.authService.generateNewToken().subscribe({
                next: (response) => {
                  this.log('Token Refreshed');
                  console.log(
                    'SplashPage refreshToken authService.generateNewToken response',
                    response,
                  );
                  this.router.navigate([this.firstPage]).then();
                  this.initApp();
                },
                error: (error) => {
                  console.log(
                    'SplashPage refreshToken authService.generateNewToken error',
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
          // this.languageService.onReady().then(() => {
          //   //   this.optionsService.onReady().then(() => {
          //   // });
          // });
          // this.authService.onReady().then(() => {
          //   let token = this.authService.getToken();
          //   console.log(
          //     'SplashPage authservice.onReady authService.getToken() ',
          //     token
          //   );
          //   if (!token || token == '') {
          //     this.userService.logout().subscribe({
          //       next: (_) => {
          //         console.log(
          //           'SplashPage token=="" authservice.logout.next before navigate to login ',
          //           token
          //         );
          //         // this.router.navigate(['login']).then();
          //       },
          //       error: (error) => {},
          //     });
          //   } else {
          //     Promise.all([
          //       this.userService.loadUser(),
          //       this.userService.loadProperty(),
          //       this.userService.loadProperties(),
          //     ]).then((data) => {
          //       console.log('SplashPage token!="" Promise.all data', data);
          //       if (data.some((value) => !value)) {
          //         this.userService.logout().subscribe({
          //           next: (_) => {
          //             this.router.navigate(['login']).then();
          //           },
          //           error: (error) => {},
          //         });
          //       } else {
          //         // this.router.navigate(['dashboard']).then();
          //       }
          //     });
          //   }
          // });
        });
      });
    });
  }

  initApp() {
    this.userService.loadUser().then(() => {
      this.log('User Loaded');
      this.userService.loadProperty().then(async () => {
        this.log('Properties Loaded');
        await this.optionsService.load();
        await this.docuscanService.load();
        this.log('Options Loaded');
        // this.regulaService.initRegulaDB().subscribe((dbStatus) => {
        //   this.log('initRegulaDB');
        //   console.log(
        //     'sharedService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
        //     dbStatus,
        //   );
        //   if (this.regulaService.checkIsRegulaDBLoaded(dbStatus)) {
        //     this.log('checkIsRegulaDBLoaded');
        //     console.log('sharedService.checkIsRegulaDBLoaded(dbStatus) TRUE');
        //     this.regulaService.initRegulaSDK().then((_) => {
        //       this.log('initRegulaSDK');
        //       this.localStorage
        //         .setLocalData('lastCheckedRegulaDB', new Date().getTime())
        //         .then(() => {
        //           this.localStorage.getLocalData('lastCheckedRegulaDB').then();
        //           // this.initialized = true;
        //           this.loading = false;
        //           this.log('Navigate to dashboard');
        //           this.router.navigate(['dashboard']).then();
        //         });
        //     });
        //   } else {
        //     console.log('sharedService.checkIsRegulaDBLoaded(dbStatus) FALSE');
        //     // this.initialized = true;
        //   }
        // });
        this.platform.ready().then((_) => {});
        // let p = Promise.all([
        //   this.docuscanService.fetchScanFields(),
        //   this.optionsService.fetchOptions(),
        //   // this.widgetsService.getData(),
        // ])
        //   .then((data) => {
        //     // this.initialized = true;
        //     this.platform.ready().then((_) => {
        //       this.regulaService.initRegulaDB().subscribe((dbStatus) => {
        //         console.log(
        //           'sharedService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
        //           dbStatus,
        //         );
        //         if (this.regulaService.checkIsRegulaDBLoaded(dbStatus)) {
        //           console.log('sharedService.checkIsRegulaDBLoaded(dbStatus) TRUE');
        //           this.regulaService.initRegulaSDK().then((_) => {
        //             this.localStorage
        //               .setLocalData('lastCheckedRegulaDB', new Date().getTime())
        //               .then(() => {
        //                 this.localStorage
        //                   .getLocalData('lastCheckedRegulaDB')
        //                   .then();
        //                 // this.initialized = true;
        //                 this.loading = false;
        //                 this.router.navigate(['dashboard']).then();
        //               });
        //           });
        //         } else {
        //           console.log('sharedService.checkIsRegulaDBLoaded(dbStatus) FALSE');
        //           // this.initialized = true;
        //         }
        //       });
        //     });
        //   })
        //   .catch((e) => {
        //     console.log('e', e);
        //   });
        // console.log(p);
      });
      // this.userService.loadProperty().then(() => {
      //   this.optionsService.fetchOptions().then(() => {
      //     this.regulaService
      //       .initRegulaDB()
      //       .subscribe((dbStatus) => {
      //         console.log(
      //           'sharedService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
      //           dbStatus
      //         );

      //         if (this.sharedService.checkIsRegulaDBLoaded(dbStatus)) {
      //           console.log(
      //             'sharedService.checkIsRegulaDBLoaded(dbStatus) TRUE'
      //           );
      //           this.regulaService.initRegulaSDK().then((_) => {
      //             this.localStorage
      //               .setLocalData(
      //                 'lastCheckedRegulaDB',
      //                 new Date().getTime()
      //               )
      //               .then(() => {
      //                 this.localStorage
      //                   .getLocalData('lastCheckedRegulaDB')
      //                   .then();
      //                 this.initialized = true;
      //               });
      //           });
      //         } else {
      //           console.log(
      //             'sharedService.checkIsRegulaDBLoaded(dbStatus) FALSE'
      //           );
      //           this.initialized = true;
      //         }
      //       });
      //   });
      // });
    });
    // this.authService.isAuthenticated().then((obs) => {
    //   obs.subscribe((isAuth) => {
    //     console.log(
    //       'AppComponent initApp authService.isAuthenticated() isAuth',
    //       isAuth,
    //     );
    //     if (isAuth) {
    //       this.userService.loadUser().then(() => {
    //         this.userService.loadProperty().then(() => {
    //           let p = Promise.all([
    //             this.docuscanService.fetchScanFields(),
    //             this.optionsService.fetchOptions(),
    //             // this.widgetsService.getData(),
    //           ])
    //             .then((data) => {
    //               // this.initialized = true;
    //               this.regulaService.initRegulaDB().subscribe((dbStatus) => {
    //                 console.log(
    //                   'sharedService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
    //                   dbStatus,
    //                 );
    //                 if (this.regulaService.checkIsRegulaDBLoaded(dbStatus)) {
    //                   console.log(
    //                     'sharedService.checkIsRegulaDBLoaded(dbStatus) TRUE',
    //                   );
    //                   this.regulaService.initRegulaSDK().then((_) => {
    //                     this.localStorage
    //                       .setLocalData(
    //                         'lastCheckedRegulaDB',
    //                         new Date().getTime(),
    //                       )
    //                       .then(() => {
    //                         this.localStorage
    //                           .getLocalData('lastCheckedRegulaDB')
    //                           .then();
    //                         // this.initialized = true;
    //                         this.loading = false;
    //                         this.router.navigate(['dashboard']).then();
    //                       });
    //                   });
    //                 } else {
    //                   console.log(
    //                     'sharedService.checkIsRegulaDBLoaded(dbStatus) FALSE',
    //                   );
    //                   // this.initialized = true;
    //                 }
    //               });
    //             })
    //             .catch((e) => {
    //               console.log('e', e);
    //             });
    //           console.log(p);
    //         });
    //         // this.userService.loadProperty().then(() => {
    //         //   this.optionsService.fetchOptions().then(() => {
    //         //     this.regulaService
    //         //       .initRegulaDB()
    //         //       .subscribe((dbStatus) => {
    //         //         console.log(
    //         //           'sharedService.checkIsRegulaDBLoaded(dbStatus) dbStatus',
    //         //           dbStatus
    //         //         );

    //         //         if (this.sharedService.checkIsRegulaDBLoaded(dbStatus)) {
    //         //           console.log(
    //         //             'sharedService.checkIsRegulaDBLoaded(dbStatus) TRUE'
    //         //           );
    //         //           this.regulaService.initRegulaSDK().then((_) => {
    //         //             this.localStorage
    //         //               .setLocalData(
    //         //                 'lastCheckedRegulaDB',
    //         //                 new Date().getTime()
    //         //               )
    //         //               .then(() => {
    //         //                 this.localStorage
    //         //                   .getLocalData('lastCheckedRegulaDB')
    //         //                   .then();
    //         //                 this.initialized = true;
    //         //               });
    //         //           });
    //         //         } else {
    //         //           console.log(
    //         //             'sharedService.checkIsRegulaDBLoaded(dbStatus) FALSE'
    //         //           );
    //         //           this.initialized = true;
    //         //         }
    //         //       });
    //         //   });
    //         // });
    //       });
    //     } else {
    //       // this.initialized = true;
    //     }
    //   });
    // });
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
}
