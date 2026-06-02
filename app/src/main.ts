import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import mixpanel from 'mixpanel-browser';
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

// Mixpanel product analytics. localStorage persistence is reliable inside the
// Capacitor WebView (cookies are flaky on capacitor:// / file:// schemes).
mixpanel.init(environment.mixpanelToken, {
  // EU data residency — the project lives on eu.mixpanel.com, so events MUST go to
  // the EU ingestion host. Without this the SDK defaults to the US host and data
  // is silently dropped.
  api_host: 'https://api-eu.mixpanel.com',
  track_pageview: false,
  persistence: 'localStorage',
  debug: !environment.production,
});

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
