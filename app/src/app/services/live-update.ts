import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';
import * as Sentry from '@sentry/angular';
import { FALLBACK_TELEMETRY_TIMEOUT_MS, READY_RACE_MS } from '../config/live-update.const';
import { Config } from '../config/config';
import {
  BundleBootState,
  LiveUpdateState,
  decideReady,
  decideReadyGate,
  decideReloadBeforeReady,
  decideRollbackFallback,
  emptyState,
  keepSetFor,
  reconcileBootState,
  resolveSyncChannel,
} from '../utils/live-update-state';
import { BusyGuardService } from './busy-guard';
import { LiveUpdateEventsService } from './live-update-events.service';
import { MixpanelService } from './mixpanel';
import { StorageService } from './storage';

/** Reported as bundle_version when no OTA bundle is active (fresh install, or web/dev). */
const NATIVE_BUNDLE = 'native';

// dev = internal testing, early = early adopters, prod = everyone else (renamed 2026-08-31 from
// dev/beta/production — see the CLAUDE.md changelog for the full list of touched files).
const VALID_CHANNELS = ['prod', 'early', 'dev'] as const;
export type LiveUpdateChannel = (typeof VALID_CHANNELS)[number];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * The ONLY file in the app that imports @capawesome/capacitor-live-update. Nothing else may
 * import it — that constraint is what keeps a future migration to self-hosted bundles down to
 * one file. The decision logic itself lives in utils/live-update-state.ts as pure functions, so
 * it can be tested without a device.
 *
 * Every entry point checks available() first and wraps the call: a live-update failure must never
 * break the app it is meant to be updating. Absence is silent on web and reported on device —
 * see available().
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdateService {
  private readonly busyGuard = inject(BusyGuardService);
  private readonly mixpanel = inject(MixpanelService);
  private readonly storage = inject(StorageService);
  private readonly events = inject(LiveUpdateEventsService);

  /** The bundle actually running. Read by Mixpanel (bundle_version) and the Settings screen. */
  readonly currentBundleId = signal<string>(NATIVE_BUNDLE);

  /**
   * Why the device is running what it is running. Reported as the bundle_state super property,
   * which is what makes "bundle_version: native should be ~0%" a falsifiable target rather than a
   * number that conflates fresh installs, rollbacks, new binaries and missing plugins.
   */
  readonly bundleState = signal<BundleBootState>('native_web');

  /** Resolved channel, for telemetry context. Defaults to the capacitor.config.ts fallback. */
  private channel: string = 'prod';

  /** Report a missing native plugin once per session, not on every resume. */
  private unavailableReported = false;

  /**
   * The channel applyChannelChangeIfNeeded most recently confirmed, whether or not anything
   * needed to change. In-memory only — resets on process restart, where the boot sequence's own
   * checks take over regardless. Lets a run of property switches that land on the same channel
   * (a front-desk device toggling between a hotel's own properties, all on `production`) skip a
   * real network round trip after the first one, instead of re-verifying an unchanged channel on
   * every single switch — that round trip was the visible "loading" flash on each switch.
   *
   * Deliberately scoped to THIS method only, not shared with checkAndApply()'s other callers
   * (boot's degraded path, the ≥90s resume trigger). Those exist specifically to catch a bundle
   * that was published while the channel itself stayed the same, and this shortcut must never
   * suppress that — it is a "should skip", not a "must skip".
   */
  private lastVerifiedChannel: string | null = null;

  /**
   * Resolves when the boot-time ready() call has finished. The setup gate races this before
   * reloading — see syncAndInstallNow(). Starts resolved so a device that never calls ready()
   * (web, plugin missing) does not deadlock the gate.
   */
  private readyDone: Promise<void> = Promise.resolve();

  /**
   * The single in-flight sync(), if any. Every sync entry point funnels through runSync() so the
   * pre-login gate and the property-config channel correction — which run concurrently at boot —
   * cannot both start a download of the same bundle.
   */
  private syncInFlight: Promise<string | null> | null = null;

  /**
   * Whether the persisted record has been read this session. Boot reads it once; later writers
   * re-read rather than caching a mutable copy, since a reload can land between any two writes.
   *
   * Normalizes every field on every read (rather than trusting the stored shape), because a
   * record written before the lastHealthyBundleId rename/fallback fields were added has none of
   * them — `previousBundleId` was the old name for lastHealthyBundleId, and the three new fields
   * were simply absent. Safe to remove once the fleet has rewritten every record under the new
   * shape at least once (any boot that reaches writeRecord() does that).
   */
  private async readRecord(): Promise<LiveUpdateState | null> {
    const raw = await this.storage.get<
      Partial<LiveUpdateState> & { previousBundleId?: string | null }
    >(Config.STORAGE_LIVE_UPDATE_KEY);
    if (!raw) return null;
    return {
      versionCode: raw.versionCode ?? '',
      installedBundleId: raw.installedBundleId ?? null,
      installedBundleChannel: raw.installedBundleChannel ?? null,
      lastHealthyBundleId: raw.lastHealthyBundleId ?? raw.previousBundleId ?? null,
      lastHealthyBundleChannel: raw.lastHealthyBundleChannel ?? null,
      lastResolvedChannel: raw.lastResolvedChannel ?? null,
      stagedBundleId: raw.stagedBundleId ?? null,
      stagedBundleChannel: raw.stagedBundleChannel ?? null,
      fallbackAttemptedFor: raw.fallbackAttemptedFor ?? null,
      fallbackAttemptedAt: raw.fallbackAttemptedAt ?? null,
    };
  }

  private async writeRecord(record: LiveUpdateState): Promise<void> {
    await this.storage.set(Config.STORAGE_LIVE_UPDATE_KEY, record);
  }

  /**
   * Whether the plugin can actually be called.
   *
   * On web/`ionic serve` the plugin is absent by design — silent. On a device it means the native
   * side never registered (the usual cause: the pod was not added to ios/App/Podfile, which
   * `cap sync` does not do — see CLAUDE.md §16). That case must be loud: without OTA the app
   * keeps working and reports `bundle_version: 'native'`, which is indistinguishable from a
   * healthy device that has simply not received a bundle yet. Left silent, a whole platform can
   * stop updating and the only symptom is a hotel eventually asking why nothing changed.
   */
  private available(): boolean {
    if (!Capacitor.isNativePlatform()) return false;
    if (Capacitor.isPluginAvailable('LiveUpdate')) return true;

    if (!this.unavailableReported) {
      this.unavailableReported = true;
      this.bundleState.set('native_plugin_missing');
      this.mixpanel.trackBundleFailed({ reason: 'plugin_unavailable' });
      Sentry.captureException(new Error('LiveUpdate plugin unavailable on native platform'), {
        tags: { context: 'live_update_plugin_missing', platform: Capacitor.getPlatform() },
      });
    }
    return false;
  }

  /**
   * Read which bundle is running. Deliberately independent of callReady() and of any backend
   * call: which bundle is active is a purely local fact, so a device booting on a flaky network
   * must still report its real bundle_version rather than falling back to 'native'.
   */
  async initBundleVersion(): Promise<void> {
    if (!this.available()) return;
    try {
      const { bundleId } = await LiveUpdate.getCurrentBundle();
      this.currentBundleId.set(bundleId ?? NATIVE_BUNDLE);
    } catch (error) {
      Sentry.captureException(error, { tags: { context: 'live_update_current_bundle' } });
    }
  }

  /**
   * Reconcile the persisted record against what the plugin reports, then prune old bundles.
   *
   * Runs once at boot, after initBundleVersion() and before the version gate — it is entirely
   * local (no network) and its result feeds both the sync channel and the bundle_state super
   * property. All the branching lives in reconcileBootState(); this method is the I/O around it.
   *
   * Returns true when a rollback fallback was just applied — LiveUpdate.reload() has already been
   * called, so the caller (AppComponent.ngOnInit) MUST stop immediately rather than continue the
   * rest of boot (a redundant version-gate call, a redundant callReady(), etc.) against a webview
   * that is about to be torn down anyway.
   */
  async resolveBundleState(): Promise<boolean> {
    if (!this.available()) {
      this.bundleState.set(Capacitor.isNativePlatform() ? 'native_plugin_missing' : 'native_web');
      return false;
    }
    try {
      const { versionCode } = await LiveUpdate.getVersionCode();
      const currentBundleId = (await LiveUpdate.getCurrentBundle()).bundleId;
      const record = await this.readRecord();

      // Only worth asking the plugin when the gap this seed exists for is actually present: a
      // bundle is running but we have no record of its channel (the one-time migration boot —
      // see reconcileBootState's channelHint doc). Every later boot skips this call entirely.
      let channelHint: string | null = null;
      if (currentBundleId && !record?.installedBundleChannel) {
        try {
          channelHint = (await LiveUpdate.getChannel()).channel;
        } catch {
          /* best-effort — reconcileBootState treats a missing hint the same as an invalid one */
        }
      }

      const { state, nextRecord } = reconcileBootState(record, {
        currentBundleId,
        versionCode,
        channelHint,
      });
      this.bundleState.set(state);
      await this.writeRecord(nextRecord);

      if (await this.applyRollbackFallback(state, nextRecord)) {
        return true;
      }

      await this.pruneBundles(currentBundleId, nextRecord);
      return false;
    } catch (error) {
      Sentry.captureException(error, { tags: { context: 'live_update_resolve_state' } });
      return false;
    }
  }

  /**
   * When the watchdog reverted to native, try to land on lastHealthyBundleId instead of accepting
   * native — see decideRollbackFallback for the full rule set. Called from resolveBundleState()
   * after the reconciled record is persisted but before pruning (pruning already skips a
   * `!currentBundleId` boot, so the candidate is guaranteed still on disk here).
   *
   * Deliberately does NOT call LiveUpdate.ready() to record the original rollback itself — doing
   * so would consume the plugin's rollbackPerformed flag before the fallback bundle's own boot
   * gets a chance to read it. Left alone, that next boot's callReady() — which decideReadyGate
   * resolves to 'confirm-immediately' precisely because the fallback target IS
   * lastHealthyBundleId — naturally calls ready() and reports rollback:true with the plugin's own
   * authoritative previousBundleId (the flag is still set; nothing reset it in between), so the
   * original rollback still gets recorded, one boot later, with better data than could be
   * reconstructed here.
   *
   * Returns true when a fallback was applied.
   */
  private async applyRollbackFallback(
    state: BundleBootState,
    record: LiveUpdateState,
  ): Promise<boolean> {
    if (state !== 'native_after_rollback') return false;
    try {
      const [downloaded, blocked] = await Promise.all([
        LiveUpdate.getDownloadedBundles().catch(() => ({ bundleIds: [] as string[] })),
        LiveUpdate.getBlockedBundles().catch(() => ({ bundleIds: [] as string[] })),
      ]);

      const decision = decideRollbackFallback({
        state,
        lastHealthyBundleId: record.lastHealthyBundleId,
        fallbackAttemptedFor: record.fallbackAttemptedFor,
        fallbackAttemptedAt: record.fallbackAttemptedAt,
        now: Date.now(),
        downloadedBundleIds: downloaded.bundleIds,
        blockedBundleIds: blocked.bundleIds,
      });

      if (!decision.apply) {
        this.mixpanel.trackBundleFallbackDeclined({ reason: decision.reason });
        return false;
      }

      const { bundleId } = decision;

      // The only durable record of this attempt — nothing downstream re-derives it the way the
      // plain rollback event gets recovered (see this method's doc above). Recorded before
      // reload(), which can kill an in-flight fetch, so it's capped: a dead network must not be
      // allowed to delay landing the device on a working bundle.
      this.mixpanel.trackBundleFallbackApplied({ bundle_id: bundleId });
      await Promise.race([
        this.events.record({
          reason: 'rollback_fallback_applied',
          previousBundleId: bundleId,
          downloadedBundleIds: downloaded.bundleIds,
        }),
        sleep(FALLBACK_TELEMETRY_TIMEOUT_MS),
      ]);

      // Marker written BEFORE setNextBundle/reload — a crash in between still boots onto this
      // bundle next time with the attempt already recorded (so it declines and accepts native,
      // i.e. today's behaviour). The reverse order risks booting onto it with NO marker recorded,
      // which is exactly the reload loop this marker exists to prevent.
      await this.writeRecord({
        ...record,
        fallbackAttemptedFor: bundleId,
        fallbackAttemptedAt: Date.now(),
      });

      await LiveUpdate.setNextBundle({ bundleId });
      await LiveUpdate.reload();
      return true;
    } catch (error) {
      Sentry.captureException(error, { tags: { context: 'live_update_fallback' } });
      return false;
    }
  }

  /**
   * Whether THIS boot's running bundle already proved itself on a previous boot — see
   * decideReadyGate. When true, AppComponent skips the backend probe entirely and confirms
   * immediately: the native watchdog arms on every launch, not only after an update, so without
   * this a bundle that has been running unchanged for weeks would still re-risk the whole OTA
   * chain on one network call, every single time it starts. A bundle cannot have broken while
   * sitting untouched on disk between launches.
   */
  async alreadyConfirmedHealthy(): Promise<boolean> {
    const record = await this.readRecord();
    return (
      decideReadyGate({
        currentBundleId: this.currentBundleId(),
        lastHealthyBundleId: record?.lastHealthyBundleId ?? null,
      }) === 'confirm-immediately'
    );
  }

  /**
   * Confirms (or not) the bundle after a probe attempt, folding in the offline short-circuit —
   * see decideReady. A provably offline device must not have a failed backend probe blamed on
   * the bundle itself.
   */
  callReadyAfterProbe(reachedBackend: boolean): void {
    const { ready } = decideReady({ reachedBackend, online: navigator.onLine });
    this.callReady(ready);
  }

  /**
   * Delete downloaded bundles that are no longer needed. autoDeleteBundles is off, so retention
   * is ours to manage — at 2-4 publishes/week and ~17MB on disk each, unbounded growth is real on
   * shared, often-full hotel devices.
   *
   * ⚠️ Skipped entirely when the device is on the native bundle. That means a rollback just
   * happened, and what is on disk at that moment is precisely the evidence the live_update_events
   * row records — callReady() has not run yet when this executes, so pruning here would guarantee
   * an empty downloaded_bundle_ids on the only rows that matter.
   */
  private async pruneBundles(
    currentBundleId: string | null,
    record: LiveUpdateState,
  ): Promise<void> {
    if (!currentBundleId) return;
    try {
      const nextBundleId = (await LiveUpdate.getNextBundle()).bundleId;
      const keep = keepSetFor({
        current: currentBundleId,
        next: nextBundleId,
        previous: record.lastHealthyBundleId,
      });
      const { bundleIds } = await LiveUpdate.getDownloadedBundles();
      for (const bundleId of bundleIds.filter(id => !keep.has(id))) {
        await LiveUpdate.deleteBundle({ bundleId });
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { context: 'live_update_prune' } });
    }
  }

  /**
   * Confirm the running bundle works, cancelling the native rollback timer.
   *
   * `reachedBackend` must mean a real backend round-trip succeeded — a bundle that renders but
   * cannot reach the backend has to roll back, which is the entire point of the mechanism. When
   * false we simply don't call ready(), and the plugin reverts on its own once readyTimeout
   * elapses.
   *
   * Fire-and-forget by design, and it must stay that way: nothing may be awaited in front of it,
   * or the setup gate would eat into the native readyTimeout it is racing.
   */
  async callReady(reachedBackend: boolean): Promise<void> {
    if (!reachedBackend || !this.available()) return;

    const run = async () => {
      try {
        const { currentBundleId, previousBundleId, rollback } = await LiveUpdate.ready();
        this.currentBundleId.set(currentBundleId ?? NATIVE_BUNDLE);

        if (rollback) {
          this.mixpanel.trackBundleFailed({
            reason: 'rollback',
            bundle_id: previousBundleId ?? undefined,
          });
          // Durable counterpart to the Mixpanel event above, which fires from a webview that may
          // be reloading. Snapshot the disk here, before anything prunes it.
          const downloadedBundleIds = await this.safeDownloadedBundleIds();
          this.events.record({ reason: 'rollback', previousBundleId, downloadedBundleIds });
        } else if (currentBundleId && currentBundleId !== previousBundleId) {
          this.mixpanel.trackBundleApplied({ bundle_id: currentBundleId });
        }

        // Independent of `rollback` above, deliberately: that flag can be stale. After the
        // rollback fallback (applyRollbackFallback) lands on a known-good bundle, the plugin's
        // rollbackPerformed flag from the ORIGINAL failure is often still set — nothing consumed
        // it in between — so this exact call can legitimately report rollback:true for a bundle
        // that is perfectly healthy. What actually means "healthy" is that ready() resolved with
        // a non-null currentBundleId at all: the watchdog is cancelled for it, full stop.
        if (currentBundleId) {
          await this.markBundleHealthy(currentBundleId);
        }
      } catch (error) {
        Sentry.captureException(error, { tags: { context: 'live_update_ready' } });
      }
    };

    this.readyDone = run();
    return this.readyDone;
  }

  /**
   * Records that `bundleId` is now the rollback-fallback candidate for next time, and clears any
   * in-progress fallback attempt marker. Re-reads the record rather than reusing a cached copy —
   * this runs from inside callReady()'s fire-and-forget run(), and a reload can land between any
   * two writes.
   */
  private async markBundleHealthy(bundleId: string): Promise<void> {
    const record = (await this.readRecord()) ?? emptyState('');
    await this.writeRecord({
      ...record,
      lastHealthyBundleId: bundleId,
      lastHealthyBundleChannel: record.installedBundleChannel,
      fallbackAttemptedFor: null,
      fallbackAttemptedAt: null,
    });
  }

  private async safeDownloadedBundleIds(): Promise<string[]> {
    try {
      return (await LiveUpdate.getDownloadedBundles()).bundleIds;
    } catch {
      return [];
    }
  }

  /**
   * Point this device at the channel its property is mapped to. Falls back to 'prod' for
   * anything unrecognised — never fail into early/dev.
   *
   * Also persists the channel as session state, so the next cold boot can sync the right channel
   * before any network call. That value is cleared on logout (see AuthService.clearSessionData);
   * the installed bundle's own channel, which is a fact about the disk, is not.
   */
  async setChannelForProperty(channel: string): Promise<void> {
    const resolved = (VALID_CHANNELS as readonly string[]).includes(channel) ? channel : 'prod';
    this.channel = resolved;

    const record = (await this.readRecord()) ?? emptyState('');
    await this.writeRecord({ ...record, lastResolvedChannel: resolved });

    if (!this.available()) return;
    try {
      await LiveUpdate.setChannel({ channel: resolved });
    } catch (error) {
      Sentry.captureException(error, { tags: { context: 'live_update_set_channel' } });
    }
  }

  /** Clears the persisted property channel without touching what is on disk. */
  async clearResolvedChannel(): Promise<void> {
    const record = await this.readRecord();
    if (!record) return;
    await this.writeRecord({ ...record, lastResolvedChannel: null });
  }

  /**
   * The single funnel for every sync() call.
   *
   * The pre-login gate and loadStoredAuth()'s channel correction both run during boot, in
   * parallel. Without this, both would call sync() and the native download queue would fetch the
   * same bundle twice — the exact double-download this design removes elsewhere.
   */
  private runSync(channel: string): Promise<string | null> {
    if (this.syncInFlight) return this.syncInFlight;

    this.syncInFlight = (async () => {
      try {
        const { nextBundleId } = await LiveUpdate.sync({ channel });
        if (nextBundleId) {
          this.mixpanel.trackBundleDownloaded({ bundle_id: nextBundleId, channel });
          const record = (await this.readRecord()) ?? emptyState('');
          await this.writeRecord({
            ...record,
            stagedBundleId: nextBundleId,
            stagedBundleChannel: channel,
          });
        }
        return nextBundleId;
      } finally {
        this.syncInFlight = null;
      }
    })();

    return this.syncInFlight;
  }

  /**
   * Pre-login setup gate: fetch and apply a bundle while the splash is still up.
   *
   * This is not a reversal of "boot stages, resume applies". That rule rejected a self-restart
   * seconds after the user taps the icon, because it reads as a crash. Here the app has not been
   * shown yet and the reload happens behind the splash — a longer launch, not a restart.
   *
   * Never rejects: the caller's fail-open timer is the backstop, but this must not rely on it.
   */
  async syncAndInstallNow(deadlineMs: number): Promise<void> {
    if (!this.available()) return;
    try {
      const staged = await this.runSync(resolveSyncChannel(await this.readRecord()));

      // Ordering lives in the pure module so it can be tested without the plugin.
      const decision = decideReloadBeforeReady({
        stagedBundleId: staged,
        now: Date.now(),
        deadlineMs,
        // Cannot be busy pre-login (nothing has been shown yet), but free insurance if this is
        // ever reused from a later entry point.
        busy: this.busyGuard.isBusy(),
      });
      if (decision === 'busy' && staged) {
        this.mixpanel.trackBundleApplyDeferred({ bundle_id: staged, channel: this.channel });
      }
      if (decision !== 'proceed') return;

      // Reloading while ready() is still in flight leaves the RUNNING bundle's rollback timer
      // uncancelled, so it can fire mid-transition and — with autoBlockRolledBackBundles — block a
      // perfectly healthy bundle for good. On timeout we must NOT reload: leave it staged.
      const readyResolved = await Promise.race([
        this.readyDone.then(() => true),
        sleep(READY_RACE_MS).then(() => false),
      ]);
      if (!readyResolved) return;

      await LiveUpdate.reload();
    } catch (error) {
      this.mixpanel.trackBundleFailed({ reason: 'sync_error' });
      Sentry.captureException(error, { tags: { context: 'live_update_sync' } });
    }
  }

  /**
   * Correct the running bundle's channel after property selection, but only on a real mismatch.
   *
   * The previous unconditional check-and-apply here cost a full sync (and often a full download
   * plus reload) on every property selection, including re-selecting the same one.
   */
  async applyChannelChangeIfNeeded(allowReload: boolean): Promise<void> {
    if (!this.available()) return;
    const wanted = this.channel;

    // Already confirmed this exact channel earlier in THIS switch sequence — see the field doc
    // for why this is scoped narrowly rather than shared with the resume/degraded-boot paths.
    if (wanted === this.lastVerifiedChannel) return;

    // The boot gate may be mid-sync on this very channel; wait for it before judging the state,
    // or we would both mis-read the mismatch and start a competing download.
    if (this.syncInFlight) await this.syncInFlight.catch(() => null);

    const record = await this.readRecord();
    // The 'native' clause is not optional: a fresh install whose property is 'prod' has no
    // installed channel to mismatch, and without this would never download at all. It's what
    // made a device sitting on native (an empty channel, or the very first check) re-run the full
    // sync() on every single switch prior to the lastVerifiedChannel guard above — that guard is
    // what now stops the repeat, not a change to this clause.
    if (record?.installedBundleChannel === wanted && this.currentBundleId() !== NATIVE_BUNDLE) {
      this.lastVerifiedChannel = wanted;
      return;
    }

    // Only cache on a genuine round trip — checkAndApply() swallows its own errors, so this is
    // the one place that must distinguish "confirmed, nothing to do" from "the check itself
    // failed", or a transient network drop would masquerade as a verified channel.
    if (await this.checkAndApply(allowReload)) {
      this.lastVerifiedChannel = wanted;
    }
  }

  /**
   * Download/stage the latest bundle and, when allowed and safe, apply it.
   *
   * `allowReload` is false at boot and true on resume. Reloading a few seconds after someone taps
   * the app icon reads as a crash, not an update; after a backgrounding it reads as normal. The
   * bundle is staged either way, so boot loses nothing by not reloading.
   *
   * Returns whether the channel was actually confirmed reachable (true even when there was
   * nothing new to apply — "confirmed" means the round trip succeeded, not that a bundle
   * changed). applyChannelChangeIfNeeded uses this to decide whether it's safe to cache the
   * channel as verified: a failed round trip must never be cached, or a real transient failure
   * would silently suppress every later same-channel check for the rest of the session.
   */
  async checkAndApply(allowReload: boolean): Promise<boolean> {
    if (!this.available()) return false;
    try {
      const nextBundleId = await this.runSync(resolveSyncChannel(await this.readRecord()));

      if (!allowReload) return true;

      // Establish that something is actually staged BEFORE consulting the busy guard — otherwise
      // every resume during a scan would emit a deferred event with no bundle to defer.
      // getNextBundle() also catches a bundle staged by an earlier resume that was busy.
      const staged = nextBundleId ?? (await LiveUpdate.getNextBundle()).bundleId;
      if (!staged) return true;

      if (this.busyGuard.isBusy()) {
        this.mixpanel.trackBundleApplyDeferred({ bundle_id: staged, channel: this.channel });
        return true;
      }

      await LiveUpdate.reload();
      return true;
    } catch (error) {
      this.mixpanel.trackBundleFailed({ reason: 'sync_error' });
      Sentry.captureException(error, { tags: { context: 'live_update_sync' } });
      return false;
    }
  }
}
