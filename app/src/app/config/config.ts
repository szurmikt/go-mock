export const Config = {
  // Api-Version / Ci-Version headers (api.interceptor.ts) — the backend API contract
  // version, not the app release. Intentionally static; bump by hand only when the API
  // contract itself changes. Confirmed with the user 2026-08-18: unlike APP_VERSION below,
  // these are not a staleness bug — single consumer (the interceptor), no cross-system
  // drift risk, so hand-maintained is fine here.
  API_VERSION: '1.0',
  // Fallback only — AppVersionService.version() (app-version.ts) initializes to this,
  // then App.getInfo() overwrites it with the real MARKETING_VERSION/versionName at boot.
  // The fallback is only ever actually used on platforms without the native App plugin
  // (web/ionic serve — App.getInfo() throws unconditionally there, "Not implemented on
  // web"). No consumer (API header, feedback, force-update gate, Mixpanel, Settings)
  // reads this constant directly anymore as of the fixing-tracking-appversion branch —
  // they all read AppVersionService.version(). Keep in sync with the real native version
  // by hand when it's bumped, so the web/dev fallback doesn't drift far from reality —
  // matched to 1.0.1 on 2026-08-13 (was stuck at 1.1.0 since before this constant even
  // existed; see that branch's changelog entry for the full story).
  APP_VERSION: '1.0.1',
  // See API_VERSION comment above — same "static backend contract, not app version" story.
  CI_VERSION: '4',
  // After the backend dropped client_id encryption, both TEST and PROD accept the
  // same plain integer. (Previously PROD validated an encrypted hex token and TEST
  // wanted an integer, so they had separate values — now unified.)
  CLIENT_ID: 1070,
  // Verbose Regula scan logging for the testing period. Set false to dial back the
  // per-scan Sentry Logs + console dumps (failure->Issue capture stays on regardless).
  SCAN_DEBUG_LOGGING: true as boolean,
  STORAGE_AUTH_KEY: 'authState',
  STORAGE_PROPERTY_KEY: 'selectedProperty',
  STORAGE_PROPERTIES_KEY: 'properties',
  STORAGE_SEARCH_HISTORY_KEY: 'searchHistory',
  STORAGE_BACKGROUND_AT_KEY: 'backgroundAt',
  STORAGE_API_ENV_KEY: 'apiEnvironment',
  // Apple/Google App Store reviewers can't complete MFA (no access to an authenticator
  // app), so this one account skips the /mfa screen entirely and verifies with an empty
  // code — per the backend team, /mfa/verify accepts code: '' for this account only.
  APP_REVIEW_ACCOUNT_EMAIL: 'housekeeperappstore@gmail.com',
  // Hungarian address card (lakcímkártya) etc. — DocumentType.AddressCard = 183.
  // NOT an identity document: fills the address section only, never a scanned ID record.
  ADDRESS_CARDS: [183] as number[],
  ID_CARDS: [
    12, 16, 20, 28, 75, 76, 77, 83, 97, 98, 106, 121, 159, 160, 161, 162, 177,
    212, 213, 216, 224, 225,
  ] as number[],
  PASSPORTS: [
    11, 13, 14, 17, 26, 27, 172, 179, 198, 199, 200, 201, 202, 203, 204, 218,
  ] as number[],
  DRIVING_LICENCES: [
    36, 37, 38, 39, 40, 41, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 80, 81, 82, 84,
    85, 86, 87, 88, 89, 105, 107, 108, 109, 110, 112, 113, 114, 115, 116, 117,
    118, 119, 120, 126, 127, 132, 134, 135, 136, 138, 139, 140, 148, 149, 156,
    157, 158, 163, 164, 165, 169, 170, 171, 176, 187, 234, 235,
  ] as number[],
} as const;
