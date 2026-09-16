/**
 * Pure decision logic for the live-update boot sequence.
 *
 * Deliberately kept out of LiveUpdateService: that file is the only one allowed to import
 * @capawesome/capacitor-live-update, so anything living there can only be exercised on a device.
 * Everything here is a pure function over plain data, so the rules that decide which bundle runs
 * — and which ones get deleted — are unit-testable in karma with no plugin and no device.
 *
 * IMPORTANT CONTEXT, confirmed from the plugin's own native source (LiveUpdate.swift:42 /
 * LiveUpdate.java:130): the rollback watchdog arms in the plugin's CONSTRUCTOR, i.e. on EVERY
 * app launch — not only after a new bundle is applied. A bundle that has been running happily for
 * weeks is re-given 15 seconds to prove backend reachability on every single cold start, or it is
 * dropped straight to the embedded native bundle. `decideReadyGate` exists to stop re-litigating a
 * bundle that already proved itself; `decideRollbackFallback` exists so that when the watchdog
 * does fire, it lands on a bundle known to have worked rather than on native.
 */

import { FALLBACK_COOLDOWN_MS } from '../config/live-update.const';

/** The channels bundles can be published to. Shared with LiveUpdateService's own validation. */
const VALID_CHANNELS = ['prod', 'early', 'dev'];
const DEFAULT_CHANNEL = 'prod';

/**
 * Why a device is running what it is running.
 *
 * Reported to Mixpanel as `bundle_state`. Exists because `bundle_version: 'native'` on its own
 * conflates at least five unrelated situations — a fresh install, a rollback, a new binary, a
 * missing plugin, and web/dev — which makes "native should be ~0% of the fleet" unfalsifiable.
 */
export type BundleBootState =
  | 'ota'
  | 'native_fresh'
  | 'native_after_rollback'
  | 'native_after_binary_change'
  | 'native_plugin_missing'
  | 'native_web'
  | 'ota_after_fallback';

export interface LiveUpdateState {
  /** getVersionCode() when this record was last written. Invalidates everything when it changes. */
  versionCode: string;
  /** The bundle currently applied, and the channel it was published to. */
  installedBundleId: string | null;
  installedBundleChannel: string | null;
  /**
   * The last bundle the plugin's ready() actually confirmed healthy — written by
   * LiveUpdateService.callReady()/markBundleHealthy(), NOT positionally by "a newer bundle
   * replaced this one" (that was the old `previousBundleId`'s behaviour; renamed and re-scoped so
   * the rollback-fallback target is genuinely "known to have worked", never merely "was installed
   * before the one that just failed"). Retained on disk by the prune (see keepSetFor) as the
   * rollback-fallback's only candidate.
   */
  lastHealthyBundleId: string | null;
  /**
   * The channel `lastHealthyBundleId` was running under. Needed because rule (c) clears
   * installedBundleChannel on a rollback, so the fallback target's channel is otherwise
   * unrecoverable — without this, applyChannelChangeIfNeeded would see no recorded channel for
   * the fallback bundle and could wrongly treat a real mismatch as already-correct.
   */
  lastHealthyBundleChannel: string | null;
  /**
   * The channel of the property last selected in a session. Session state — cleared on logout by
   * AuthService.clearSessionData(), unlike installedBundleChannel which is a fact about the disk.
   */
  lastResolvedChannel: string | null;
  /** A downloaded-but-not-yet-applied bundle. Promoted to installed* once it is actually running. */
  stagedBundleId: string | null;
  stagedBundleChannel: string | null;
  /**
   * The bundle id the rollback fallback last force-applied via setNextBundle(), or null. The loop
   * guard: decideRollbackFallback refuses to re-attempt this same candidate within
   * FALLBACK_COOLDOWN_MS, which is what stops native → fallback → fails-again → native → ... from
   * looping when the real cause is a backend outage rather than the candidate bundle itself.
   * Cleared by LiveUpdateService.callReady() once ready() actually confirms a bundle is running —
   * see that method's doc for why it is NOT cleared the moment the fallback bundle merely boots.
   */
  fallbackAttemptedFor: string | null;
  /** Paired with fallbackAttemptedFor — when the attempt above was made, for the cooldown check. */
  fallbackAttemptedAt: number | null;
}

