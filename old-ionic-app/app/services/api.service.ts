import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Config } from '../config/config';
import { ApiInterface } from '../models/api.interface';
import { delay, share, timeout } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { Events } from './event.service';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private static API_URL = Config.API_URL;
  private static API_URL_XANO = Config.API_URL_XANO;
  private _isDummyData = false;

  public get isDummyData() {
    return this._isDummyData;
  }

  public set isDummyData(isDummyData: boolean) {
    this._isDummyData = isDummyData;
  }

  // endpointMap: Map<string, string> = new Map([
  //   // ['login', ApiService.API_URL_XANO + 'InIBnNbl/auth/login'],
  //   ['token', ApiService.API_URL + 'token'],
  //   ['mfa', ApiService.API_URL + 'mfa'],
  //   ['user_by_id', 'https://x8ki-letl-twmt.n7.xano.io/api:InIBnNbl/userbyid'],
  //   [
  //     'accounts_by_userid',
  //     'https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/accounts_by_userid',
  //   ],
  //   [
  //     'widget_by_account',
  //     'https://x8ki-letl-twmt.n7.xano.io/api:xxtHSl_D/widgets',
  //   ],
  // ]);

  constructor(
    private http: HttpClient,
    private events: Events,
  ) {
    ApiService.chooseApiUrl();
    this.events.subscribe('api_changed', () => {
      ApiService.chooseApiUrl();
    });
  }

  private static toParams(params: any) {
    const pairs = [];

    for (const param in params) {
      if (params.hasOwnProperty(param)) {
        const key = encodeURIComponent(param);
        const value = encodeURIComponent(params[param]);
        pairs.push(key + '=' + value);
      }
    }

    if (pairs.length < 1) {
      return '';
    }

    return '?' + pairs.join('&');
  }

  private static chooseApiUrl() {
    ApiService.API_URL = Config.API_URL;
    ApiService.API_URL_XANO = Config.API_URL_XANO;
    if (Config.IS_DEV) {
      ApiService.API_URL = Config.DEV_API_URL;
      ApiService.API_URL_XANO = Config.DEV_API_URL_XANO;
    }
  }

  private static setHeaders(headers: any): HttpHeaders {
    return new HttpHeaders(headers);
  }

  private static apiSuffix(api: string) {
    if (api == 'auth') {
      return 'InIBnNbl';
    }
    return 'xxtHSl_D';
  }

  private static prepareUrl(action: string) {
    if (
      action.startsWith('/widgets') ||
      action.startsWith('/booking') ||
      action.startsWith('/accounts_by_userid')
    ) {
      return ApiService.API_URL_XANO + 'xxtHSl_D/' + action;
    } else if (action.startsWith('/userbyid')) {
      return ApiService.API_URL_XANO + 'InIBnNbl/' + action;
    } else {
      return ApiService.API_URL + '/' + action;
    }
  }

  get<T>(
    action: string,
    params: any = {},
    headers?: any,
  ): Observable<ApiInterface<T>> {
    let url: string = ApiService.prepareUrl(action);
    console.log('get url', url);

    // console.trace(new Error().stack?.split('\n')[2]?.trim().split(' ')[1]);

    return (
      this.http
        .get<ApiInterface<T>>(url + ApiService.toParams(params), {
          headers: ApiService.setHeaders(headers),
        })
        // .pipe(delay(5000))
        .pipe(timeout(10000), share())
    );
  }

  post<T>(
    action: string,
    body: any = {},
    headers?: any,
  ): Observable<ApiInterface<T>> {
    let url: string = ApiService.prepareUrl(action);
    return this.http
      .post<ApiInterface<T>>(url, body, {
        headers: ApiService.setHeaders(headers),
      })
      .pipe(timeout(10000), share());
  }

  put<T>(
    action: string,
    body: any = {},
    headers?: any,
  ): Observable<ApiInterface<T>> {
    let url: string = ApiService.prepareUrl(action);
    return this.http
      .put<ApiInterface<T>>(url, body, {
        headers: ApiService.setHeaders(headers),
      })
      .pipe(timeout(10000), share());
  }
}
