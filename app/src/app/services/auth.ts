import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Config } from '../config/config';
import { StorageService } from './storage';
import { ApiEnvironmentService } from './api-environment';
import { ReservationService } from './reservation';
import { DocuscanService } from './docuscan';
import { PropertyConfigService } from './property-config.service';
import { PropertySettingsService } from './property-settings.service';
import { MixpanelService } from './mixpanel';
import { LanguageService } from './language.service';
import { LiveUpdateService } from './live-update';
import { AppVersionService } from './app-version';
import {
  AuthState,
  ApiResponse,
  MeResponse,
  MfaTokenResponse,
  TokenResponse,
} from '../models/auth.interfaces';

export const GO_SUBSCRIPTION_MODULE = 'sabeeapp_go';

/** Verdict from AuthService.selectProperty() — the single eligibility chokepoint for both the
 * post-login property pick and the in-app switcher. */
export type PropertyEligibility = 'ok' | 'ineligible' | 'unverified';

export type FetchUserResult = { ok: true; subscription: string[] } | { ok: false };
import { PropertyInterface } from '../models/property.interface';

/** Discriminates refreshAccessToken() failures for the interceptor's force-logout decision. */
export type AuthErrorKind = 'refresh_rejected';

interface AuthErrorExtra {
  status?: number;
  body?: unknown;
  url?: string;
}

function taggedAuthError(
  message: string,
  kind: AuthErrorKind,
  extra?: AuthErrorExtra,
): Error & { kind: AuthErrorKind } & AuthErrorExtra {
  return Object.assign(new Error(message), { kind, ...extra });
}

/** Untagged — the interceptor's rejected-vs-transient check only matches taggedAuthError's kind,
 * so this always falls into the "transient, keep retrying" branch, same as before. */
function transientAuthError(message: string, extra?: AuthErrorExtra): Error & AuthErrorExtra {
  return Object.assign(new Error(message), extra);
}

