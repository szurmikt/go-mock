/** angular */
import { inject, Injectable } from '@angular/core';

/** capacitor */
import { Device, DeviceId, DeviceInfo } from '@capacitor/device';

/** services */
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { catchError, Observable, of, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _accessToken: string = '';
  private _refreshToken: string = '';
  private _expiresAt: number = 0;
  private _uuID: DeviceId | null = null;
  private _device: DeviceInfo | null = null;
  private _scope = '';

  private tokenRefreshing = false;

  constructor(
    private api: ApiService = inject(ApiService),
    private storage: StorageService, // // private localStorage: LocalStorageService, // private api: ApiService
  ) {}

  onReady(): Promise<any> {
    if (
      this._device &&
      this._uuID &&
      this._accessToken &&
      this._refreshToken &&
      this._expiresAt &&
      this._scope
    ) {
      return new Promise(async (resolve) => {
        resolve(true);
      });
    }

    return new Promise(async (resolve) => {
      this._device = await Device.getInfo();
      this._uuID = await Device.getId();
      this._accessToken = await this.storage.getLocalData('accessToken');
      this._refreshToken = await this.storage.getLocalData('refreshToken');
      this._expiresAt = await this.storage.getLocalData('expiresAt');
      this._scope = await this.storage.getLocalData('scope');
      // console.log('this._accessToken', this._accessToken);
      // console.log('this._refreshToken', this._refreshToken);
      // console.log('this._expiresAt', this._expiresAt);

      resolve(true);
    });
  }

  setToken(authData: any) {
    this._accessToken = authData.accessToken;
    this._refreshToken = authData.refreshToken;
    this._expiresAt = authData.expiresAt;
    this._scope = authData.scope;
    // console.log('AuthService setToken token', this._accessToken);
    // console.log('AuthService setToken getToken()', this.getToken());
    this.storage.setLocalData('scope', this._scope).then();
    this.storage.setLocalData('accessToken', this._accessToken).then();
    this.storage.setLocalData('refreshToken', this._refreshToken).then();
    this.storage.setLocalData('expiresAt', this._expiresAt).then();
  }

  async isAuthenticated(): Promise<Observable<boolean>> {
    this._accessToken = await this.storage.getLocalData('accessToken');
    this._refreshToken = await this.storage.getLocalData('refreshToken');
    this._expiresAt = await this.storage.getLocalData('expiresAt');
    // console.log('isAuthenticated this._accessToken', this._accessToken);
    // console.log('isAuthenticated this._expiresAt', this._expiresAt);
    // console.log('isAuthenticated this._refreshToken', this._refreshToken);

    const now = new Date();
    if (
      this._accessToken != null &&
      this._accessToken !== '' &&
      now.getTime() < this._expiresAt
    ) {
      return of(true);
    } else if (this._refreshToken != null && this._refreshToken !== '') {
      return new Observable<any>((observer) => {
        this.generateNewToken().subscribe({
          next: (response: any) => {
            console.log(
              'AuthService isAuthenticated generateNewToken response',
              response,
            );

            if (response.success) {
              observer.next(true);
            } else {
              observer.error('Failed to refresh token');
            }
            observer.complete();
          },
          error: (error) => {
            console.log('generateNewToken() error', error);

            observer.error(error);
            observer.complete();
          },
        });
      });
    } else {
      return of(false);
    }
  }

  getToken() {
    return this._accessToken;
  }

  getExpiresAt() {
    return this._expiresAt;
  }

  getRefreshToken() {
    return this._refreshToken;
  }

  removeToken() {
    this.storage.removeLocalData('accessToken').then();
    this.storage.removeLocalData('scope').then();
    this.storage.removeLocalData('refreshToken').then();
    this.storage.removeLocalData('expiresAt').then();
    this.storage.removeLocalData('authData').then();
  }

  getScope() {
    return this._scope;
  }

  hasScope(scope: string) {
    return this._scope != null && this._scope.includes(scope);
  }

  generateNewToken() {
    this.tokenRefreshing = true;
    return this.api
      .post('token', {
        grant_type: 'refresh_token',
        refresh_token: this._refreshToken,
      })
      .pipe(
        tap((response) => {
          console.log('generateNewToken response', response);
          const now = new Date();
          const expiresAt = now.getTime() + 1000 * response.data.expires_in;
          let _authData = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
            expiresAt: expiresAt,
            roles: response.data.roles,
          };
          this.storage.setLocalData('authData', _authData).then((_) => {});

          this.setToken(_authData);
          this.tokenRefreshing = false;
        }),
        catchError((err) => {
          this.removeToken();
          this.tokenRefreshing = false;
          return throwError(() => err);
        }),
      );
  }

  getUUID() {
    return this._uuID;
  }

  getDeviceInfo() {
    return this._device;
  }

  isTokenRefreshing() {
    return this.tokenRefreshing;
  }
}
