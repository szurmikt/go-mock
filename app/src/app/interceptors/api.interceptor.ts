import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { Config } from '../config/config';

let isRefreshing = false;

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const addHeaders = (request: HttpRequest<unknown>): HttpRequest<unknown> => {
    const headers: Record<string, string> = {
      'Api-Version': Config.API_VERSION,
      'App-Version': Config.APP_VERSION,
      'Ci-Version': Config.CI_VERSION,
      'Device-Id': auth.deviceId() || 'web-dev-device',
      'Lang': 'en',
    };

    const token = auth.accessToken();
    if (token) {
      headers['Token'] = token;
    }

    const property = auth.selectedProperty();
    if (property) {
      headers['Property-Id'] = String(property.property_id);
    }

    return request.clone({ setHeaders: headers });
  };

  const handleRefreshAndRetry = (
    request: HttpRequest<unknown>,
    handler: HttpHandlerFn,
  ) => {
    if (isRefreshing) {
      return handler(addHeaders(request));
    }

    isRefreshing = true;
    return from(auth.refreshAccessToken()).pipe(
      switchMap(() => {
        isRefreshing = false;
        return handler(addHeaders(request));
      }),
      catchError(err => {
        isRefreshing = false;
        auth.logout();
        router.navigateByUrl('/login', { replaceUrl: true });
        return throwError(() => err);
      }),
    );
  };

  if (auth.needsRefresh() && !isRefreshing) {
    return handleRefreshAndRetry(req, next);
  }

  return next(addHeaders(req)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        return handleRefreshAndRetry(req, next);
      }
      return throwError(() => err);
    }),
  );
};
