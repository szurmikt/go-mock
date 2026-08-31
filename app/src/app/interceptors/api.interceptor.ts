import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, filter, take, from, switchMap, catchError, throwError } from 'rxjs';
import * as Sentry from '@sentry/angular';
import { AuthService } from '../services/auth';
import { Config } from '../config/config';
import { AppVersionService } from '../services/app-version';
import { LanguageService } from '../services/language.service';
import { PropertyConfigService } from '../services/property-config.service';

const refreshing$ = new BehaviorSubject<boolean>(false);

/**
 * Decodes a JWT's payload segment (no signature verification, diagnostic-only). Refresh/access
 * tokens embed { data: { deviceID, userID } } directly — confirmed by decoding a real token
 * during the 2026-08-31 refresh-rejection investigation (see CLAUDE.md changelog) — so this lets
 * a rejected refresh's captured exception show the device id actually baked into that token,
 * compared against what's being sent now. This is what found the real cause: a stale refresh
 * token whose embedded device id no longer matched the device's current one.
 */
function decodeJwtDeviceId(token: string): { deviceID?: string; userID?: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const parsed = JSON.parse(json) as { data?: { deviceID?: string; userID?: number } };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const appVersion = inject(AppVersionService);
  const lang = inject(LanguageService);
  const router = inject(Router);
  const propertyConfig = inject(PropertyConfigService);

  const addHeaders = (request: HttpRequest<unknown>): HttpRequest<unknown> => {
    const headers: Record<string, string> = {
      'Api-Version': Config.API_VERSION,
      'App-Version': appVersion.version(),
      'Ci-Version': Config.CI_VERSION,
      'Device-Id': auth.deviceId() || 'web-dev-device',
      'Lang': lang.currentLanguage(),
    };

    // The refresh grant no longer goes through this interceptor at all (see
    // AuthService.performRefreshRequest() — raw fetch(), not HttpClient), so this only ever
    // runs for login (pre-auth, no token to send) and every other authenticated endpoint.
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
        // Force logout when the refresh token itself is rejected. AuthService.performRefreshRequest()
        // / refreshAccessToken() (raw fetch(), not HttpClient — see auth.ts) does the HTTP call and
        // classification itself now, throwing a tagged 'refresh_rejected' error for a real
        // rejection (confirmed 2026-08-31: the API answers with HTTP 403 { success: false,
        // errors: [...] }, not always a literal 401, and not the HTTP 200 { success: false }
        // shape login() uses) or an untagged Error for anything transient (network/5xx). Missing
        // this distinction previously left needsRefresh() stuck true forever (expiresAt never
        // advances), so every subsequent request re-entered the same doomed refresh — a silent
        // infinite retry loop surfacing to the user as a generic "Network error" on every screen,
        // with no way out except manually logging out and back in.
        const rejected = (err as { kind?: string })?.kind === 'refresh_rejected';

        // Device-id comparison — cheap, always on. This is what actually found the real cause
        // (2026-08-31, see CLAUDE.md changelog): a stale refresh token whose embedded device id
        // no longer matched the device's current one. Kept as permanent monitoring; the earlier
        // app-version comparison was ruled out and removed.
        const rawDeviceId = auth.deviceId();
        const currentDeviceId = rawDeviceId || 'web-dev-device';
        const tokenClaims = decodeJwtDeviceId(auth.refreshToken() ?? '');
        const tokenDeviceId = tokenClaims?.deviceID ?? 'undecodable';
        const diagnosticTags = {
          diag_current_device_id: currentDeviceId,
          diag_device_id_missing: String(!rawDeviceId),
          diag_token_embedded_device_id: tokenDeviceId,
          diag_token_device_id_mismatch:
            String(tokenDeviceId !== 'undecodable' && tokenDeviceId !== currentDeviceId),
        };

        // Full request/response capture — gated behind the same per-property extended_logging
        // flag IDScanly already uses (see review.page.ts logIdscanlyResponse()), not always-on:
        // useful for handing exact data to the API team while actively investigating, too much
        // to log unconditionally in production once that's done.
        const typedErr = err as { status?: number; body?: unknown; url?: string; message?: string };
        const extendedExtra = propertyConfig.extendedLogging()
          ? (() => {
              const sentRefreshValue = auth.refreshToken() ?? '';
              const sentHeaders: Record<string, string> = {
                'Api-Version': Config.API_VERSION,
                'App-Version': appVersion.version(),
                'Ci-Version': Config.CI_VERSION,
                'Device-Id': currentDeviceId,
                'Lang': lang.currentLanguage(),
                'Token': '[not sent — see auth.ts performRefreshRequest()]',
              };
              const currentProperty = auth.selectedProperty();
              if (currentProperty) sentHeaders['Property-Id'] = String(currentProperty.property_id);
              return {
                requestHeaders: sentHeaders,
                // Field names avoid the substring "token" — Sentry's PII scrubber redacts any
                // key containing it, which would hide even this length/prefix from the event.
                requestBody: {
                  grant_type: 'refresh_token',
                  refreshValueLen: sentRefreshValue.length,
                  refreshValuePrefix: sentRefreshValue.slice(0, 6),
                  refreshValueSuffix: sentRefreshValue.slice(-6),
                },
                response: {
                  status: typedErr.status ?? 0,
                  url: typedErr.url ?? 'unknown',
                  body: typedErr.body ?? { message: typedErr.message ?? String(err) },
                },
              };
            })()
          : undefined;

        if (rejected) {
          Sentry.captureException(err, {
            tags: { context: 'token_refresh_rejected', ...diagnosticTags },
            extra: extendedExtra,
          });
          auth.logout();
          router.navigateByUrl('/login', { replaceUrl: true });
        } else {
          Sentry.logger.warn('token refresh failed (transient)', {
            kind: `http_${typedErr.status ?? 0}`,
            ...diagnosticTags,
            ...extendedExtra,
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
