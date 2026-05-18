import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

Sentry.init({
  dsn: environment.sentryDsn,
  environment: environment.production ? 'production' : 'development',
  sendDefaultPii: true,
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
});

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