export function emptyState(versionCode: string): LiveUpdateState {
  return {
    versionCode,
    installedBundleId: null,
    installedBundleChannel: null,
    lastHealthyBundleId: null,
    lastHealthyBundleChannel: null,
    lastResolvedChannel: null,
    stagedBundleId: null,
    stagedBundleChannel: null,
    fallbackAttemptedFor: null,
    fallbackAttemptedAt: null,
  };
}

/**
 * Trims and validates a channel value, returning null (not a default) when it doesn't survive —
 * "unknown" and "known to be prod" are different facts, and callers need to tell them apart.
 * The trim matters: this table has held a value with a trailing newline before.
 */
export function validateChannel(candidate: string | null | undefined): string | null {
  const trimmed = (candidate ?? '').trim();
  return VALID_CHANNELS.includes(trimmed) ? trimmed : null;
}

/**
 * Which channel to sync against at boot, before any network call.
 *
 * The property's channel (session state, known when a session was restored) is better information
 * than the disk's, so it wins; the disk's channel keeps a logged-out canary device on its own
 * channel instead of yanking it to prod. Fails closed to prod on anything absent or
 * unrecognised — the same rule LiveUpdateService.setChannelForProperty() applies.
 */
export function resolveSyncChannel(record: LiveUpdateState | null): string {
  return (
    validateChannel(record?.lastResolvedChannel) ??
    validateChannel(record?.installedBundleChannel) ??
    DEFAULT_CHANNEL
  );
}

/**
 * Reconcile the persisted record against what the plugin actually reports at boot.
 *
 * Rules are ordered and the order matters — a binary change invalidates everything, so it is
 * checked before any promotion or rollback handling.
 *
 * `channelHint` is a one-time migration seed, not a general input. It exists for exactly one
 * boot: the first time this record's fields are read on a device that already has a bundle
 * applied via the pre-existing checkAndApply()/setChannelForProperty() flow, which never wrote
 * installedBundleChannel. Without it, that device's first boot on the new code would resolve its
 * pre-login sync channel to 'prod' regardless of which channel it actually runs — for a
 * pilot device on `dev`, briefly syncing (and potentially reloading into) the wrong channel before
 * `loadPropertyConfig()` corrects it moments later. The caller only bothers resolving this when
 * the gap it fills actually exists (see LiveUpdateService.resolveBundleState), so it costs nothing
 * on every other boot.
 */
