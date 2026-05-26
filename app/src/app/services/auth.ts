import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { ApiEnvironmentService } from './api-environment';
import {
  AuthState,
  ApiResponse,
  MfaTokenResponse,
  TokenResponse,
} from '../models/auth.interfaces';
import { PropertyInterface } from '../models/property.interface';

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
  readonly selectedProperty = computed(() => this._selectedProperty());
  readonly properties = computed(() => this._properties());
  readonly deviceId = computed(() => this._deviceId());

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private env: ApiEnvironmentService,
  ) {}

  async loadStoredAuth(): Promise<void> {
    await this.loadDeviceId();
    const auth = await this.storage.get<AuthState>(Config.STORAGE_AUTH_KEY);
    if (auth?.refreshToken) {
      this._auth.set(auth);
    }
    const property = await this.storage.get<PropertyInterface>(Config.STORAGE_PROPERTY_KEY);
    if (property) {
      this._selectedProperty.set(property);
    }
    const properties = await this.storage.get<PropertyInterface[]>(Config.STORAGE_PROPERTIES_KEY);
    if (properties?.length) {
      this._properties.set(properties);
    }
    // Property-Id header is required by /users/me — fetch only after property is restored
    if (auth?.accessToken && !auth.name && property) {
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
        client_id: Config.CLIENT_ID,
      }),
    );
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
    });
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
        await this.setAuth({ ...this._auth()!, name: user.name, email: user.email });
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
    this._properties.set(res.data);
    await this.storage.set(Config.STORAGE_PROPERTIES_KEY, res.data);
    return res.data;
  }

  async selectProperty(property: PropertyInterface): Promise<void> {
    this._selectedProperty.set(property);
    await this.storage.set(Config.STORAGE_PROPERTY_KEY, property);
    if (!this._auth()?.name) await this.fetchUser();
  }

  async logout(): Promise<void> {
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
