import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { ApiEnvironmentService } from './api-environment';
import { ReservationService } from './reservation';
import { DocuscanService } from '../regula/services/docuscan';
import { PropertyConfigService } from './property-config.service';
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
    private propertyConfig: PropertyConfigService,
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
    this.propertyConfig.clear();
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
      // Cold start with a restored property re-reads the scan config; otherwise
      // scanVendor stays null and "Scan Document" is hidden until a manual switch.
      this.propertyConfig.load(property.property_id).catch(() => {});
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
    this.propertyConfig.load(property.property_id).catch(() => {});
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
