import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, filter, take, from, switchMap, catchError, throwError } from 'rxjs';
import * as Sentry from '@sentry/angular';
import { AuthService } from '../services/auth';
import { Config } from '../config/config';
import { AppVersionService } from '../services/app-version';
import { LanguageService } from '../services/language.service';

const refreshing$ = new BehaviorSubject<boolean>(false);

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const appVersion = inject(AppVersionService);
  const lang = inject(LanguageService);
  const router = inject(Router);

  const addHeaders = (request: HttpRequest<unknown>): HttpRequest<unknown> => {
    const headers: Record<string, string> = {
      'Api-Version': Config.API_VERSION,
      'App-Version': appVersion.version(),
      'Ci-Version': Config.CI_VERSION,
      'Device-Id': auth.deviceId() || 'web-dev-device',
      'Lang': lang.currentLanguage(),
    };

    const token = auth.accessToken();
    if (token) headers['Token'] = token;

    const property = auth.selectedProperty();
    if (property) headers['Property-Id'] = String(property.property_id);

    return request.clone({ setHeaders: headers });
  };

  const refreshAndRetry = (request: HttpRequest<unknown>, handler: HttpHandlerFn) => {
    if (refreshing$.value) {
      // Another refresh is already in flight — wait for it, then retry with fresh headers
      return refreshing$.pipe(
        filter(v => !v),
        take(1),
        switchMap(() => handler(addHeaders(request))),
      );
    }

    refreshing$.next(true);
    return from(auth.refreshAccessToken()).pipe(
      switchMap(() => {
        refreshing$.next(false);
        return handler(addHeaders(request));
      }),
      catchError(err => {
        refreshing$.next(false);
        // Force logout when the refresh token itself is rejected — either a real HTTP 401,
        // or the tagged 'refresh_rejected' error auth.refreshAccessToken() throws when the
        // API rejects it the OTHER way it signals failure (HTTP 200, { success: false } —
        // same contract as login()). Without the second check, a dead refresh token that
        // isn't answered with a literal 401 was never caught here: needsRefresh() stays
        // true forever (expiresAt never advances), so every subsequent request re-entered
        // this same doomed refresh — a silent infinite retry loop surfacing to the user as
        // a generic "Network error" on every screen, with no way out except manually
        // logging out and back in.
        // Network errors, timeouts, and server errors are transient — keep the
        // stored session so the user can try again without re-logging in.
        const rejected =
          (err instanceof HttpErrorResponse && err.status === 401) ||
          (err as { kind?: string })?.kind === 'refresh_rejected';
        if (rejected) {
          Sentry.captureException(err, { tags: { context: 'token_refresh_rejected' } });
          auth.logout();
          router.navigateByUrl('/login', { replaceUrl: true });
        } else {
          Sentry.logger.warn('token refresh failed (transient)', {
            kind: err instanceof HttpErrorResponse ? `http_${err.status}` : 'network_error',
          });
        }
        return throwError(() => err);
      }),
    );
  };

  if (auth.needsRefresh() && !refreshing$.value) {
    return refreshAndRetry(req, next);
  }

  return next(addHeaders(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) return refreshAndRetry(req, next);
      return throwError(() => err);
    }),
  );
};
