import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) {
        console.error('[Network] Request failed:', req.url);
      } else if (err.status >= 500) {
        console.error(`[Server ${err.status}]`, req.url, err.message, err.error);
      }
      return throwError(() => err);
    }),
  );
