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
  // consoleLoggingIntegration captures every console.warn/error app-wide — during local `ng serve`/
  // `ionic serve` testing that includes webpack-dev-server's own live-reload client (compile warnings,
  // WebSocket reconnect errors), which is dev-server noise, not app or scan diagnostics. Drop it here
  // rather than disabling console logging altogether, so real logs (e.g. the idscanly response) still
  // get through.
  beforeSendLog(log) {
    const message = typeof log.message === 'string' ? log.message : String(log.message);
    return message.includes('[webpack-dev-server]') ? null : log;
  },
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
