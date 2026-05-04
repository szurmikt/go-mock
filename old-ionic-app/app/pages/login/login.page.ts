import { Router } from '@angular/router';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

/** capacitor */
import { Keyboard } from '@capacitor/keyboard';

/** components */
// import { ProviderListComponent } from "../../components/provider-list/provider-list.component";

/** config */
import { Config } from '../../config/config';

/** ionic */
import { AlertController } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonInput,
  IonFooter,
  IonRow,
  IonGrid,
  IonCol,
  ModalController,
  IonSpinner,
} from '@ionic/angular/standalone';
import { NgClass, AsyncPipe } from '@angular/common';

/** interfaces */
import { ApiInterface } from '../../models/api.interface';

/** services */
import { Events } from '../../services/event.service';
import { UserService } from '../../services/user.service';
import { ModalService } from '../../services/modal.service';
import { StorageService } from 'src/app/services/storage.service';
import { PlatformService } from 'src/app/services/platform.service';
import { PropertyInterface } from 'src/app/models/property.interface';
import { forkJoin } from 'rxjs';
import { OptionsService } from 'src/app/services/options.service';
import { TranslatePipe } from 'src/app/pipes/translate.pipe';
import { LanguageSwitcherComponent } from 'src/app/components/language-switcher/language-switcher.component';
import { LanguageService } from 'src/app/services/languages/language.service';

import { File, FileEntry } from '@awesome-cordova-plugins/file/ngx';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    IonSpinner,
    IonCol,
    IonGrid,
    IonRow,
    IonFooter,
    IonInput,
    IonContent,
    IonButton,
    NgClass,
    TranslatePipe,
    LanguageSwitcherComponent,
    AsyncPipe
],
})
export class LoginPage implements OnInit, OnDestroy {
  alertCtrl = inject(AlertController);
  userService = inject(UserService);
  optionsService = inject(OptionsService);
  languageService = inject(LanguageService);
  modalService = inject(ModalService);
  modalCtrl = inject(ModalController);
  events = inject(Events);
  platform = inject(PlatformService);
  storage = inject(StorageService);
  router = inject(Router);
  cd = inject(ChangeDetectorRef);

  startTap = 0;
  isDev = Config.IS_DEV;
  // email: string = 'john@sabeeapp.com';
  // password: string = 'pwd001';
  email: string = ''; //csaba@szurmik.com
  password: string = '';
  showFooter: boolean = true;

  loginStep = 1;
  authCode = '';

  properties: PropertyInterface[] = [];
  filteredProperties: PropertyInterface[] = [];
  currentProperty: PropertyInterface | undefined;

  showSuperAdminSearch = true;

  loading = false;

  @ViewChild('authCodeRef', { read: ElementRef, static: false })
  authCodeRef!: ElementRef;

  version = Config.APP_VERSION;

  trHash = 0;

  constructor(private file: File) {
    // public userService: UserService,
    // Keyboard.addListener('keyboardWillShow', (info) => {
    //   this.showFooter = false;
    //   this.cd.detectChanges();
    // });
    // Keyboard.addListener('keyboardDidHide', () => {
    //   this.showFooter = true;
    //   this.cd.detectChanges();
    // });
    // let translation = this.languageService.translations;
    // console.log('translation', translation);
    // this.languageService.translationBS.subscribe((translations: any) => {
    //   console.log(
    //     'LoginPage languageService.translationBS translations',
    //     translations
    //   );
    // });
  }

  ngOnInit() {
    console.log('LoginPage ngOnInit');

    let translations = this.languageService.translations;
    let languages = this.languageService.languages;
    if (!translations || !languages || languages.length == 0) {
      this.router.navigate(['']).then();
    }

    // this.languageService.translationBS.subscribe((translations: any) => {
    //   console.log(
    //     'LoginPage languageService.translationBS translations',
    //     translations,
    //   );
    //   // this.cd.markForCheck();
    //   this.trHash = Math.random();
    // });
  }

  ngOnDestroy() {
    this.loginStep = 1;
  }

