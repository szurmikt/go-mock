/** angular */
import { inject, Injectable } from '@angular/core';

/** capacitor */
import { Device, DeviceInfo } from '@capacitor/device';

/** services */
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** rxjs */
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';

/** plugins */
import CryptoES from 'crypto-es';
import { AuthInterface, UserInterface } from '../models/user.interface';
import { AccountInterface } from '../models/account.interface';
import { PropertyInterface } from '../models/property.interface';
import { StorageService } from './storage.service';
import { LanguageService } from './languages/language.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  languageService: LanguageService = inject(LanguageService);
  private _uuid = '';
  private _user: UserInterface | undefined;

  private _property: PropertyInterface | undefined;
  private _properties: PropertyInterface[] = [];

  private _mfaToken = '';
  private _authData: AuthInterface | undefined;

  public userBS: BehaviorSubject<UserInterface | undefined> =
    new BehaviorSubject<UserInterface | undefined>(undefined);

  public propertyBS: BehaviorSubject<PropertyInterface | undefined> =
    new BehaviorSubject<PropertyInterface | undefined>(undefined);

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private storage: StorageService,
  ) {
    Device.getId().then((id) => {
      this._uuid = id.identifier;
    });
  }

  login(email: string, password: string): Promise<any> {
    const observer = this.api.post(
      'token',
      {
        username: email,
        password, //CryptoES.SHA512(password).toString(),
        device_id: this._uuid,
        grant_type: 'password',
        client_id: '366f7aff6d185668',
      },
      { 'Content-Type': 'application/json' },
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log('login response', response);

          if (!response.success) {
            reject(response.errors);
            return;
          }

          this._mfaToken = response.data.mfa_token;
          console.log('UserService login mfaToken: ', this._mfaToken);

          resolve(response);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  mfa(authCode: string): Promise<any> {
    const observer = this.api.post(
      'mfa/verify',
      {
        mfa_token: this._mfaToken,
        method: 'totp',
        code: authCode,
      },
      { 'Content-Type': 'application/json' },
    );

    return new Promise((resolve, reject) => {
      observer.subscribe({
        next: (response: any) => {
          console.log('mfa response', response);

          if (!response.success) {
            reject(response.errors);
            return;
          }
          const now = new Date();
          const expiresAt = now.getTime() + 1000 * response.data.expires_in;
          this._authData = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
            expiresAt: expiresAt,
            roles: response.data.roles,
          };
          this.storage.setLocalData('authData', this._authData).then((_) => {});

          this.authService.setToken(this._authData);

          resolve(this._authData);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  fetchProperties(): Observable<any> {
    console.log('fetchProperties');

    return new Observable<any>((observer) => {
      this.api.get('properties').subscribe({
        next: (propertiesResponse: any) => {
          console.log('propertiesResponse', propertiesResponse);
          this._properties = propertiesResponse.data;
          console.log('this._properties', this._properties);
          this.storage
            .setLocalData('properties', this._properties)
            .then((_) => {});
          observer.next(this._properties);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        },
      });
    });
  }

  setProperty(property_id: number): Promise<any> {
    console.log('setPropery this._properties', this._properties);

    this._property = this._properties.filter(
      (property: PropertyInterface) => property.property_id == property_id,
    )[0];
    console.log('this._property', this._property);

    this.propertyBS.next({
      property_id: this._property.property_id,
      property_name: this._property.property_name,
      property_company_name: this._property.property_company_name,
    });

    return this.storage.setLocalData('property', this._property);
  }

  loadProperty(): Promise<any> {
    return this.storage
      .getLocalData('property')
      .then((property: PropertyInterface) => {
        console.log('loadProperty property', property);
        if (property) {
          this.propertyBS.next(property);
        }
        this._property = property;
        return property;
      });
  }

  loadProperties(): Promise<any> {
    console.log('loadProperties this._properties', this._properties);

    if (this._properties != null && this._properties.length > 0) {
      console.log('loadProperties this._properties', this._properties);
      return new Promise((resolve) => {
        resolve(this._properties);
      });
    }
    return this.storage
      .getLocalData('properties')
      .then((properties: PropertyInterface[]) => {
        this._properties = properties;
        console.log('loadProperties getLocalData', this._properties);
        return properties;
      });
  }

  getProperty() {
    return this._property;
  }

  getPropertyId() {
    return this._property?.property_id;
  }

  getProperties() {
    return this._properties;
  }

  logout(): Observable<any> {
    this.authService.removeToken();
    this.storage.removeLocalData('user').then();
    this.storage.removeLocalData('property').then();
    this.storage.removeLocalData('properties').then();

    if (this._properties && this._properties.length > 0) {
      this._properties.forEach((acc: any) => {
        this.storage.removeLocalData('property_widgets_' + acc.id).then();
      });
    }

    this._user = undefined;
    this._property = undefined;
    this._properties = [];
    this.propertyBS.next(undefined);

    return of(true);
  }

  fetchUser(): Observable<any> {
    return new Observable<any>((observer) => {
      this.api.get('/users/me', {}).subscribe({
        next: (userResponse: any) => {
          console.log('this.api.get(/users/me) userResponse', userResponse);

          if (userResponse.success) {
            this._user = userResponse.data[0];
            this.storage.setLocalData('user', this._user).then((_) => {});
            observer.next(this._user);
            this.userBS.next({
              id: this._user!.id,
              name: this._user!.name,
              email: this._user!.email,
            });
          } else {
            observer.error('User not found');
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        },
      });
    });
  }

  loadUser(): Promise<any> {
    return this.storage.getLocalData('user').then((user: UserInterface) => {
      console.log('loadUser user', user);
      if (user) {
        this.userBS.next({
          id: user.id,
          name: user.name,
          email: user.email,
        });
      }
      this._user = user;
      return user;
    });
  }

  getUser() {
    return this._user;
  }

  getUserId() {
    return this._user?.id;
  }

  isLoaded() {
    console.log('UserService isLoaded this._properties', this._properties);

    return (
      this._user &&
      this._property &&
      this._properties &&
      this._properties.length > 0
    );
  }
}
