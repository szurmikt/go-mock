import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpHeaders,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import {
  async,
  BehaviorSubject,
  Observable,
  of,
  throwError,
  TimeoutError,
} from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceId, DeviceInfo } from '@capacitor/device';

import {
  catchError,
  filter,
  finalize,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';
import { Config } from '../config/config';
import { AuthService } from './auth.service';
import { Events } from './event.service';
import { ApiService } from './api.service';
import { LanguageService } from './languages/language.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class ApiInterceptor implements HttpInterceptor {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private userService = inject(UserService);
  private router = inject(Router);
  private events = inject(Events);
  private _token: string = '';
  private _refresh_token: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private _token_in_progress: boolean = false;
  private _uuID: DeviceId | null = null;
  private _device: DeviceInfo | null = null;

  private isRefreshing = false;

  constructor() {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    const authToken = this.authService.getToken();
    const expiresAt = this.authService.getExpiresAt();
    const isTokenRefreshing = this.authService.isTokenRefreshing();

    // console.log('ApiInterceptor authToken', authToken);

    if (this._device === null) {
      this._device = this.authService.getDeviceInfo();
    }

    let uuid = this.authService.getUUID();

    // console.log('ApiInterceptor this._device', this._device);
    // console.log('ApiInterceptor uuid', uuid);

    req = req.clone({
      setHeaders: {
        'Api-Version': Config.API_VERSION,
        'Device-Id': this.authService.getUUID()!.identifier,
        'App-Version': Config.APP_VERSION,
        Platform:
          this._device?.operatingSystem + ' (' + this._device?.osVersion + ')',
        'Device-Name':
          this._device?.manufacturer + '(' + this._device?.model + ')',
        'Ci-Version': Config.CI_VERSION,
        Lang: this.languageService.currentLanguage,
        'Property-Id': this.userService.getPropertyId()?.toString() || '',
      },
    });

    // console.log('ApiInterceptor req', req);

    const now = new Date();
    // console.log('expiresAt ', expiresAt, new Date(expiresAt).toString());
    // console.log(
    //   'expiresAt - diff',
    //   expiresAt - 3500 * 1000,
    //   new Date(expiresAt - 3500 * 1000).toString()
    // );
    // console.log(
    //   'now.getTime() ',
    //   now.getTime(),
    //   new Date(now.getTime()).toString()
    // );
    let timeLeft = (expiresAt - 3500 * 1000 - now.getTime()) / 1000;
    // console.log('time left', timeLeft);

    if (
      !isTokenRefreshing &&
      authToken &&
      expiresAt - 3590 * 1000 < now.getTime()
    ) {
      console.log('token is almost expired, call handle401Error');

      return this.handle401Error(req, next, 'pre');
    }

    if (authToken)
      req = req.clone({
        setHeaders: {
          Token: authToken,
        },
      });
    // return next.handle(req).pipe(
    //   tap(
    //     (event) => this.handleResponse(req, event),
    //     (error) => this.handleError(req, error)
    //   )
    // );
    return next.handle(req).pipe(
      catchError((err) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          // Try refresh if unauthorized
          return this.handle401Error(req, next, 'catchError');
        }
        return throwError(() => err);
      }),
    );
  }

  private handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler,
    from: string,
  ): Observable<HttpEvent<any>> {
    console.log(
      'handle401Error from: ',
      from,
      ' this.isRefreshing: ',
      this.isRefreshing,
    );

    if (!this.isRefreshing) {
      this.isRefreshing = true;

      return this.authService.generateNewToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          const newToken = this.authService.getToken();
          return next.handle(
            (req = req.clone({
              setHeaders: {
                Token: newToken,
              },
            })),
          );
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.authService.removeToken();
          this.router.navigate(['login']).then();
          return throwError(() => err);
        }),
      );
    } else {
      return throwError(() => new Error('Refresh in progress'));
    }
  }

  handleResponse(req: HttpRequest<any>, event: HttpEvent<any>) {
    this.apiService.isDummyData = false;
    if (event instanceof HttpResponse) {
      console.log(
        'Request for ',
        req.url,
        ' Response Status ',
        event.status,
        ' With body ',
        event.body,
      );
    }
  }

  handleError(req: HttpRequest<any>, event: { status: any; error: any }) {
    console.error(
      'Request for ',
      req.url,
      ' Response Status ',
      event.status,
      ' With error ',
      event.error,
    );
    this.apiService.isDummyData = false;
    if (event.status == 200 && event.error.includes('Fatal error')) {
      this.apiService.isDummyData = true;
    } else if (event.status == 401 || event.status == 403) {
    } else {
      this.authService.removeToken();
      this.router.navigate(['login']).then();
    }
  }
  // intercept(
  //   request: HttpRequest<any>,
  //   next: HttpHandler
  // ): Observable<HttpEvent<any>> {
  //   if (this._device === null) {
  //     this._device = this.authService.getDeviceInfo();
  //   }

  //   if (request.url === Config.API_URL || request.url === Config.DEV_API_URL) {
  //     return next
  //       .handle(request)
  //       .pipe(catchError((error) => throwError(error)));
  //   }

  //   request = request.clone({
  //     setHeaders: {
  //       'Api-Version': Config.API_VERSION,
  //       'Device-Id': this.authService.getUUID()?.identifier ?? '',
  //       'App-Version': Config.APP_VERSION,
  //       Platform:
  //         this._device?.operatingSystem + ' (' + this._device?.osVersion + ')',
  //       'Device-Name':
  //         this._device?.manufacturer + '(' + this._device?.model + ')',
  //       'Ci-Version': Config.CI_VERSION,
  //     },
  //   });

  //   this._token = this.authService.getToken();
  //   if (this._token) {
  //     request = request.clone({
  //       setHeaders: {
  //         // 'User-Token': this._token,
  //         Token: this._token,
  //       },
  //     });
  //   }

  //   return next.handle(request).pipe(
  //     tap((evt) => {
  //       if (evt instanceof HttpResponse) {
  //         this.checkForUpdate(evt);
  //       }
  //     }),
  //     catchError((error) => {
  //       if (error instanceof HttpErrorResponse) {
  //         if (error && error.status === 401) {
  //           if (this._token_in_progress) {
  //             return this._refresh_token.pipe(
  //               filter((result) => result !== null),
  //               take(1),
  //               switchMap(() =>
  //                 next.handle(this.addAuthenticationToken(request))
  //               )
  //             );
  //           } else {
  //             this._token_in_progress = true;
  //             this._refresh_token.next(null);
  //             return this.authService.generateNewToken().pipe(
  //               switchMap((response: any) => {
  //                 if (response.success) {
  //                   if (response.data.hasOwnProperty('token')) {
  //                     this.authService.setToken(
  //                       response.data['token'],
  //                       response.data['refresh_token'],
  //                       response.data['scope']
  //                     );
  //                     this._token = response.data['token'];
  //                     this._refresh_token.next(response.data['refresh_token']);
  //                     return this.retryCall(request, next);
  //                   }
  //                 } else {
  //                   // retry true
  // this.authService.removeToken();
  // this.router.navigate(['login']).then();
  //                 }
  //                 return of([]);
  //               }),
  //               finalize(() => (this._token_in_progress = false))
  //             );
  //           }
  //         } else {
  //           return this.retryCall(request, next);
  //         }
  //       } else if (error instanceof TimeoutError) {
  //         return this.retryCall(request, next);
  //       } else {
  //         return throwError(error);
  //       }
  //     })
  //   );
  // }

  private addAuthenticationToken(request: HttpRequest<any>): HttpRequest<any> {
    if (!this._token) {
      return request;
    }

    return request.clone({
      setHeaders: {
        // 'User-Token': this._token,
        Token: this._token,
      },
    });
  }

  private retryCall(
    request: HttpRequest<any>,
    next: HttpHandler,
    doneRetrying: boolean = false,
  ) {
    return next.handle(this.addAuthenticationToken(request)).pipe(
      tap((retryEvt) => {
        if (retryEvt instanceof HttpResponse) {
          this.checkForUpdate(retryEvt);
        }
      }),
      catchError((retryError) => {
        if (!doneRetrying) {
          this.retryCall(request, next, true);
        } else {
          // this.authService.removeToken();
          // this.router.navigate(['login']);
          return throwError(retryError);
        }
        return of([]);
      }),
    );
  }

  private checkForUpdate(event: HttpResponse<any>) {
    let api_version: string | null = '1.0';
    if (event.headers != null) {
      api_version = event.headers.get('accept_api_version');
    }
    if (
      event != null &&
      event.body &&
      api_version != null &&
      api_version > Config.API_VERSION
    ) {
      if (event.body.errors[0]['ret_code'] == 1003) {
        // this.authService.removeToken();
        this.events.publish('update-required', event.body.errors[0]);
      }
    }
  }
}
