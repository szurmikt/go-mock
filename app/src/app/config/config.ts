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
  STORAGE_AUTH_KEY: 'authState',
  STORAGE_PROPERTY_KEY: 'selectedProperty',
  STORAGE_PROPERTIES_KEY: 'properties',
  STORAGE_SEARCH_HISTORY_KEY: 'searchHistory',
  STORAGE_BACKGROUND_AT_KEY: 'backgroundAt',
  STORAGE_API_ENV_KEY: 'apiEnvironment',
  STORAGE_AUTO_LOCK_MINUTES_KEY: 'autoLockMinutes',
  // Remembered Card/Passport IDScanly capture-screen toggle — see capture-preference.service.ts.
  STORAGE_SCAN_BUCKET_KEY: 'scanBucket',
  // Has this device ever dismissed the first-run Scan-screen walkthrough — see
  // scan-onboarding.service.ts. A "seen once ever" flag, not a preference — never reset except
  // by clearing app storage.
  STORAGE_SCAN_ONBOARDING_SEEN_KEY: 'scanOnboardingSeen',
  // Has this device ever dismissed the first-run My filters walkthrough — see
  // filter-tour.service.ts. Same "seen once ever" semantics as the key above.
  STORAGE_FILTER_TOUR_SEEN_KEY: 'filterTourSeen',
  // Same, for the short Home chip-strip tour started from the pulsing dot on the filter icon.
  STORAGE_HOME_FILTER_TOUR_SEEN_KEY: 'homeFilterTourSeen',
  // Per-user Help & tips card seen/dismissed state — see tips.service.ts. One blob keyed by
  // auth.userId() so GO's shared front-desk devices don't hide a card from one staff member
  // just because a colleague already saw it. Deliberately NOT cleared by
  // AuthService.clearSessionData() (logout/property-switch) — this is per-user history, not
  // property-scoped session data, and must survive so the same user sees their own progress
  // again on their next login on this device (same precedent as
  // STORAGE_SCAN_ONBOARDING_SEEN_KEY above, just namespaced per user instead of global).
  STORAGE_TIP_STATE_KEY: 'tipCardState',
  // Per-user Home filter-chip state (saved filters + selected chip) — see
  // home-filter.service.ts. Same reasoning and shape as STORAGE_TIP_STATE_KEY directly
  // above: one blob keyed by auth.userId(), not the device, and deliberately NOT cleared
  // by AuthService.clearSessionData() (logout/property-switch) — a user's saved filters
  // must survive their next login on this shared device. Also NOT property-scoped: the
  // same chips appear after switching hotels (only the counts they compute change).
  STORAGE_HOME_FILTERS_KEY: 'homeFilters',
  // One JSON record (LiveUpdateState, see utils/live-update-state.ts) rather than split keys:
  // it is read once at boot and mutated as a unit, and a reload mid-write across several keys
  // would leave torn state. Deliberately NOT cleared by AuthService.clearSessionData() — most of
  // it describes what is on this device's disk, which logging out does not change.
  STORAGE_LIVE_UPDATE_KEY: 'liveUpdateState',
  // Apple/Google App Store reviewers can't complete MFA (no access to an authenticator
  // app), so this one account skips the /mfa screen entirely and verifies with an empty
  // code — per the backend team, /mfa/verify accepts code: '' for this account only.
  APP_REVIEW_ACCOUNT_EMAIL: 'housekeeperappstore@gmail.com',
} as const;