export function reconcileBootState(
  record: LiveUpdateState | null,
  facts: { currentBundleId: string | null; versionCode: string; channelHint?: string | null },
): { state: BundleBootState; nextRecord: LiveUpdateState } {
  const { currentBundleId, versionCode } = facts;

  // (a) New native binary. The plugin itself clears its stored bundle path when the binary
  // version changes, so anything we remembered about on-disk bundles is now untrustworthy: a
  // bundle built against the previous binary may call an API this one no longer has. The
  // --ios-min/--android-min floor does not help here, because it gates what gets *sent*, not what
  // is already on disk. lastResolvedChannel survives — it describes a property, not a bundle.
  if (record && record.versionCode !== versionCode) {
    return {
      state: currentBundleId ? 'ota' : 'native_after_binary_change',
      nextRecord: {
        ...emptyState(versionCode),
        lastResolvedChannel: record.lastResolvedChannel,
      },
    };
  }

  const base = record ?? emptyState(versionCode);

  // (b) A staged bundle is now the running one, so the apply succeeded. This is the only place
  // installedBundleChannel is written from a plain sync: doing it at download time would claim a
  // channel the disk does not have if the apply never happened or was rolled back.
  //
  // lastHealthyBundleId is deliberately NOT written here (unlike the old previousBundleId it
  // replaces) — it must only ever be set once LiveUpdateService.callReady() has actually seen
  // ready() confirm the bundle, never positionally just because a newer bundle displaced it. A
  // bundle that was "installed" but never survived to a confirmed ready() call is not "known to
  // have worked", and must not become a rollback-fallback candidate.
  if (currentBundleId && currentBundleId === base.stagedBundleId) {
    // A plain sync+apply is unrelated to a pending forced fallback UNLESS this happens to be
    // exactly the fallback candidate arriving back through the ordinary channel — in that case
    // leave the marker for callReady() to clear once ready() actually confirms it, rather than
    // clearing it here on the strength of it merely being staged.
    const isFallbackCandidate = currentBundleId === base.fallbackAttemptedFor;
    return {
      state: 'ota',
      nextRecord: {
        ...base,
        versionCode,
        installedBundleId: currentBundleId,
        installedBundleChannel: base.stagedBundleChannel,
        stagedBundleId: null,
        stagedBundleChannel: null,
        fallbackAttemptedFor: isFallbackCandidate ? base.fallbackAttemptedFor : null,
        fallbackAttemptedAt: isFallbackCandidate ? base.fallbackAttemptedAt : null,
      },
    };
  }

  // (c) Running the embedded native bundle. Either nothing was ever applied, or the native
  // watchdog rolled back. Native has no channel, so clear it — the next boot correctly defaults to
  // prod, and a device that is really on early/dev is corrected at property selection.
  // lastHealthyBundleId is deliberately KEPT: it is the rollback-fallback's only candidate.
  //
  // Reports native_after_rollback only when this record shows real prior bundle activity — a
  // record can otherwise exist (e.g. only lastResolvedChannel set) for a device that has never
  // actually received a bundle, which must report native_fresh, not falsely claim a rollback.
  if (!currentBundleId) {
    return {
      state: base.installedBundleId || base.lastHealthyBundleId ? 'native_after_rollback' : 'native_fresh',
      nextRecord: {
        ...base,
        versionCode,
        installedBundleId: null,
        installedBundleChannel: null,
        stagedBundleId: null,
        stagedBundleChannel: null,
      },
    };
  }

  // (c2) The bundle the rollback fallback force-applied (see LiveUpdateService.applyRollbackFallback
  // and decideRollbackFallback) is now the running one. Distinct from (b): this arrives via
  // setNextBundle(), never through stagedBundleId, so rule (b) never sees it. installedBundleChannel
  // is recovered from lastHealthyBundleChannel, since (c) already cleared installedBundleChannel and
  // the fallback bundle's own channel is otherwise unrecoverable.
  //
  // `!base.installedBundleId` makes this idempotent: it fires once, on the fallback bundle's first
  // boot. Once installedBundleId is set, later boots correctly fall through to steady-state (d),
  // even before callReady() gets around to clearing fallbackAttemptedFor.
  //
  // The marker is deliberately left untouched here — LiveUpdateService.callReady() clears it once
  // ready() actually confirms this bundle, not merely on the strength of it now being current.
  if (currentBundleId === base.fallbackAttemptedFor && !base.installedBundleId) {
    return {
      state: 'ota_after_fallback',
      nextRecord: {
        ...base,
        versionCode,
        installedBundleId: currentBundleId,
        installedBundleChannel: base.lastHealthyBundleChannel,
      },
    };
  }

  // (d) Steady state: running an OTA bundle. If its channel isn't recorded — the migration boot
  // described above — seed it from the plugin's current setChannel() value. Any boot after this
  // one already has installedBundleChannel set (by this seed, or by rule (b)), so the seed never
  // runs twice for the same bundle.
  if (!base.installedBundleChannel) {
    return {
      state: 'ota',
      nextRecord: {
        ...base,
        versionCode,
        installedBundleId: currentBundleId,
        installedBundleChannel: validateChannel(facts.channelHint),
      },
    };
  }

  return { state: 'ota', nextRecord: { ...base, versionCode } };
}

/**
 * Why the pre-login gate did or did not reload, for everything decidable before paying for the
 * ready() race. `proceed` means "nothing cheap disqualifies a reload" — the caller still has to
 * confirm ready() has settled before actually reloading.
 */
export type PreReadyReloadDecision = 'proceed' | 'nothing-staged' | 'past-deadline' | 'busy';

/**
 * The gate's reload guards, in the order they must be evaluated.
 *
 * Pure so the ordering is testable without the plugin, which cannot be stubbed (Capacitor's
 * registerPlugin returns a proxy that synthesizes its methods on read, so spyOn does not take).
 * The order is load-bearing: establishing that something is actually staged BEFORE consulting the
 * busy guard is what stops a device whose staff simply scan a lot from emitting a deferred event
 * on every boot and looking indistinguishable from one genuinely stuck several bundles behind.
 */
export function decideReloadBeforeReady(facts: {
  stagedBundleId: string | null;
  now: number;
  deadlineMs: number;
  busy: boolean;
}): PreReadyReloadDecision {
  if (!facts.stagedBundleId) return 'nothing-staged';
  // Past the cut-off the user is about to see the app; leave it staged rather than reloading
  // under someone who may already be typing their password.
  if (facts.now >= facts.deadlineMs) return 'past-deadline';
  if (facts.busy) return 'busy';
  return 'proceed';
}

