import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import mixpanel from 'mixpanel-browser';
import { environment } from '../../environments/environment';
import type { ApiEnvMode } from './api-environment';

/** A foreground gap longer than this starts a new analytics session. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface IdentifyTraits {
  propertyId?: string | number;
  propertyName?: string;
  company?: string;
}

/**
 * Thin, defensive wrapper around the mixpanel-browser singleton (initialised in
 * main.ts). Depends on nothing app-level so it can be injected anywhere — incl.
 * AuthService — without a DI cycle. Every call is wrapped in `safe()`: analytics
 * must never break the app.
 *
 * PRIVACY: only the logged-in *staff* user's opaque id + property/company
 * context is ever sent (identify / people.set) — never their name or email,
 * and never any guest PII (no guest names, emails, document numbers, DOB,
 * nationality, address, or raw search text) on any track call.
 */
@Injectable({ providedIn: 'root' })
export class MixpanelService {
  private sessionId = '';
  private foregroundStart = 0;
  private lastBackgroundAt = 0;
  private started = false;
  private foreground = false;
  /** The sessionId trackFilterStripSessionBaseline() last fired for — dedup guard so
   *  revisiting Home many times in one session only reports the baseline once. */
  private lastFilterBaselineSessionId = '';

  /**
   * Super properties attached to every event. Call once after apiEnv.init().
   * appVersion should be the real installed version (from App.getInfo()) — this service
   * has no opinion on the fallback for platforms without the native App plugin (web/dev);
   * that's the caller's call.
   *
   * bundleVersion is the live-update bundle actually running ('native' when no OTA bundle has
   * been applied). Required, not optional: once live updates ship, app_version alone no longer
   * identifies the running code, so an event without bundle_version is unattributable.
   *
   * bundleState says WHY that bundle is running, and is required for the same reason. On its own
   * `bundle_version: 'native'` conflates a fresh install, a rollback, a new binary, a missing
   * plugin and web/dev — which makes "native should be ~0% of the fleet" impossible to falsify.
   * Split at source, it separates the ~0.01% that actually matters (native_after_rollback) from
   * the majority that is expected and self-healing.
   */
  registerSuperProps(
    apiMode: ApiEnvMode,
    appVersion: string,
    bundleVersion: string,
    bundleState: string,
  ): void {
    this.safe(() =>
      mixpanel.register({
        app_version: appVersion,
        bundle_version: bundleVersion,
        bundle_state: bundleState,
        platform: Capacitor.getPlatform(),
        environment: environment.production ? 'production' : 'development',
        api_mode: apiMode,
      }),
    );
  }

  /** Tie events to the staff user. No-op until a real userId is known. */
  identify(userId: string, traits: IdentifyTraits = {}): void {
    if (!userId) return;
    this.safe(() => {
      mixpanel.identify(userId);
      const people: Record<string, unknown> = {};
      if (traits.propertyId != null) people['property_id'] = traits.propertyId;
      if (traits.propertyName) people['property_name'] = traits.propertyName;
      if (traits.company) people['company'] = traits.company;
      if (Object.keys(people).length) mixpanel.people.set(people);
    });
  }

  /** Clear identity on logout so the next user is not merged with the previous. */
  reset(): void {
    this.safe(() => mixpanel.reset());
  }

  /**
   * Fired only when the user actively picks a value from the Auto-Lock sheet — never on
   * load/default/init. The property's mere presence on the profile is the "used this
   * feature" signal, so setting it automatically would make that signal meaningless.
   */
  setAutoLockInterval(minutes: number): void {
    this.safe(() => mixpanel.people.set({ auto_lock_interval: minutes }));
  }

  /**
   * Fired once per biometric lock episode, when it resolves — either the user got back in, or
   * gave up after 3 failed attempts and fell back to a full logout+relogin ('abandoned_logout').
   * `biometry_type` is best-effort: it's what's enrolled on the device, not proof of which method
   * actually satisfied a given unlock — `NativeBiometric.verifyIdentity()` gives no way to tell
   * a biometric success from a device-passcode fallback success.
   */
  trackSessionUnlockResult(p: {
    outcome: 'unlocked' | 'abandoned_logout';
    trigger: 'inactivity' | 'background' | 'cold_start';
    attempts: number;
    auto_lock_minutes: number;
    biometry_type: string;
  }): void {
    this.track('session_unlock_result', { ...p });
  }