export interface RefreshRequestResult {
  request: { url: string; body: Record<string, unknown>; headers: Record<string, string> };
  response: { status: number; body: unknown; parseError: string | null };
}

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
    private propertySettings: PropertySettingsService,
    private liveUpdate: LiveUpdateService,
    private appVersion: AppVersionService,
  ) {}

  /**
   * Load the property's config, then point live updates at whatever channel it maps to. Chained
   * rather than parallel: the channel is only known once the config row has been read. Failures
   * are swallowed — PropertyConfigService already falls back to 'prod' on any error, so the
   * worst case is a device staying on the safe channel.
   *
   * Returns the promise so `selectProperty()` can await it before correcting the channel (see
   * there for why). `loadStoredAuth()`'s restore path deliberately stays fire-and-forget and
   * passes `allowReload: false`: boot must not be slowed waiting on it, and a user landing on
   * /home must not have the webview reloaded under them. It still stages the right-channel bundle,
   * which closes a real gap — a pilot device restoring a `dev` property previously stayed on
   * whatever it had until a 90s+ resume happened to come along.
   */
  private loadPropertyConfig(propertyId: number, allowReload: boolean): Promise<void> {
    return this.propertyConfig
      .load(propertyId)
      .then(() => this.liveUpdate.setChannelForProperty(this.propertyConfig.liveUpdateChannel()))
      .then(() => this.liveUpdate.applyChannelChangeIfNeeded(allowReload))
      .catch(() => {});
  }

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
   * Only the logged-in staff member's opaque id + property context is sent —
   * never their name/email, and never guest PII.
   */
  private identifyToMixpanel(): void {
    const auth = this._auth();
    if (!auth?.userId) return;
    const prop = this._selectedProperty();
    this.mixpanel.identify(auth.userId, {
      propertyId: prop?.property_id ?? undefined,
      propertyName: prop?.property_name ?? undefined,
      company: prop?.property_company_name ?? undefined,
    });
    this.mixpanel.setActiveProperty(prop?.property_id, prop?.property_name);
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
    this.propertySettings.clear();
    // Reset the plugin's persisted channel too — propertyConfig.clear() only resets our signal,
    // and a device must never stay pinned to a previous property's early/dev channel.
    this.liveUpdate.setChannelForProperty('prod');
    // Drop the remembered property channel: it is session state, and this device may next be used
    // by someone from a different hotel. Deliberately does NOT clear the installed bundle's own
    // channel — that describes what is physically on this disk, which logging out does not change.
    // Conflating the two would send every logged-out canary device back to production and
    // reintroduce a full double download on its next login.
    this.liveUpdate.clearResolvedChannel();
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
      // Cold start with a restored property re-reads the scan config (scanDocTypes,
      // extendedLogging) and the live-update channel, so both are populated without
      // waiting for a manual switch.
      this.loadPropertyConfig(property.property_id, false);
      // Same reasoning for the property's timezone (used to render checked_in_time/
      // checked_out_time correctly) — fire-and-forget, best-effort.
      this.propertySettings.load().catch(() => {});
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
      subscription: [],
    });
    this.refreshTranslations();
    this.mixpanel.trackLogin();
  }

  /**
   * GET /users/me. Also doubles as the Go-eligibility read (subscription field) — see
   * selectProperty() and app.component.ts's boot-restore path, both of which call this
   * unconditionally and inspect the returned subscription list. The `{ ok }` result lets those
   * callers distinguish "verified, no access" from "couldn't verify" (network/API failure).
   * Callers that only want the name/email/userId backfill (loadStoredAuth's conditional call)
   * can ignore the return value — that behavior is unchanged.
   */
  async fetchUser(): Promise<FetchUserResult> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<MeResponse[]>>(`${this.env.apiUrl()}/users/me`),
      );
      const user = res.data?.[0];
      if (res.success && user?.name) {
        const subscription = user.subscription ?? [];
        await this.setAuth({
          ...this._auth()!,
          name: user.name,
          email: user.email,
          userId: user.user_id,
          subscription,
        });
        this.identifyToMixpanel();
        return { ok: true, subscription };
      }
      return { ok: false };
    } catch {
      // Non-fatal for the name/email backfill use — email is already stored, name stays empty.
      return { ok: false };
    }
  }

  /**
   * SINGLE SOURCE OF TRUTH for the refresh-token HTTP exchange — url, body, headers, and the
   * raw fetch call itself. Used by BOTH refreshAccessToken() (the automatic path, below) and
   * the Settings "New Refresh Token" debug tool, so the two can never silently diverge again —
   * they already had once (the debug tool kept sending a `Token` header after the automatic
   * path stopped), only caught by comparing the two side by side during the 2026-08-31
   * investigation (see CLAUDE.md changelog). Deliberately raw `fetch()`, bypassing
   * HttpClient/api.interceptor.ts entirely, so nothing else in the pipeline can alter what's
   * actually sent. `overrides` lets the debug tool test a modified Device-Id/App-Version
   * without touching live state; the automatic path calls this with no overrides.
   */
  async performRefreshRequest(overrides?: { deviceId?: string; appVersion?: string }): Promise<RefreshRequestResult> {
    const rt = this._auth()?.refreshToken ?? '';
    const url = `${this.env.apiUrl()}/token`;
    const body: Record<string, unknown> = { grant_type: 'refresh_token', refresh_token: rt };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Api-Version': Config.API_VERSION,
      'App-Version': overrides?.appVersion ?? this.appVersion.version(),
      'Ci-Version': Config.CI_VERSION,
      'Device-Id': overrides?.deviceId ?? (this._deviceId() || 'web-dev-device'),
      'Lang': this.lang.currentLanguage(),
      // Deliberately no Token header — the API's own Postman collection for this exact
      // request does not send one (confirmed 2026-08-31; only login and every other
      // endpoint carry it). Sending the dead access token being refreshed made no logical
      // sense either way.
    };
    const property = this._selectedProperty();
    if (property) headers['Property-Id'] = String(property.property_id);

    let status = 0;
    let responseBody: unknown = null;
    let parseError: string | null = null;
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      status = res.status;
      const text = await res.text();
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
        parseError = 'response body is not JSON';
      }
    } catch (err) {
      responseBody = { fetchError: err instanceof Error ? err.message : String(err) };
    }
    return { request: { url, body, headers }, response: { status, body: responseBody, parseError } };
  }

  async refreshAccessToken(): Promise<void> {
    const rt = this._auth()?.refreshToken;
    // Tagged the same as an API-rejected refresh (not a plain Error) so the interceptor's
    // force-logout condition catches this too — no refresh token to use is just as terminal
    // as one the API rejects, and must not fall into the "transient, keep retrying" branch.
    if (!rt) throw taggedAuthError('No refresh token', 'refresh_rejected');

    const { request, response } = await this.performRefreshRequest();

    if (response.status === 0) {
      // fetch() itself threw — no response reached at all. Transient (network/connectivity),
      // not a rejection: keep the stored session so the user can retry without re-logging in.
      const fetchErrorMsg =
        response.body && typeof response.body === 'object' && 'fetchError' in response.body
          ? String((response.body as { fetchError: unknown }).fetchError)
          : 'Network error';
      throw transientAuthError(fetchErrorMsg, { status: 0, body: response.body, url: request.url });
    }
    if (response.status === 401 || response.status === 403) {
      // Confirmed 2026-08-31 (see CLAUDE.md changelog): the API answers a refresh token it
      // won't honor with a real HTTP 403 { success: false, errors: [...] } — not the HTTP 200
      // { success: false } shape login() uses, and not always a literal 401 either.
      const body = response.body as { errors?: { ret_msg?: string }[] } | undefined;
      throw taggedAuthError(
        body?.errors?.[0]?.ret_msg ?? `Refresh token rejected (${response.status})`,
        'refresh_rejected',
        { status: response.status, body: response.body, url: request.url },
      );
    }
    if (response.status !== 200) {
      // Any other non-2xx (5xx, etc.) is transient — matches the pre-existing rule that only
      // an explicit 401/403 counts as a terminal rejection.
      throw transientAuthError(`Refresh failed with status ${response.status}`, {
        status: response.status,
        body: response.body,
        url: request.url,
      });
    }
    // Same as login(): the API can ALSO signal a rejected refresh token as HTTP 200 with
    // { success: false }. Without this check a dead refresh token throws a generic TypeError
    // while destructuring res.data, which the interceptor could not tell apart from a
    // transient network/server error — leaving the session stuck retrying the same doomed
    // refresh on every request instead of forcing a clean re-login.
    const res = response.body as ApiResponse<TokenResponse>;
    if (!res?.success || !res.data?.access_token) {
      const apiErrors = res?.errors as { ret_code?: number; ret_msg?: string }[] | undefined;
      throw taggedAuthError(apiErrors?.[0]?.ret_msg ?? 'Refresh token rejected', 'refresh_rejected', {
        status: response.status,
        body: response.body,
        url: request.url,
      });
    }
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

  /** Evicts just the active property, keeping the session authenticated — used when the boot-time eligibility re-check finds the restored property no longer listed. */
  async clearSelectedProperty(): Promise<void> {
    this._selectedProperty.set(null);
    await this.storage.remove(Config.STORAGE_PROPERTY_KEY);
  }

  /**
   * The single Go-eligibility chokepoint — called for both the post-login property pick
   * (PropertySelectPage.select()) and every in-app switch (HomePage.selectProperty()), so a
   * property can never be entered without a fresh /me subscription read. Unlike the old
   * PropertyGatingService allowlist (resolved once and cached for the session), this always
   * hits the network: subscription is a live, user-level fact that can change between switches.
   * Fail-closed on a fetchUser() failure, matching the previous gating service's philosophy.
   */
  async selectProperty(property: PropertyInterface): Promise<PropertyEligibility> {
    // Switching to a different property must not carry over the previous
    // property's reservations/guests (would otherwise survive the 60s fetch
    // staleness window and render under the new property).
    if (this._selectedProperty()?.property_id !== property.property_id) {
      this.clearSessionData();
    }
    this._selectedProperty.set(property);
    // Fire-and-forget — a slow/failing timezone fetch must not delay or fail property
    // selection; formatPropertyInstant() already degrades gracefully with no timezone.
    this.propertySettings.load().catch(() => {});
    await this.storage.set(Config.STORAGE_PROPERTY_KEY, property);
    const result = await this.fetchUser();
    this.identifyToMixpanel();
    if (!result.ok) return 'unverified';
    if (!result.subscription.includes(GO_SUBSCRIPTION_MODULE)) return 'ineligible';
    // Corrects the channel if this property's differs from the one the installed bundle came
    // from. Reload is safe here, unlike at boot or on a short resume: the session is already
    // persisted above, so a reload's fresh boot restores straight through to this same property
    // with no re-login; and the user is already mid-navigation (about to see a screen transition
    // regardless), so it isn't the unannounced mid-task interruption the resume threshold exists
    // to avoid.
    //
    // Unlike the previous unconditional check-and-apply here, this makes no plugin or network
    // call at all when the channel already matches — which is every re-selection of the same
    // property, and every selection at all for the overwhelming majority on `production`. The
    // pre-login setup gate has usually already fetched the right bundle by this point.
    await this.loadPropertyConfig(property.property_id, true);
    return 'ok';
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
