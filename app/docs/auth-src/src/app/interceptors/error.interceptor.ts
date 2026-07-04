import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import * as Sentry from '@sentry/angular';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) {
        console.error('[Network] Request failed:', req.url);
      } else if (err.status >= 500) {
        console.error(`[Server ${err.status}]`, req.url, err.message, err.error);
        Sentry.captureException(err, { extra: { url: req.url, status: err.status } });
      }
      return throwError(() => err);
    }),
  );
