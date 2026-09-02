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
  }): void {
    this.track('scan_failed', { ...p });
  }

  trackHomeSegmentChanged(segment: string): void {
    this.track('home_segment_changed', { segment });
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
