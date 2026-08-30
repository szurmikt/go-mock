/**
 * Pure decision logic for the live-update boot sequence.
 *
 * Deliberately kept out of LiveUpdateService: that file is the only one allowed to import
 * @capawesome/capacitor-live-update, so anything living there can only be exercised on a device.
 * Everything here is a pure function over plain data, so the rules that decide which bundle runs
 * — and which ones get deleted — are unit-testable in karma with no plugin and no device.
 */

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
  | 'native_web';

export interface LiveUpdateState {
  /** getVersionCode() when this record was last written. Invalidates everything when it changes. */
  versionCode: string;
  /** The bundle currently applied, and the channel it was published to. */
  installedBundleId: string | null;
  installedBundleChannel: string | null;
  /**
   * The bundle the installed one replaced. Retained on disk by the prune (see keepSetFor) both as
   * evidence for the live_update_events rollback row and as the future last-working target.
   */
  previousBundleId: string | null;
  /**
   * The channel of the property last selected in a session. Session state — cleared on logout by
   * AuthService.clearSessionData(), unlike installedBundleChannel which is a fact about the disk.
   */
  lastResolvedChannel: string | null;
  /** A downloaded-but-not-yet-applied bundle. Promoted to installed* once it is actually running. */
  stagedBundleId: string | null;
  stagedBundleChannel: string | null;
}

export function emptyState(versionCode: string): LiveUpdateState {
  return {
    versionCode,
    installedBundleId: null,
    installedBundleChannel: null,
    previousBundleId: null,
    lastResolvedChannel: null,
    stagedBundleId: null,
    stagedBundleChannel: null,
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
  // installedBundleChannel is written: doing it at download time would claim a channel the disk
  // does not have if the apply never happened or was rolled back.
  if (currentBundleId && currentBundleId === base.stagedBundleId) {
    return {
      state: 'ota',
      nextRecord: {
        ...base,
        versionCode,
        installedBundleId: currentBundleId,
        installedBundleChannel: base.stagedBundleChannel,
        previousBundleId: base.installedBundleId,
        stagedBundleId: null,
        stagedBundleChannel: null,
      },
    };
  }

  // (c) Running the embedded native bundle. Either nothing was ever applied, or the native
  // watchdog rolled back. Native has no channel, so clear it — the next boot correctly defaults to
  // prod, and a device that is really on early/dev is corrected at property selection.
  // previousBundleId is deliberately KEPT: it is what the rollback row records as still-on-disk,
  // and the future last-working fallback's only candidate.
  if (!currentBundleId) {
    return {
      state: record ? 'native_after_rollback' : 'native_fresh',
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