  /**
   * Attach the active property to every subsequent event (a Mixpanel super property,
   * distinct from identify()'s People-profile update). Call on session start and on every
   * property switch — mixpanel.register() overwrites the previous value, so a switch
   * correctly updates it. No-op until a property is known. Persisted via localStorage
   * (see main.ts), so it survives into the next cold-start session until overwritten
   * again or cleared by reset() on logout.
   */
  setActiveProperty(propertyId?: number, propertyName?: string): void {
    if (propertyId == null) return;
    this.safe(() => mixpanel.register({ property_id: propertyId, property_name: propertyName }));
  }

  /**
   * Attach the active language to every subsequent event (a Mixpanel super property). Call
   * whenever the resolved language changes — cold-start restore and an explicit picker change.
   * mixpanel.register() overwrites the previous value, so a language switch mid-session
   * correctly re-tags all following events.
   *
   * Lowercased here, not by the caller: LanguageService's `code` is its own internal
   * Title-Case form ("En", "Hu" — used to key its translation maps), not an ISO code. Normalizing
   * at this boundary keeps Mixpanel breakdowns on one casing regardless of caller.
   */
  setLanguage(code: string): void {
    if (!code) return;
    this.safe(() => mixpanel.register({ language: code.toLowerCase() }));
  }

  // ---- session lifecycle (driven by Capacitor App.appStateChange) ----

  handleAppActive(): void {
    if (this.foreground) return; // ignore duplicate active signals
    this.foreground = true;
    const now = Date.now();
    const isNewSession =
      !this.started || (this.lastBackgroundAt > 0 && now - this.lastBackgroundAt > SESSION_IDLE_MS);
    this.foregroundStart = now;
    if (isNewSession) {
      this.sessionId = this.uuid();
      this.started = true;
      this.safe(() => mixpanel.register({ session_id: this.sessionId }));
      this.track('session_started', { session_id: this.sessionId });
    }
  }

  handleAppBackground(): void {
    if (!this.foreground) return;
    this.foreground = false;
    if (!this.started) return;
    const now = Date.now();
    this.lastBackgroundAt = now;
    this.track('session_ended', {
      session_id: this.sessionId,
      duration_seconds: Math.round((now - this.foregroundStart) / 1000),
    });
  }

  // ---- typed event helpers (one per tracked interaction) ----

  trackLogin(): void {
    this.track('login_completed', { method: 'mfa' });
  }

  trackPropertySwitched(p: {
    property_id: string | number;
    property_name?: string;
    from_property_id?: string | number;
  }): void {
    this.track('property_switched', { ...p });
  }

  trackSearchPerformed(p: { query_length: number; results_count: number; from_recent: boolean }): void {
    this.track('search_performed', { ...p });
  }

  trackGuestUpdated(p: {
    reservation_code: string;
    property_id?: string | number;
    from_scan: boolean;
    fields_changed?: number;
  }): void {
    this.track('guest_updated', { ...p });
  }

  /**
   * One per country-picker sheet session (Citizenship / Address country on Guest Edit), fired
   * when it closes. Never carries the country itself — nationality is guest PII here.
   */
  trackCountryPickerUsed(p: {
    field: 'citizenship' | 'country_code';
    outcome: 'picked' | 'cleared' | 'dismissed';
    picked_from?: 'top' | 'list' | 'search';
    top_rank?: number;
    top_count: number;
    used_search: boolean;
    query_length: number;
    changed: boolean;
  }): void {
    this.track('country_picker_used', { ...p });
  }

  trackScanResultEdited(p: { document_type?: string }): void {
    this.track('scan_result_edited', { ...p });
  }

  trackScanResultSaved(p: { document_type?: string }): void {
    this.track('scan_result_saved', { ...p });
  }

  trackScanStarted(p: {
    vendor: 'idscanly';
    document_type: string;
    source: 'guest_card' | 'fab_menu';
  }): void {
    this.track('scan_started', { ...p });
  }

  /**
   * One event per captured side (fires again on a retake's recapture — no separate retake
   * event needed, the second capture_completed for the same side carries its own quality
   * score).
   */
  trackScanCaptureCompleted(p: {
    vendor: 'idscanly';
    document_type: string;
    side: string;
    source: 'auto' | 'manual';
    quality_verdict: 'good' | 'recheck';
    sharp: boolean;
    well_lit: boolean;
    glare_free: boolean;
    complete: boolean;
  }): void {
    this.track('scan_capture_completed', { ...p });
  }

