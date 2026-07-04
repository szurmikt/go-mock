# Auth Module Handoff — SabeeApp Go → standalone prototype

> Extracted from `/Users/tamas/SabeeAppGO/app` (Ionic 8 + Angular 20, standalone components) for reuse in a separate Ionic/Angular/Capacitor project. This is a reference snapshot, not a live link — copy what you need and adapt. Source file paths are given relative to this repo (`app/...`) in case you need to diff against the original later.

---

## 1. Flow summary

1. **Login (password step):** `POST {apiUrl}/token`
   Body: `{ username, password, device_id, grant_type: "password", client_id: 1070 }`
   Response: `{ success, data: { mfa_token }, errors }`
2. **2FA (TOTP-style 6-digit code):** `POST {apiUrl}/mfa/verify`
   Body: `{ mfa_token, method: "totp", code }`
   Response: `{ success, data: { access_token, refresh_token, expires_in, roles } }`
3. **Storage:** the resulting session object (`accessToken`, `refreshToken`, `expiresAt = Date.now() + expires_in*1000`, `roles`, `email`, `name`, `userId`) is JSON-stringified into `@capacitor/preferences` under key `authState`. One blob, not separate keys per field.
4. **Outgoing headers** (every request, via interceptor): `Token: <accessToken>` (custom header, **not** `Authorization: Bearer`), `Device-Id`, `Api-Version`, `App-Version`, `Ci-Version`, `Lang`, and — once a property/tenant is selected — `Property-Id`.
5. **Refresh:** proactive when `expiresAt - Date.now() < 5min` (`needsRefresh()`), or reactively on any `401`. Both paths call `POST {apiUrl}/token` with `{ grant_type: "refresh_token", refresh_token }`. Concurrent requests are deduped via a module-level `BehaviorSubject` lock so only one refresh fires; others wait then retry with fresh headers. A `401` on the refresh call itself triggers logout + redirect to `/login`.
6. **Current user:** `GET {apiUrl}/users/me` → `{ success, data: [{ user_id, name, email, role }] }` (array, takes `[0]`). Requires `Property-Id` header server-side.
7. **Logout:** clears in-memory signals + removes the three storage keys (`authState`, `selectedProperty`, `properties`). No server-side revocation call.

`{apiUrl}` is `environment.apiUrl` (prod) — this app also has a `testApiUrl` + a dev-only live/test switcher (`ApiEnvironmentService`), which is optional QA tooling, not core to the auth flow.

---

## 2. File manifest

| # | Original path | What it is | Port as-is? |
|---|---|---|---|
| 1 | `app/src/app/services/auth.ts` | Core `AuthService` — login, MFA verify, refresh, fetchUser, property select, logout, signal-based session state | Yes, minus the `ReservationService`/`DocuscanService`/`MixpanelService`/`LanguageService` side-effect calls (see §4) |
| 2 | `app/src/app/services/api.ts` | Generic `HttpClient` get/post/put wrapper | Optional — not auth-specific |
| 3 | `app/src/app/services/api-environment.ts` | Live/test API base-URL switcher (QA feature) | Optional — skip unless you need a test/live toggle |
| 4 | `app/src/app/services/storage.ts` | `@capacitor/preferences` wrapper — get/set/remove JSON blobs | Yes, as-is |
| 5 | `app/src/app/interceptors/api.interceptor.ts` | Functional interceptor — header injection + 401→refresh→retry + proactive refresh | Yes, core logic |
| 6 | `app/src/app/interceptors/error.interceptor.ts` | Generic error logging (Sentry on 5xx) | Optional — not auth-specific, drop the Sentry call if unused |
| 7 | `app/src/app/models/auth.interfaces.ts` | `AuthState`, `MfaTokenResponse`, `TokenResponse`, `ApiResponse<T>` | Yes, as-is |
| 8 | `app/src/app/config/config.ts` | `Config` constants — `CLIENT_ID`, version headers, storage keys (file also has unrelated document-scan constants) | Auth-relevant fields only — see §4 |
| 9 | `app/src/app/guards/auth.guard.ts` | `CanActivateFn` route guard | Yes, as-is |
| 10 | `app/src/app/pages/mfa/mfa.page.ts` | MFA/OTP screen — 6 separate digit inputs, auto-advance, auto-submit on 6th digit, paste support | Yes, logic; template/styles not included here |
| 11 | `app/src/app/pages/login/login.page.ts` | Login screen — email/password form | Core logic yes; strip the 7-tap test/live switch + Sentry/Mixpanel/translation wiring |
| 12 | `app/src/environments/environment.ts` | Dev env config | Only `apiUrl`/`testApiUrl` are relevant |
| 13 | `app/src/environments/environment.prod.ts` | Prod env config | Same |
| 14 | `app/src/app/app.config.ts` | Angular bootstrap — registers interceptors via `provideHttpClient(withInterceptors([...]))` | Reference only — wire into your own `app.config.ts` |

