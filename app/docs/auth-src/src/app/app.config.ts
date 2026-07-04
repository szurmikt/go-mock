import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, RouteReuseStrategy, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { apiInterceptor } from './interceptors/api.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { LanguageService } from './services/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor, apiInterceptor])),
    provideAppInitializer(() => inject(LanguageService).init()),
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    { provide: Sentry.TraceService, deps: [Router] },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
};