  trackScanDiscarded(p: {
    vendor: 'idscanly';
    document_type: string;
    stage: 'capture' | 'review';
    sides_captured: number;
  }): void {
    this.track('scan_discarded', { ...p });
  }

  trackScanSucceeded(p: {
    vendor: 'idscanly';
    document_type: string;
    attempts: number;
    is_complete?: boolean;
    is_processing?: boolean;
    image_count?: number;
    successful_image_count?: number;
    failed_image_count?: number;
    /** Bucket-level form the user picked on the scan screen — 'id' covers the Card toggle
     *  (id-card/driving-licence/address-card all share it today), 'passport' the Passport
     *  toggle. Distinct from document_type — see the call site for why. */
    document_form: 'id' | 'passport';
    /** true iff at least one submitted side was actually captured via auto-detection, not
     *  just whether the auto-capture toggle was left on. */
    auto_capture_used: boolean;
    /** true for a 2-sided document type whose back side was skipped (or never captured);
     *  always false for single-sided types (passport) — nothing to skip. */
    '2nd_page_skipped': boolean;
    /** true if the torch was turned on at any point during this scan session. */
    flash_used: boolean;
    /** Wall-clock time from starting the capture session to this successful submit. */
    scan_duration_seconds?: number;
    /** Milliseconds spent in the idrecognition request alone (incl. network retries). */
    recognition_duration_ms?: number;
    /** Approx. size of the submitted images (base64 data URLs) in KB — a likely driver of duration. */
    payload_kb?: number;
  }): void {
    this.track('scan_succeeded', { ...p });
  }

  trackScanFailed(p: {
    vendor: 'idscanly';
    document_type?: string;
    reason:
      | 'error'
      | 'network_error'
      | 'http_error'
      | 'empty_response'
      | 'camera_unavailable';
    attempt_number: number;
    /** Time until the failure surfaced; undefined if it failed before the request started. */
    recognition_duration_ms?: number;
    payload_kb?: number;
  }): void {
    this.track('scan_failed', { ...p });
  }

  // ---- home filter chips ----

  /** Fires only on a genuine chip tap — never when the saved selection is restored at
   *  launch, and never when the service silently falls back to another filter because the
   *  previously-selected one was deleted (see FilterService.selectFilter vs. its private
   *  silent setSelection()). `position` is the tapped chip's 0-based index in the strip at
   *  tap time — answers "do people only ever use what's visible without scrolling." */
  trackFilterChipSelected(p: {
    filter_id: string;
    is_preset: boolean;
    guests: string;
    day: string;
    sort: string;
    position: number;
  }): void {
    this.track('filter_chip_selected', { ...p });
  }

  trackFilterCreated(p: { filter_id: string; guests: string; day: string; sort: string }): void {
    this.track('filter_created', { ...p });
  }

  /** `is_preset` distinguishes "edited one of the 4 seeded presets" from "edited a filter I
   *  already made myself" — the former is the specific "changed anything in the presets"
   *  signal; a plain edit count conflates the two. */
  trackFilterEdited(p: { filter_id: string; guests: string; day: string; sort: string; is_preset: boolean }): void {
    this.track('filter_edited', { ...p });
  }

  trackFilterDeleted(p: { filter_id: string; is_preset: boolean }): void {
    this.track('filter_deleted', { ...p });
  }

  trackFilterReordered(p: { filter_id_order: string[] }): void {
    this.track('filter_reordered', { ...p });
  }

  /** Tapping the filter icon that opens Manage Filters — previously untracked, so there was
   *  no way to tell how many users ever discover that screen at all, as opposed to just
   *  tapping between the chips already on the strip. */
  trackManageFiltersOpened(p: { filter_count: number }): void {
    this.track('manage_filters_opened', { ...p });
  }

  /**
   * Fired once per analytics session (deduped against `handleAppActive()`'s own `sessionId`,
   * not a separate timer) — the first time Home resolves its filter data within that session.
   * This is the missing "baseline" half of the per-session engagement picture:
   * `filter_chip_selected` only ever fires on a real tap, so a session with zero of those
   * events is ambiguous on its own — stuck on the default because they never looked, or
   * deliberately sat on a filter they already like? Recording what was ALREADY selected when
   * the session began, once, makes that distinction answerable: pair this event's
   * `active_filter_position`/`active_filter_is_preset` with the count of
   * `filter_chip_selected` events sharing the same `session_id` super property.
   */
  trackFilterStripSessionBaseline(p: {
    active_filter_id: string;
    active_filter_position: number;
    active_filter_is_preset: boolean;
    guests: string;
    day: string;
    sort: string;
    filter_count: number;
  }): void {
    if (this.lastFilterBaselineSessionId === this.sessionId) return;
    this.lastFilterBaselineSessionId = this.sessionId;
    this.track('filter_strip_session_baseline', { ...p });
  }