**Deliberately excluded** (app-shell/unrelated, per original request scope): `app-config.ts` (Supabase version-gate feature), `property-select` page, `biometric.ts` (session-lock, not login).

---

## 3. Full file contents

### 3.1 `app/src/app/services/auth.ts`

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { ApiEnvironmentService } from './api-environment';
import { ReservationService } from './reservation';
import { DocuscanService } from './docuscan';
import { MixpanelService } from './mixpanel';
import { LanguageService } from './language.service';
import {
  AuthState,
  ApiResponse,
  MfaTokenResponse,
  TokenResponse,
} from '../models/auth.interfaces';
import { PropertyInterface } from '../models/property.interface';

function sortPropertiesByCompany(props: PropertyInterface[]): PropertyInterface[] {
  const startsWithLetter = (s: string) => /^\p{L}/u.test(s);
  return [...props].sort((a, b) => {
    const ac = (a.property_company_name ?? '').trim();
    const bc = (b.property_company_name ?? '').trim();
    if (!ac && !bc) return 0;
    if (!ac) return 1;
    if (!bc) return -1;
    const aAlpha = startsWithLetter(ac);
    const bAlpha = startsWithLetter(bc);
    if (aAlpha !== bAlpha) return aAlpha ? 1 : -1;
    return ac.localeCompare(bc, undefined, { sensitivity: 'base', numeric: true });
  });
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _auth = signal<AuthState | null>(null);
  private _selectedProperty = signal<PropertyInterface | null>(null);
  private _properties = signal<PropertyInterface[]>([]);
  private _deviceId = signal<string>('');

  readonly isAuthenticated = computed(() => !!this._auth()?.accessToken);
  readonly accessToken = computed(() => this._auth()?.accessToken ?? null);
  readonly refreshToken = computed(() => this._auth()?.refreshToken ?? null);
  readonly roles = computed(() => this._auth()?.roles ?? []);
  readonly email = computed(() => this._auth()?.email ?? '');
  readonly name  = computed(() => this._auth()?.name  ?? '');
  readonly userId = computed(() => this._auth()?.userId ?? '');
  readonly selectedProperty = computed(() => this._selectedProperty());
  readonly properties = computed(() => this._properties());
  readonly deviceId = computed(() => this._deviceId());

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private env: ApiEnvironmentService,
    private reservations: ReservationService,
    private docuscan: DocuscanService,
    private mixpanel: MixpanelService,
    private lang: LanguageService,
  ) {}

  /**
   * The startup LanguageService.init() fetch runs unauthenticated (app initializer,
   * before loadStoredAuth), so the /languages API only returns the `login` namespace
   * then. Re-fetch once an access token exists to pull the full authenticated set.
   * Driven from here (not an effect inside LanguageService) to avoid the DI cycle
   * LanguageService → AuthService → ReservationService → LanguageService. Fire-and-forget.
   */
  private refreshTranslations(): void {
    this.lang.fetchLanguages().catch(() => {});
  }

  /**
   * Push the current staff user + active property to Mixpanel. No-ops until the
   * userId is known (it is backfilled by fetchUser after property selection).
   * Only the logged-in staff member's own identity is sent — never guest PII.
   */
  private identifyToMixpanel(): void {
    const auth = this._auth();
    if (!auth?.userId) return;
    const prop = this._selectedProperty();
    this.mixpanel.identify(auth.userId, {
      name: auth.name,
      email: auth.email,
      propertyId: prop?.property_id ?? undefined,
      propertyName: prop?.property_name ?? undefined,
      company: prop?.property_company_name ?? undefined,
    });
  }

  /**
   * Wipes all property-scoped reservation & guest data from memory.
   * Called on logout and whenever the active property changes, so data from
   * one property/session can never leak into another. Reservations and guests
   * are memory-only (no persisted storage key), so clearing the services is
   * sufficient — there is nothing to remove from device storage.
   */
  private clearSessionData(): void {
    this.reservations.clear();
    this.docuscan.clear();
  }

  async loadStoredAuth(): Promise<void> {
    await this.loadDeviceId();
    const auth = await this.storage.get<AuthState>(Config.STORAGE_AUTH_KEY);
    if (auth?.refreshToken) {
      this._auth.set(auth);
      // Cold start with a stored session — pull the full authenticated translation set.
      this.refreshTranslations();
    }
    const property = await this.storage.get<PropertyInterface>(Config.STORAGE_PROPERTY_KEY);
    if (property) {
      this._selectedProperty.set(property);
    }
    const properties = await this.storage.get<PropertyInterface[]>(Config.STORAGE_PROPERTIES_KEY);
    if (properties?.length) {
      this._properties.set(sortPropertiesByCompany(properties));
    }
    // Property-Id header is required by /users/me — fetch only after property is restored.
    // Also re-fetch when userId is missing so sessions authenticated before userId existed get it backfilled.
    if (auth?.accessToken && property && (!auth.name || !auth.userId)) {
      await this.fetchUser();
    }
  }

  async login(email: string, password: string): Promise<{ mfaToken: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<MfaTokenResponse>>(`${this.env.apiUrl()}/token`, {
        username: email,
        password,
        device_id: this._deviceId(),
        grant_type: 'password',
        // Same plain-integer client_id for both TEST and PROD (encryption removed).
        client_id: Config.CLIENT_ID,
      }),
    );
    // The API signals failures as HTTP 200 with { success: false, errors: [...] }.
    // Surface the real ret_msg so it reaches the login error handler / Sentry
    // instead of an opaque "cannot read mfa_token" TypeError.
    if (!res.success || !res.data?.mfa_token) {
      const apiErrors = res.errors as { ret_code?: number; ret_msg?: string }[] | undefined;
      const error = new Error(apiErrors?.[0]?.ret_msg ?? 'Login failed') as Error & { apiErrors?: unknown };
      error.apiErrors = res.errors;
      throw error;
    }
    return { mfaToken: res.data.mfa_token };
  }

  async verifyMfa(mfaToken: string, code: string, email: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<TokenResponse>>(`${this.env.apiUrl()}/mfa/verify`, {
        mfa_token: mfaToken,
        method: 'totp',
        code,
      }),
    );
    const { access_token, refresh_token, expires_in, roles } = res.data;
    await this.setAuth({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      roles,
      email,
      name: '',
      userId: '',
    });
    this.refreshTranslations();
    this.mixpanel.trackLogin();
  }

  async fetchUser(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<{ user_id: string; name: string; email: string; role: string }[]>>(
          `${this.env.apiUrl()}/users/me`,
        ),
      );
      const user = res.data?.[0];
      if (res.success && user?.name) {
        await this.setAuth({ ...this._auth()!, name: user.name, email: user.email, userId: user.user_id });
        this.identifyToMixpanel();
      }
    } catch {
      // Non-fatal — email is already stored, name stays empty
    }
  }

  async refreshAccessToken(): Promise<void> {
    const rt = this._auth()?.refreshToken;
    if (!rt) throw new Error('No refresh token');
    const res = await firstValueFrom(
      this.http.post<ApiResponse<TokenResponse>>(`${this.env.apiUrl()}/token`, {
        grant_type: 'refresh_token',
        refresh_token: rt,
      }),
    );
    const { access_token, refresh_token, expires_in } = res.data;
    await this.setAuth({
      ...this._auth()!,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    });
  }

  async loadProperties(): Promise<PropertyInterface[]> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<PropertyInterface[]>>(`${this.env.apiUrl()}/properties`),
    );
    const sorted = sortPropertiesByCompany(res.data);
    this._properties.set(sorted);
    await this.storage.set(Config.STORAGE_PROPERTIES_KEY, sorted);
    return sorted;
  }

  async selectProperty(property: PropertyInterface): Promise<void> {
    // Switching to a different property must not carry over the previous
    // property's reservations/guests (would otherwise survive the 60s fetch
    // staleness window and render under the new property).
    if (this._selectedProperty()?.property_id !== property.property_id) {
      this.clearSessionData();
    }
    this._selectedProperty.set(property);
    await this.storage.set(Config.STORAGE_PROPERTY_KEY, property);
    if (!this._auth()?.name || !this._auth()?.userId) await this.fetchUser();
    this.identifyToMixpanel();
  }

  async logout(): Promise<void> {
    this.mixpanel.reset();
    this.clearSessionData();
    this._auth.set(null);
    this._selectedProperty.set(null);
    this._properties.set([]);
    await this.storage.remove(Config.STORAGE_AUTH_KEY);
    await this.storage.remove(Config.STORAGE_PROPERTY_KEY);
    await this.storage.remove(Config.STORAGE_PROPERTIES_KEY);
  }

  needsRefresh(): boolean {
    const auth = this._auth();
    if (!auth) return false;
    return auth.expiresAt - Date.now() < 5 * 60 * 1000;
  }

  private async setAuth(state: AuthState): Promise<void> {
    this._auth.set(state);
    await this.storage.set(Config.STORAGE_AUTH_KEY, state);
  }

  private async loadDeviceId(): Promise<void> {
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getId();
      this._deviceId.set(info.identifier);
    } catch {
      this._deviceId.set('web-dev-device');
    }
  }
}
```

> **Strip for standalone reuse:** the `ReservationService`, `DocuscanService`, `MixpanelService`, `LanguageService` constructor deps exist only for SabeeApp-Go side effects (clearing cached reservation/guest data on logout/property-switch, Mixpanel identify/reset, translation re-fetch). Remove those four imports/params and the calls that reference them (`clearSessionData()`, `identifyToMixpanel()`, `refreshTranslations()`, `this.mixpanel.trackLogin()`) for a clean core auth service. The `PropertyInterface`/property-selection methods (`loadProperties`, `selectProperty`, `_selectedProperty`/`_properties` signals) are also SabeeApp-Go's multi-tenant-property concept — keep only if your new prototype has an equivalent "select a workspace/tenant after login" step.

---

### 3.2 `app/src/app/services/api.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiEnvironmentService } from './api-environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private get base(): string {
    return this.env.apiUrl();
  }

  constructor(private http: HttpClient, private env: ApiEnvironmentService) {}

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<T>(`${this.base}/${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${path}`, body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${path}`, body);
  }
}
```

---

### 3.3 `app/src/app/services/api-environment.ts`

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';
import { Config } from '../config/config';
import { StorageService } from './storage';

export type ApiEnvMode = 'live' | 'test';

@Injectable({ providedIn: 'root' })
export class ApiEnvironmentService {
  private _mode = signal<ApiEnvMode>('live');
  readonly mode = this._mode.asReadonly();
  readonly isTest = computed(() => this._mode() === 'test');
  readonly apiUrl = computed(() =>
    this._mode() === 'test' ? environment.testApiUrl : environment.apiUrl,
  );

  constructor(private storage: StorageService) {}

  async init(): Promise<void> {
    const stored = await this.storage.get<ApiEnvMode>(Config.STORAGE_API_ENV_KEY);
    if (stored === 'test' || stored === 'live') {
      this._mode.set(stored);
    }
  }

  async setMode(mode: ApiEnvMode): Promise<void> {
    this._mode.set(mode);
    await this.storage.set(Config.STORAGE_API_ENV_KEY, mode);
  }
}
```

> This is a SabeeApp-Go-specific QA feature (hidden 7-tap test/live API toggle on the login screen). For a standalone prototype, simplest is to delete this and have `AuthService` read `environment.apiUrl` directly.

---

### 3.4 `app/src/app/services/storage.ts`

```typescript
import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({ providedIn: 'root' })
export class StorageService {
  async get<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
```

This is the entirety of token persistence — `@capacitor/preferences`, one JSON blob per key, no separate access/refresh-token keys.

---

### 3.5 `app/src/app/interceptors/api.interceptor.ts`

```typescript
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, filter, take, from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { Config } from '../config/config';
import { LanguageService } from '../services/language.service';

const refreshing$ = new BehaviorSubject<boolean>(false);

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const lang = inject(LanguageService);
  const router = inject(Router);

  const addHeaders = (request: HttpRequest<unknown>): HttpRequest<unknown> => {
    const headers: Record<string, string> = {
      'Api-Version': Config.API_VERSION,
      'App-Version': Config.APP_VERSION,
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
        // Only force logout when the refresh token itself is rejected (401).
        // Network errors, timeouts, and server errors are transient — keep the
        // stored session so the user can try again without re-logging in.
        if (err instanceof HttpErrorResponse && err.status === 401) {
          auth.logout();
          router.navigateByUrl('/login', { replaceUrl: true });
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
```

**Notable design points:**
- Token is sent as a custom `Token` header, **not** `Authorization: Bearer`.
- `Device-Id` and `Property-Id` are sent on every request alongside the token.
- Refresh trigger is **both** proactive (`< 5 min` remaining, via `needsRefresh()`) **and** reactive (any `401`).
- A module-level `BehaviorSubject` (`refreshing$`) dedups concurrent refreshes — if a refresh is already in flight, other requests wait for it to finish then retry with fresh headers, instead of firing N parallel refresh calls.
- `Lang` header comes from a `LanguageService` — drop this dependency if your prototype has no i18n layer.

---

### 3.6 `app/src/app/interceptors/error.interceptor.ts`

```typescript
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
```

Generic logging only — not auth-specific. Included because it's chained **before** `apiInterceptor` in `app.config.ts`; order matters so a `401` still propagates through to `apiInterceptor`'s `catchError`. Drop the `Sentry.captureException` call if you don't use Sentry.

---

### 3.7 `app/src/app/models/auth.interfaces.ts`

```typescript
export interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  roles: string[];
  email: string;
  name: string;
  userId: string;
}

export interface MfaTokenResponse {
  mfa_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  roles: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors: unknown;
}
```

`AuthState` is the exact shape persisted to `Preferences` under `Config.STORAGE_AUTH_KEY`. `expiresAt` is precomputed (`Date.now() + expires_in * 1000`) at login/refresh time — not recalculated from decoding a JWT.

---

### 3.8 `app/src/app/config/config.ts` (auth-relevant excerpt)

```typescript
export const Config = {
  API_VERSION: '1.0',
  APP_VERSION: '1.1.0',
  CI_VERSION: '4',
  // After the backend dropped client_id encryption, both TEST and PROD accept the
  // same plain integer. (Previously PROD validated an encrypted hex token and TEST
  // wanted an integer, so they had separate values — now unified.)
  CLIENT_ID: 1070,
  STORAGE_AUTH_KEY: 'authState',
  STORAGE_PROPERTY_KEY: 'selectedProperty',
  STORAGE_PROPERTIES_KEY: 'properties',
  STORAGE_API_ENV_KEY: 'apiEnvironment',
  // ...plus unrelated document-scan constants (SCAN_DEBUG_LOGGING, ADDRESS_CARDS,
  // ID_CARDS, PASSPORTS, DRIVING_LICENCES) — not shown, not auth-relevant.
} as const;
```

`CLIENT_ID` is sent on every `/token` login call. The three `STORAGE_*` keys are the Preferences keys read/written by `AuthService`. `API_VERSION`/`APP_VERSION`/`CI_VERSION` are sent as headers by the interceptor on every request.

---

### 3.9 `app/src/app/guards/auth.guard.ts`

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
```

---

### 3.10 `app/src/app/pages/mfa/mfa.page.ts`

```typescript
import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChildren,
  QueryList,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-mfa',
  templateUrl: './mfa.page.html',
  styleUrls: ['./mfa.page.scss'],
  standalone: true,
  imports: [IonContent, TranslatePipe],
})
export class MfaPage implements AfterViewInit, OnDestroy {
  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits = ['', '', '', '', '', ''];
  loading = false;
  hasError = false;
  mfaToken = '';
  email = '';

  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private t(fn: () => void, ms: number) { this.timeouts.push(setTimeout(fn, ms)); }

  constructor(
    private auth: AuthService,
    public router: Router,
  ) {
    const state = this.router.getCurrentNavigation()?.extras?.state;
    this.mfaToken = state?.['mfaToken'] ?? '';
    this.email    = state?.['email']    ?? '';
  }

  ngAfterViewInit() {
    // Delay to preserve iOS gesture context across the slide-in animation
    this.t(() => this.focusAt(0), 350);
  }

  ngOnDestroy() {
    this.timeouts.forEach(clearTimeout);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    this.digits[index] = val;
    input.value = val;
    this.hasError = false;
    if (val && index < 5) this.focusAt(index + 1);
    if (val && index === 5) this.verify();
  }

  onKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'Backspace') return;
    event.preventDefault();
    if (this.digits[index]) {
      this.digits[index] = '';
      this.inputAt(index).value = '';
    } else if (index > 0) {
      this.digits[index - 1] = '';
      this.inputAt(index - 1).value = '';
      this.focusAt(index - 1);
    }
    this.hasError = false;
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const chars = text.replace(/\D/g, '').slice(0, 6).split('');
    chars.forEach((d, i) => {
      this.digits[i] = d;
      this.inputAt(i).value = d;
    });
    this.hasError = false;
    this.focusAt(Math.min(chars.length, 5));
    if (chars.length === 6) this.verify();
  }

  async verify() {
    const code = this.digits.join('');
    if (code.length < 6 || this.loading) return;

    this.loading = true;
    this.hasError = false;
    try {
      await this.auth.verifyMfa(this.mfaToken, code, this.email);
      await this.router.navigate(['/property-select'], { replaceUrl: true });
    } catch {
      this.loading = false;
      this.hasError = true;
      this.digits = ['', '', '', '', '', ''];
      this.digitInputs.forEach(ref => (ref.nativeElement.value = ''));
      this.t(() => this.focusAt(0), 50);
    }
  }

  retryError() {
    this.hasError = false;
    this.t(() => this.focusAt(0), 50);
  }

  private focusAt(index: number) {
    this.inputAt(index)?.focus();
  }

  private inputAt(index: number): HTMLInputElement {
    return this.digitInputs?.get(index)?.nativeElement as HTMLInputElement;
  }
}
```

**2FA mechanism:** 6-digit numeric code, `method: 'totp'` hardcoded in the request (see `verifyMfa()` in §3.1), submitted as `{ mfa_token, method, code }` to `POST /mfa/verify`. Auto-submits on the 6th digit — no separate "Verify" button. Paste support on the first box (splits a pasted 6-digit string across all boxes). On a wrong code: clears all digits, shows an error state, refocuses the first box. The `mfa_token` bridges step 1 (password) → step 2 (code) and comes from the `/token` login response.

After `verifyMfa()` succeeds, this app navigates to `/property-select` (its own multi-tenant concept) — replace with wherever your prototype goes post-login.

> Note: `router.navigate(['/mfa'], { state: { mfaToken, email } })` passes the token via router navigation state (memory only, not URL) — this is intentional so the MFA token never appears in a URL/history entry. Constructor reads it back via `this.router.getCurrentNavigation()?.extras?.state`.

---

### 3.11 `app/src/app/pages/login/login.page.ts`

```typescript
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent } from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';
import { ApiEnvironmentService } from '../../services/api-environment';
import { AuthService } from '../../services/auth';
import { LanguageService } from '../../services/language.service';
import { OptionsService } from '../../services/options.service';
import { ReservationService } from '../../services/reservation';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent, TranslatePipe],
})
export class LoginPage implements OnDestroy {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';
  errorOpen = false;

  lang = inject(LanguageService);
  apiEnv = inject(ApiEnvironmentService);
  private res = inject(ReservationService);
  private options = inject(OptionsService);

  tapCounterMessage = signal<string | null>(null);
  private tapCount = 0;
  private tapResetTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  changeLang(event: Event) {
    const code = (event.target as HTMLSelectElement).value;
    this.lang.setLanguage(code);
  }

  async submit(e: Event) {
    e.preventDefault();
    if (this.loading || !this.email.trim() || !this.password) return;

    this.loading = true;
    try {
      const { mfaToken } = await this.auth.login(
        this.email.trim(),
        this.password,
      );
      await this.router.navigate(['/mfa'], {
        state: { mfaToken, email: this.email.trim() },
        replaceUrl: true,
      });
    } catch (err: unknown) {
      this.logLoginError(err);
      this.errorMessage = this.extractMessage(err);
      this.errorOpen = true;
    } finally {
      this.loading = false;
    }
  }

  /** Detailed diagnostics for a failed /token call — console + Sentry. */
  private logLoginError(err: unknown) {
    const detail: Record<string, unknown> = {
      apiMode: this.apiEnv.isTest() ? 'test' : 'live',
      apiUrl: this.apiEnv.apiUrl(),
    };
    if (err instanceof HttpErrorResponse) {
      detail['status'] = err.status;
      detail['statusText'] = err.statusText;
      detail['url'] = err.url;
      detail['name'] = err.name;
      detail['message'] = err.message;
      detail['errorBody'] = err.error;
      // status 0 ⇒ no HTTP response reached the app (CORS block / network / DNS / TLS)
      detail['likelyCause'] =
        err.status === 0
          ? 'No response reached the browser — CORS block, network, DNS, or TLS failure (not a credential error).'
          : 'Server responded with an HTTP error.';
    } else {
      detail['error'] = String(err);
      if (err && typeof err === 'object' && 'apiErrors' in err) {
        detail['apiErrors'] = (err as { apiErrors?: unknown }).apiErrors;
      }
    }
    console.error('Login failed', detail);
    Sentry.captureException(err, {
      tags: { context: 'login', api_mode: detail['apiMode'] as string },
      extra: detail,
    });
  }

  dismissError() {
    this.errorOpen = false;
  }

  async onSecretTap() {
    clearTimeout(this.tapResetTimer);
    this.tapCount++;
    const targetMode = this.apiEnv.isTest() ? 'Live' : 'Test';
    const remaining = 7 - this.tapCount;

    if (this.tapCount >= 7) {
      this.tapCount = 0;
      this.tapCounterMessage.set(null);
      const next = this.apiEnv.isTest() ? 'live' : 'test';
      await this.auth.logout();
      this.res.clear();
      this.options.clear();
      await this.apiEnv.setMode(next);
      return;
    }
    if (this.tapCount >= 4) {
      this.tapCounterMessage.set(
        `${remaining} more tap${remaining === 1 ? '' : 's'} to switch to ${targetMode} Mode`,
      );
    }
    this.tapResetTimer = setTimeout(() => {
      this.tapCount = 0;
      this.tapCounterMessage.set(null);
    }, 2000);
  }

  ngOnDestroy() {
    clearTimeout(this.tapResetTimer);
  }

  /**
   * Pick a user-facing message by failure type — don't surface raw API internals.
   *   • no HTTP response reached the app (status 0 — network / CORS / DNS / TLS) → noInternet
   *   • credential rejection (API 200 {success:false}, thrown with apiErrors, or HTTP 401) → incorrect
   *   • anything else unexpected (e.g. 5xx) → generic
   * Keys live in the `login` namespace so they resolve pre-token (see translations.ts).
   */
  private extractMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return this.lang.t('login.errNoInternet');
    }
    if (
      (err instanceof HttpErrorResponse && err.status === 401) ||
      (err !== null && typeof err === 'object' && 'apiErrors' in err)
    ) {
      return this.lang.t('login.errIncorrect');
    }
    return this.lang.t('login.errGeneric');
  }
}
```

> **Strip for standalone reuse:** `onSecretTap()` + `tapCounterMessage` (the 7-tap hidden test/live API switch) is SabeeApp-Go-specific QA tooling — drop it entirely. `Sentry`, `LanguageService`, `OptionsService`, `ReservationService` are app-specific wiring (error monitoring / i18n / unrelated cache-clearing on the secret-tap path) — drop the imports and inline the three core pieces: the `email`/`password` form fields, `submit()` calling `auth.login()` then navigating to `/mfa`, and a plain error message string for `extractMessage()` (or keep the three-way classification logic — it's a reasonable pattern: status 0 = network, 401/apiErrors = bad credentials, else = generic).

---

### 3.12 `app/src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://api.sabeeapp.com/go',
  testApiUrl: 'https://smart.sabeeapp.com/api2/go',
  sentryDsn: 'https://6e6a2b41670d77c50c0793ab1785c90b@o301987.ingest.us.sentry.io/4511412888141824',
  supabaseUrl: 'https://qiwhynwwgicpyeszecuj.supabase.co',
  supabaseAnonKey: 'sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h',
  mixpanelToken: '03021fbbdcc35a8b657f5b91d4ad93b2',
};
```

### 3.13 `app/src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.sabeeapp.com/go',
  testApiUrl: 'https://smart.sabeeapp.com/api2/go',
  sentryDsn: 'https://6e6a2b41670d77c50c0793ab1785c90b@o301987.ingest.us.sentry.io/4511412888141824',
  supabaseUrl: 'https://qiwhynwwgicpyeszecuj.supabase.co',
  supabaseAnonKey: 'sb_publishable_rd0rgQytObIOQsYq26xMeg_WNpekL7h',
  mixpanelToken: '03021fbbdcc35a8b657f5b91d4ad93b2',
};
```

Only `apiUrl`/`testApiUrl` are auth-relevant; `sentryDsn`/`supabaseUrl`/`supabaseAnonKey`/`mixpanelToken` belong to unrelated features in this codebase — **do not carry these specific values into a new project**, they're this app's credentials.

---

### 3.14 `app/src/app/app.config.ts` (interceptor wiring, reference only)

```typescript
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, RouteReuseStrategy, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { apiInterceptor } from './interceptors/api.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { LanguageService } from './services/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor, apiInterceptor])),
    provideAppInitializer(() => inject(LanguageService).init()),
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    { provide: Sentry.TraceService, deps: [Router] },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
};
```

The line that matters for the new prototype: `provideHttpClient(withInterceptors([errorInterceptor, apiInterceptor]))` — `errorInterceptor` must run **before** `apiInterceptor` in the array so a `401` still reaches `apiInterceptor`'s `catchError`/refresh logic. Everything else here (Sentry wiring, `LanguageService` initializer) is unrelated to auth.

---

## 4. Minimal porting checklist

To reuse just the core (login → MFA → token storage → refresh → authenticated requests) in a new project with no property/tenant concept, no i18n, no Mixpanel/Sentry:

1. Copy `storage.ts`, `auth.interfaces.ts`, `auth.guard.ts` as-is.
2. Copy `auth.ts`, then delete: the `ReservationService`/`DocuscanService`/`MixpanelService`/`LanguageService` constructor params and every method/line that references them (`clearSessionData`, `identifyToMixpanel`, `refreshTranslations`, `mixpanel.trackLogin()`); delete `loadProperties`/`selectProperty`/`_properties`/`_selectedProperty` and the `sortPropertiesByCompany` helper unless you have an equivalent post-login selection step.
3. Copy `api.interceptor.ts`, drop the `LanguageService` injection and the `Lang` header line; keep the `Token`/`Device-Id` headers and the proactive/reactive refresh logic as-is — that's the load-bearing part.
4. Skip `api-environment.ts` entirely; hardcode your API base URL in `environment.ts`, or keep the live/test toggle if you want the same QA convenience.
5. Copy `login.page.ts`/`mfa.page.ts` logic, strip Sentry/i18n/secret-tap/unrelated-service code as noted in §3.10/§3.11; you'll need to write your own templates (not extracted here — purely UI).
6. In your new `app.config.ts`, register `provideHttpClient(withInterceptors([apiInterceptor]))` (or `[errorInterceptor, apiInterceptor]` if you also port the error logger).
7. Update `Config.CLIENT_ID` and the `/token`, `/mfa/verify`, `/users/me` endpoint paths/payload field names to match your new backend's actual auth API — the field names above (`username`, `device_id`, `grant_type`, `mfa_token`, `access_token`, `refresh_token`, `expires_in`) are SabeeApp's API contract, not a generic standard.