  ionViewWillEnter() {
    // this.email = 'john@sabeeapp.com';
    // this.password = 'pwd001';
    // this.file.onload = (evt) => {
    //   let data = (evt.target as FileReader).result as string;
    //   data = data.substring(data.indexOf(',') + 1);
    //   console.log(data);
    // };
    // this.file
    //   .resolveDirectoryUrl(this.file.applicationDirectory + dirPath)
    //   .then((dir) => {
    //     this.file.getFile(dir, fileName, {}).then((fileEntry: FileEntry) => {
    //       console.log('fileEntry:', fileEntry);
    //       fileEntry.file((file) => {
    //         console.log('file:', file);
    //         const reader = LoginPage.getFileReader();
    //         reader.readAsDataURL(file);
    //         reader.onload = (evt) => {
    //           let data = (evt.target as FileReader).result as string;
    //           data = data.substring(data.indexOf(',') + 1);
    //           console.log(data);
    //         };
    //         reader.readAsDataURL(file);
    //       });
    //     });
    //   })
    //   .catch((err) => {
    //     console.error('<!> _readFile error: ', err);
    //   });
  }
  ionViewDidLeave() {
    this.loginStep = 1;
  }

  fill() {
    this.email = 'csaba@szurmik.com';
    this.password = 'BaddPsv9rd63!';

    let dirPath = '';
    let fileName = 'regula.license';
    const path = this.file.applicationDirectory + 'www/regula.license';
    console.log('ogin fill()  path', path);
    this.file
      .resolveLocalFilesystemUrl(path)
      .then((fileEntry) => {
        console.log(
          'login fill() resolveLocalFilesystemUrl fileEntry',
          fileEntry,
        );
        console.log(fileEntry.nativeURL);
        (fileEntry as FileEntry).file((file) => {
          const reader = LoginPage.getFileReader();
          // reader.readAsDataURL(file);
          reader.onload = (evt) => {
            let data = (evt.target as FileReader).result as string;
            data = data.substring(data.indexOf(',') + 1);
            console.log(data);
          };
          reader.readAsDataURL(file);
        });
        // this.file
        //   .readAsDataURL(this.file.applicationDirectory + dirPath, fileName)
        //   .then((result: any) => {
        //     console.log('readAsDataURL result', result);
        //   })
        //   .catch((err) => {
        //     console.error('<!> _readFile error: ', err);
        //   });
        // fileEntry.file((file) => {
        //     const reader = RegulaService.getFileReader();
        //     reader.readAsDataURL(file);
        //     reader.onload = (evt) => {
        //       let data = (evt.target as FileReader).result as string;
        //       data = data.substring(data.indexOf(',') + 1);
        //       callback(data, items);
        //     };
        //     reader.readAsDataURL(file);
        //   });
      })
      .catch((err) => {
        console.log('login fill() resolveLocalFilesystemUrl error', err);
      });
  }

  login() {
    if (
      this.email !== '' &&
      this.validateEmail(this.email) &&
      this.password !== ''
    ) {
      console.log('call userService.login');
      this.loading = true;
      this.userService.login(this.email, this.password).then(
        (response: any) => {
          this.email = '';
          this.password = '';
          this.loading = false;
          console.log('userService.login response', response);

          if (!response.success) {
            this.showLoginError('Login error');
          } else {
            this.loginStep = 2;
            setTimeout(() => {
              this.authCodeRef.nativeElement.classList.add('has-focus');
              this.authCodeRef.nativeElement.classList.add('label-floating');
              this.authCodeRef.nativeElement.click();
              this.authCodeRef.nativeElement.focus();
              this.authCodeRef.nativeElement.setFocus();
            }, 300);
          }
        },
        (loginError) => {
          this.loading = false;
          let errorMessage = '';
          if (loginError.ret_code !== '1010') {
            errorMessage = 'Wrong username or password!';
          }
          this.showLoginError('Login error', errorMessage);
          // this.logger.writeLog('FOM_APP', 'login_error', loginError);
        },
      );
    } else if (this.email !== '' && !this.validateEmail(this.email)) {
      this.loading = false;
      this.showLoginError('Login error', 'Invalid email address format!');
    } else {
      this.loading = false;
      this.showLoginError('Login error', 'Missing username or password!');
    }
  }

  mfa() {
    console.log('this.authCode', this.authCode);

    if (this.authCode !== '') {
      console.log('call userService.mfa');
      this.loading = true;
      this.userService.mfa(this.authCode).then(
        (response: any) => {
          console.log('userService.mfa response', response);
          this.userService.fetchProperties().subscribe({
            next: (propertiesResponse) => {
              if (propertiesResponse.length == 0) {
                this.authCode = '';
                this.loading = false;
                this.showLoginError(
                  'Error fetching properties data',
                  'No propery associated with this user.',
                );
              } else if (propertiesResponse.length == 1 && 1 > 2) {
                this.authCode = '';
                // this.loading = false;
                this.setProperty(propertiesResponse[0].property_id);
              } else {
                this.authCode = '';
                this.loading = false;
                this.loginStep = 3;
                this.properties = propertiesResponse;
                this.filteredProperties = [...this.properties];
              }
            },
            error: (propertiesError) => {
              console.log('propertiesError', propertiesError);
              this.showLoginError(
                'Error fetching properties data',
                propertiesError.error.message,
              );
            },
          });
        },
        (loginError) => {
          this.loading = false;
          let errorMessage = '';
          if (loginError.ret_code !== '1010') {
            errorMessage = 'Wrong authenticator code!';
          }
          this.showLoginError('Login error', errorMessage);
          // this.logger.writeLog('FOM_APP', 'login_error', loginError);
        },
      );
    } else {
      this.loading = false;
      this.showLoginError('Login error', 'Missing authenticator code!');
    }
  }

