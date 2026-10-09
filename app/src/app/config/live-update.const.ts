/**
 * Rollback window: how long the native plugin waits for LiveUpdate.ready() before resetting to
 * the default bundle. Read only by capacitor.config.ts, so it is baked into the binary.
 *
 * Raised 15s → 45s in Android 1.0.8 (2026-10-09). On Android the plugin's countdown is a plain
 * native timer that keeps running while the app is in the background, and the webview's JS is
 * paused — so opening the app and switching away (or locking the phone) within 15s rolled back
 * perfectly healthy bundles. 66 of 67 rollbacks in the 21 days before this change were Android.
 *
 * ⚠️ KEEP THIS FILE DEPENDENCY-FREE — no imports of any kind, not even type-only ones, and never
 * re-export it through a barrel file. capacitor.config.ts imports it and is loaded by the
 * Capacitor CLI *outside* the Angular build, so any Angular import reachable from here (directly
 * or transitively) breaks `npx cap sync` with an error that gives no hint it originated here.
 */
export const READY_TIMEOUT_MS = 45000;

/**
 * The window the JS-side ready() retry budget (app.component.ts) is computed from.
 *
 * Deliberately NOT READY_TIMEOUT_MS: that value is baked into each binary, while this code ships
 * OTA to every binary, including ones still carrying the old 15s timeout. Budgeting against the
 * smallest timeout any shipped binary has means the retry can never overrun the native deadline,
 * whichever binary it lands on. Raise it only once no binary with a smaller readyTimeout is
 * still in use.
 */
export const READY_PROBE_WINDOW_MS = 15000;

/**
 * How many times one bundle may roll back on a device before that device stops taking it.
 * A false rollback (see READY_TIMEOUT_MS) costs one session and the bundle is retried; a bundle
 * that rolls back this many times within BUNDLE_ROLLBACK_WINDOW_MS is treated as broken.
 */
export const BUNDLE_ROLLBACK_LIMIT = 3;

/**
 * Both the window the BUNDLE_ROLLBACK_LIMIT rollbacks are counted in, and how long a bundle that
 * hit the limit is then held back on that device. 24h is time to notice the failure (Sentry
 * raises an Issue when the limit is hit) and publish a corrected bundle, which is never held.
 */
export const BUNDLE_ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How long the app must have actually been backgrounded before a resume is allowed to apply a
 * staged bundle by reloading the webview.
 *
 * Not every resume is a real return: glancing at the calculator for three seconds and coming
 * straight back is not "leaving the app", and reloading on that is nearly as jarring as reloading
 * at launch — the same thing the boot path deliberately avoids. Below this threshold the bundle
 * still downloads and stays staged; it just applies on a later, genuine return.
 */
export const MIN_BACKGROUND_MS_FOR_RELOAD = 90_000;

/**
 * Budget for the pre-login setup gate when the device is running the embedded native bundle.
 *
 * ⚠️ PLACEHOLDER — set this from measurement, not judgement. Run a fresh install over throttled
 * wifi, record how long the full bundle download actually takes, and set the shipped value from
 * that. Err generous: the caption appearing at BOOT_SETUP_CAPTION_DELAY_MS is what makes a long
 * hold read as progress rather than a hang, so an over-long budget costs little, while an
 * under-long one silently turns every fresh install into a timeout.
 *
 * The native case is a full download even once manifest artifacts are enabled — the manifest diff
 * copies unchanged files from the *current* bundle, and a native device has none.
 */
export const BOOT_SETUP_BUDGET_NATIVE_MS = 10_000;

/**
 * Budget for the same gate when an OTA bundle is already running.
 *
 * Shorter because this only has to cover a delta. ⚠️ That is only true once
 * scripts/publish-liveupdate.sh publishes with --artifact-type manifest; against full-zip
 * artifacts every check is a complete re-download and this budget will simply always expire
 * (which is safe — the bundle stays staged — but makes the gate a no-op for existing installs).
 */
export const BOOT_SETUP_BUDGET_OTA_MS = 3_000;

/** How long the gate stays silent before captioning itself, so a fast check shows no text at all. */
export const BOOT_SETUP_CAPTION_DELAY_MS = 1_200;

/**
 * Subtracted from the gate budget to get the reload cut-off, leaving room for reload() to take
 * effect before the pending navigation paints. ⚠️ Verify on device — log a timestamp either side
 * of reload() on a debug build and raise this if the webview takes longer than this to tear down.
 */
export const BOOT_SETUP_RELOAD_MARGIN_MS = 300;

/**
 * How long the gate waits for an in-flight ready() before giving up and leaving the bundle staged.
 *
 * Reloading while ready() is still in flight would leave the running bundle's native rollback
 * timer uncancelled, so it can fire during the transition and — with autoBlockRolledBackBundles —
 * permanently blocklist a perfectly healthy bundle. On timeout the gate must return, not reload.
 */
export const READY_RACE_MS = 500;

/**
 * How long a rollback-fallback candidate stays "already attempted" before it is eligible to be
 * force-applied again. Exists for the case where the underlying cause of a rollback is NOT the
 * candidate bundle itself (e.g. a real backend outage) — without this, a device could bounce
 * between the candidate and native forever. A device that hits this window has a real, recurring
 * problem; the operational fix at that point is rolling the channel back to a previous deployment
 * from the Capawesome dashboard, not waiting out more cooldowns.
 */
export const FALLBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cap on how long the rollback-fallback's own telemetry write is allowed to hold up reload() —
 * this is the only chance to record it (the boot never reaches the normal ready()-driven path),
 * but a dead network must not be allowed to delay landing the device on a working bundle.
 */
export const FALLBACK_TELEMETRY_TIMEOUT_MS = 1500;
