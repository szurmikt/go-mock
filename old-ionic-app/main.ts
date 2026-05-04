import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptors,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { ApiInterceptor } from './app/services/api.interceptor';
import { AuthService } from './app/services/auth.service';
import { File } from '@awesome-cordova-plugins/file/ngx';

// import {
//   DocumentReader,
//   DocumentReaderCompletion,
//   Enum,
//   ScannerConfig,
//   ScenarioIdentifier,
//   DocumentReaderResults,
// } from '@regulaforensics/ionic-native-document-reader/ngx';

import { ApiService } from './app/services/api.service';
import { Events } from './app/services/event.service';
import { ModalService } from './app/services/modal.service';
import { PlatformService } from './app/services/platform.service';
import { SettingsService } from './app/services/settings.service';
import { StorageService } from './app/services/storage.service';
import { WidgetsService } from './app/services/widgets.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    Storage,
    AuthService,
    File,
    // DocumentReader,
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // provideHttpClient(withInterceptors([apiInterceptor]), withFetch()),
    // Events,
    // PlatformService,
    // ModalService,
    // StorageService,
    // ApiService,
    // UserService,
    // SettingsService,
    // WidgetsService,
  ],
});