/**
 * Bundles that must survive the prune.
 *
 * `previous` is in the set on purpose. Keeping only the live pair would delete the natural
 * last-working candidate before that feature is ever built — and guarantee that the data gathered
 * to justify building it always reads "no viable fallback target existed".
 */
export function keepSetFor(ids: {
  current: string | null;
  next: string | null;
  previous: string | null;
}): Set<string> {
  return new Set([ids.current, ids.next, ids.previous].filter((id): id is string => !!id));
}

/** Whether this launch must earn ready() the hard way, or can confirm it immediately. */
export type ReadyGateDecision = 'confirm-immediately' | 'probe-required';

/**
 * Whether the running bundle already proved itself on a previous boot.
 *
 * The native watchdog arms on EVERY launch (LiveUpdate.swift:42 / LiveUpdate.java:130), not only
 * after a new bundle is applied — so without this, a bundle that has been running unchanged for
 * weeks re-risks the entire OTA chain on one network call, every single time the app starts. A
 * bundle cannot have become broken while sitting untouched on disk between launches; only a
 * bundle running for the FIRST time (or one that was applied but never confirmed) needs to earn
 * its ready() over the network.
 */
export function decideReadyGate(facts: {
  currentBundleId: string | null;
  lastHealthyBundleId: string | null;
}): ReadyGateDecision {
  if (facts.currentBundleId && facts.currentBundleId === facts.lastHealthyBundleId) {
    return 'confirm-immediately';
  }
  return 'probe-required';
}

/** Why the rollback fallback declined to force-apply lastHealthyBundleId. */
export type FallbackDeclineReason =
  | 'not-after-rollback'
  | 'no-candidate'
  | 'already-attempted'
  | 'not-downloaded'
  | 'blocked';

export type RollbackFallbackDecision =
  | { apply: true; bundleId: string }
  | { apply: false; reason: FallbackDeclineReason };

/**
 * Whether to force-apply lastHealthyBundleId instead of accepting the native watchdog's default
 * rollback target (the embedded native bundle) — see LiveUpdateService.applyRollbackFallback for
 * the I/O this drives.
 *
 * Order is load-bearing (each check has its own test): state and candidate first — cheapest,
 * decided without touching the plugin further — then the cooldown, before the disk/blocklist
 * checks, so a repeat attempt on the same candidate within the window is rejected without needing
 * fresh plugin data at all.
 */
export function decideRollbackFallback(facts: {
  state: BundleBootState;
  lastHealthyBundleId: string | null;
  fallbackAttemptedFor: string | null;
  fallbackAttemptedAt: number | null;
  now: number;
  downloadedBundleIds: string[];
  blockedBundleIds: string[];
}): RollbackFallbackDecision {
  // Not native_after_binary_change: a bundle built against the previous native binary may call an
  // API this one no longer has — the same reason rule (a) wipes all bundle state on a version
  // change. Not native_fresh: nothing has ever run, so there is no candidate by definition either.
  if (facts.state !== 'native_after_rollback') {
    return { apply: false, reason: 'not-after-rollback' };
  }

  const candidate = facts.lastHealthyBundleId;
  if (!candidate) return { apply: false, reason: 'no-candidate' };

  // A marker that never clears must not kill the feature forever — only refuse a REPEAT of the
  // same candidate within the cooldown window. `now - attemptedAt` is negative (and so already
  // "less than" the cooldown) if the clock has moved backwards since the attempt, which correctly
  // keeps that case inside the window too, with no special-casing needed.
  if (
    facts.fallbackAttemptedFor === candidate &&
    facts.fallbackAttemptedAt !== null &&
    facts.now - facts.fallbackAttemptedAt < FALLBACK_COOLDOWN_MS
  ) {
    return { apply: false, reason: 'already-attempted' };
  }

  if (!facts.downloadedBundleIds.includes(candidate)) {
    return { apply: false, reason: 'not-downloaded' };
  }

  // The plugin blocklisted this bundle after a rollback it caused itself (autoBlockRolledBackBundles)
  // — respect that rather than override it.
  if (facts.blockedBundleIds.includes(candidate)) {
    return { apply: false, reason: 'blocked' };
  }

  return { apply: true, bundleId: candidate };
}