  showLoginError(title: string, message: string = '') {
    if (message == '')
      message =
        'Something went wrong, please try again or get in touch with our Support Team!';
    this.alertCtrl
      .create({
        header: title,
        message: message,
        buttons: [
          {
            text: 'Cancel',
          },
        ],
      })
      .then((alert) => {
        alert.present().then();
      });
  }

  setProperty(property_id: number) {
    this.userService.setProperty(property_id).then(
      (response: any) => {
        console.log('userService.setProperty response', response);
        forkJoin({
          user: this.userService.fetchUser(),
          options: this.optionsService.fetchOptions(),
        })
          // { google: object, microsoft: object, users: array }
          .subscribe({
            next: (forkJoinResponse) => {
              console.log('forkJoin response', forkJoinResponse);
              this.authCode = '';
              this.loading = false;
              this.router.navigate(['']).then();
            },
            error: (forkJoinError) => {
              console.log('forkJoinError', forkJoinError);
              this.loading = false;
              this.showLoginError(
                'Error fetching user data',
                forkJoinError.error.message,
              );
            },
          });
      },
      (loginError) => {
        this.loading = false;
        let errorMessage = '';
        if (loginError.ret_code !== '1010') {
          errorMessage = 'Wrong username or password!';
        }
        this.showLoginError('Login error', errorMessage);
        // this.logger.writeLog('FOM_APP', 'login_error', loginError);
      },
    );
  }

  touchStart() {
    this.startTap = new Date().getTime();
  }

  touchEnd() {
    const endTap = new Date().getTime();
    const diff = (endTap - this.startTap) / 1000;
    if (diff >= Config.API_CHANGE_TIMEOUT) {
      this.alertCtrl
        .create({
          header: 'What is the secret password?',
          inputs: [
            {
              name: 'password',
              type: 'password',
              placeholder: '',
              cssClass: 'passwordInput',
            },
          ],
          buttons: [
            {
              text: 'Cancel',
            },
            {
              text: 'Ok',
              handler: (data) => {
                if (data.password === Config.API_CHANGE_PASSWORD) {
                  this.changeApi();
                }
              },
            },
          ],
        })
        .then((alert) => {
          alert.present().then();
        });
    }
  }

  onAutoFill(param: string, event: any) {
    if (param === 'P') {
      this.password = event.target.value;
    }
    if (param === 'U') {
      this.email = event.target.value;
    }
    if (param === 'A') {
      this.authCode = event.target.value;
    }
  }

  private changeApi() {
    Config.IS_DEV = !Config.IS_DEV;
    this.events.publish('api_changed');
    this.isDev = Config.IS_DEV;
  }

  private validateEmail(email: string) {
    // eslint-disable-next-line max-len
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  changeProperty(property: PropertyInterface) {
    console.log('PropertylistComponent changeProperty');

    this.userService.setProperty(property.property_id);

    this.currentProperty = property;

    this.router.navigate(['']).then();
  }

  filterProperties(event: any) {
    const value = event.target.value;
    this.filteredProperties = [...this.properties];
    console.log('this.filteredProperties ', this.filteredProperties);

    if (value && value.trim() !== '') {
      this.filteredProperties = this.filteredProperties.filter((item) => {
        if (
          item.property_id != null &&
          item.property_name != '' &&
          item.property_name != null
        ) {
          return (
            item.property_id
              .toString()
              .toLowerCase()
              .indexOf(value.toLowerCase()) === 0 ||
            item.property_name
              .toString()
              .toLowerCase()
              .indexOf(value.toLowerCase()) === 0
          );
        }
        return 0;
      });
      if (this.filteredProperties.length == 1) {
        this.currentProperty = this.filteredProperties[0];
      }
    }
  }

  goToDashboard() {
    this.router.navigate(['dashboard']).then();
  }

  isiOS() {
    return this.platform.isiOS;
  }

  private static getFileReader(): FileReader {
    const fileReader = new FileReader();
    return (fileReader as any).__zone_symbol__originalInstance;
  }
}