  /** Fired only on the FIRST create/edit/delete/reorder a user ever performs — never on
   *  load/seeding/default. Same convention as setAutoLockInterval: the property's mere
   *  presence on the profile is the "customized this feature" signal. */
  setHomeFiltersCustomized(): void {
    this.safe(() => mixpanel.people.set({ home_filters_customized: true }));
  }

  /** Kept in sync on every seed/create/delete so Mixpanel can report the average/distribution
   *  of how many filters a user keeps, straight off the People profile — no event math. */
  setHomeFilterCount(count: number): void {
    this.safe(() => mixpanel.people.set({ home_filter_count: count }));
  }

  // ---- help & tips ----

  /**
   * Fires when a tip card is actually visible on screen — for Home's carousel this means the
   * card scrolled into view (activeTipIndex in home.page.ts), NOT merely present in the
   * array. A one-card-at-a-time carousel only shows one of up to 3 cards at once, so tying
   * this to array membership would overcount cards 2 and 3 as "shown" before the user ever
   * scrolled to them.
   */
  trackTipCardShown(p: { card_id: string; category: string; surface: 'home' | 'list' }): void {
    this.track('help_card_shown', { ...p });
  }

  trackTipCardOpened(p: { card_id: string; category: string; surface: 'home' | 'list' }): void {
    this.track('help_card_opened', { ...p });
  }

  trackTipCardTryItTapped(p: { card_id: string; category: string }): void {
    this.track('help_card_try_it_tapped', { ...p });
  }

  trackTipCardDismissed(p: { card_id: string; category: string }): void {
    this.track('help_card_dismissed', { ...p });
  }

  /** One event with a `rating` enum, not two separate up/down events — same convention as
   *  trackSessionUnlockResult's `outcome` field. */
  trackTipCardFeedback(p: { card_id: string; category: string; rating: 'up' | 'down' }): void {
    this.track('help_card_feedback', { ...p });
  }

  // ---- live updates (OTA) ----

  trackBundleDownloaded(p: { bundle_id: string; channel: string }): void {
    this.track('bundle_downloaded', { ...p });
  }

  trackBundleApplied(p: { bundle_id: string }): void {
    this.track('bundle_applied', { ...p });
  }

  /**
   * `plugin_unavailable` means the native side is missing on a real device (e.g. the pod was
   * never added to ios/App/Podfile) — distinct from a runtime sync failure, because it otherwise
   * looks exactly like a healthy device that simply has no bundle yet.
   */
  trackBundleFailed(p: {
    reason: 'rollback' | 'sync_error' | 'plugin_unavailable';
    bundle_id?: string;
  }): void {
    this.track('bundle_failed', { ...p });
  }

  /**
   * A staged bundle was NOT applied because a flow held the busy guard (mid-scan, dirty form).
   * Only fires when a bundle actually exists to apply — otherwise a device whose staff scan a
   * lot would look identical to one genuinely stuck several bundles behind.
   */
  trackBundleApplyDeferred(p: { bundle_id: string; channel: string }): void {
    this.track('bundle_apply_deferred', { ...p });
  }

  /**
   * Landed on lastHealthyBundleId instead of the native watchdog's default rollback target —
   * see LiveUpdateService.applyRollbackFallback. Fires ahead of registerSuperProps on this boot
   * (the fallback is decided before the version gate), so it carries the PREVIOUS boot's super
   * properties, not this one's — bundle_id on the event itself is the reliable field.
   */
  trackBundleFallbackApplied(p: { bundle_id: string }): void {
    this.track('bundle_fallback_applied', { ...p });
  }

  /** Same super-properties caveat as trackBundleFallbackApplied — see its doc. */
  trackBundleFallbackDeclined(p: { reason: string }): void {
    this.track('bundle_fallback_declined', { ...p });
  }

  // ---- core ----

  track(event: string, props: Record<string, unknown> = {}): void {
    this.safe(() => mixpanel.track(event, props));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* analytics must never break the app */
    }
  }

  private uuid(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
