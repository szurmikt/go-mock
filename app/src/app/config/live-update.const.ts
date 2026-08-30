/**
 * Rollback window: how long the native plugin waits for LiveUpdate.ready() before resetting to
 * the default bundle. Shared between capacitor.config.ts (the native value) and app.component.ts
 * (the JS-side retry-budget math) so the two can never silently drift apart — if they did, the
 * confirmation retry would overrun the native deadline and revert healthy bundles on slow networks.
 *
 * ⚠️ KEEP THIS FILE DEPENDENCY-FREE — no imports of any kind, not even type-only ones, and never
 * re-export it through a barrel file. capacitor.config.ts imports it and is loaded by the
 * Capacitor CLI *outside* the Angular build, so any Angular import reachable from here (directly
 * or transitively) breaks `npx cap sync` with an error that gives no hint it originated here.
 */
export const READY_TIMEOUT_MS = 15000;

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
