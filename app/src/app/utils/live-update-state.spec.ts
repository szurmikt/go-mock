import { FALLBACK_COOLDOWN_MS } from '../config/live-update.const';
import {
  decideReady,
  decideReadyGate,
  decideReloadBeforeReady,
  decideRollbackFallback,
  emptyState,
  keepSetFor,
  reconcileBootState,
  resolveSyncChannel,
  validateChannel,
  LiveUpdateState,
} from './live-update-state';

const VC = '103';

function record(overrides: Partial<LiveUpdateState> = {}): LiveUpdateState {
  return { ...emptyState(VC), ...overrides };
}

describe('validateChannel', () => {
  it('accepts a known channel', () => {
    expect(validateChannel('dev')).toBe('dev');
  });

  it('trims before validating', () => {
    expect(validateChannel('dev\n')).toBe('dev');
  });

  it('returns null (not a default) for null, undefined, empty, or unrecognised', () => {
    expect(validateChannel(null)).toBeNull();
    expect(validateChannel(undefined)).toBeNull();
    expect(validateChannel('')).toBeNull();
    expect(validateChannel('staging')).toBeNull();
  });
});

describe('resolveSyncChannel', () => {
  it('falls back to prod with no record (fresh install)', () => {
    expect(resolveSyncChannel(null)).toBe('prod');
  });

  it('prefers the property channel over the disk channel', () => {
    expect(
      resolveSyncChannel(record({ lastResolvedChannel: 'dev', installedBundleChannel: 'early' })),
    ).toBe('dev');
  });

  it('uses the disk channel when there is no session (logged out canary device)', () => {
    expect(
      resolveSyncChannel(record({ lastResolvedChannel: null, installedBundleChannel: 'dev' })),
    ).toBe('dev');
  });

  it('trims before validating (a stored value has carried a trailing newline before)', () => {
    expect(resolveSyncChannel(record({ installedBundleChannel: 'dev\n' }))).toBe('dev');
  });

  it('fails closed to prod on an unrecognised channel', () => {
    expect(resolveSyncChannel(record({ installedBundleChannel: 'staging' }))).toBe('prod');
  });
});

describe('reconcileBootState', () => {
  it('reports native_fresh with no record and no bundle', () => {
    const { state, nextRecord } = reconcileBootState(null, {
      currentBundleId: null,
      versionCode: VC,
    });
    expect(state).toBe('native_fresh');
    expect(nextRecord.installedBundleId).toBeNull();
  });

  it('promotes a staged bundle once it is the running one, and writes its channel', () => {
    const { state, nextRecord } = reconcileBootState(
      record({ stagedBundleId: 'b2', stagedBundleChannel: 'dev', installedBundleId: 'b1' }),
      { currentBundleId: 'b2', versionCode: VC },
    );
    expect(state).toBe('ota');
    expect(nextRecord.installedBundleId).toBe('b2');
    expect(nextRecord.installedBundleChannel).toBe('dev');
    expect(nextRecord.stagedBundleId).toBeNull();
  });

  it('does NOT set lastHealthyBundleId on a plain promotion — only callReady() may, once ready() actually confirms it', () => {
    const { nextRecord } = reconcileBootState(
      record({
        stagedBundleId: 'b2',
        stagedBundleChannel: 'dev',
        installedBundleId: 'b1',
        lastHealthyBundleId: 'b1',
      }),
      { currentBundleId: 'b2', versionCode: VC },
    );
    expect(nextRecord.lastHealthyBundleId).toBe('b1');
  });

  it('clears a stale fallback marker on a plain promotion of a DIFFERENT bundle', () => {
    const { nextRecord } = reconcileBootState(
      record({
        stagedBundleId: 'b2',
        stagedBundleChannel: 'dev',
        fallbackAttemptedFor: 'b1',
        fallbackAttemptedAt: 1_000,
      }),
      { currentBundleId: 'b2', versionCode: VC },
    );
    expect(nextRecord.fallbackAttemptedFor).toBeNull();
    expect(nextRecord.fallbackAttemptedAt).toBeNull();
  });

  it('leaves the fallback marker for callReady() to clear when the promoted bundle IS the fallback candidate', () => {
    const { nextRecord } = reconcileBootState(
      record({
        stagedBundleId: 'b2',
        stagedBundleChannel: 'dev',
        fallbackAttemptedFor: 'b2',
        fallbackAttemptedAt: 1_000,
      }),
      { currentBundleId: 'b2', versionCode: VC },
    );
    expect(nextRecord.fallbackAttemptedFor).toBe('b2');
    expect(nextRecord.fallbackAttemptedAt).toBe(1_000);
  });

  it('does not promote a staged bundle that is not running (apply never happened)', () => {
    const { nextRecord } = reconcileBootState(
      record({ installedBundleId: 'b1', installedBundleChannel: 'dev', stagedBundleId: 'b2' }),
      { currentBundleId: 'b1', versionCode: VC },
    );
    expect(nextRecord.installedBundleChannel).toBe('dev');
    expect(nextRecord.stagedBundleId).toBe('b2');
  });

  it('reports native_after_rollback and clears the installed channel', () => {
    const { state, nextRecord } = reconcileBootState(
      record({ installedBundleId: 'b2', installedBundleChannel: 'dev', lastHealthyBundleId: 'b1' }),
      { currentBundleId: null, versionCode: VC },
    );
    expect(state).toBe('native_after_rollback');
    expect(nextRecord.installedBundleId).toBeNull();
    expect(nextRecord.installedBundleChannel).toBeNull();
  });

  it('KEEPS lastHealthyBundleId on rollback — it is the rollback-fallback\'s only candidate', () => {
    const { nextRecord } = reconcileBootState(
      record({ installedBundleId: 'b2', lastHealthyBundleId: 'b1' }),
      { currentBundleId: null, versionCode: VC },
    );
    expect(nextRecord.lastHealthyBundleId).toBe('b1');
  });

  it('reports native_fresh, not native_after_rollback, for a record with no real bundle activity (e.g. only a resolved channel)', () => {
    const { state } = reconcileBootState(record({ lastResolvedChannel: 'dev' }), {
      currentBundleId: null,
      versionCode: VC,
    });
    expect(state).toBe('native_fresh');
  });

  it('reports native_after_rollback when only lastHealthyBundleId shows prior activity (installedBundleId already cleared)', () => {
    const { state } = reconcileBootState(record({ lastHealthyBundleId: 'b1' }), {
      currentBundleId: null,
      versionCode: VC,
    });
    expect(state).toBe('native_after_rollback');
  });

  it('wipes bundle state on a native binary change, keeping the property channel', () => {
    const { state, nextRecord } = reconcileBootState(
      record({
        installedBundleId: 'b2',
        installedBundleChannel: 'dev',
        lastHealthyBundleId: 'b1',
        lastResolvedChannel: 'dev',
      }),
      { currentBundleId: null, versionCode: '104' },
    );
    expect(state).toBe('native_after_binary_change');
    expect(nextRecord.versionCode).toBe('104');
    expect(nextRecord.installedBundleId).toBeNull();
    expect(nextRecord.lastHealthyBundleId).toBeNull();
    expect(nextRecord.lastResolvedChannel).toBe('dev');
  });

  it('clears the fallback marker on a native binary change too — a candidate built for the old binary is no longer viable', () => {
    const { nextRecord } = reconcileBootState(
      record({ fallbackAttemptedFor: 'b1', fallbackAttemptedAt: 1_000 }),
      { currentBundleId: null, versionCode: '104' },
    );
    expect(nextRecord.fallbackAttemptedFor).toBeNull();
    expect(nextRecord.fallbackAttemptedAt).toBeNull();
  });

  describe('rollback-fallback confirmation (c2)', () => {
    it('reports ota_after_fallback and recovers the channel from lastHealthyBundleChannel', () => {
      const { state, nextRecord } = reconcileBootState(
        record({ fallbackAttemptedFor: 'b1', fallbackAttemptedAt: 1_000, lastHealthyBundleChannel: 'dev' }),
        { currentBundleId: 'b1', versionCode: VC },
      );
      expect(state).toBe('ota_after_fallback');
      expect(nextRecord.installedBundleId).toBe('b1');
      expect(nextRecord.installedBundleChannel).toBe('dev');
    });

    it('leaves the marker untouched — only callReady(), once ready() actually confirms it, may clear it', () => {
      const { nextRecord } = reconcileBootState(
        record({ fallbackAttemptedFor: 'b1', fallbackAttemptedAt: 1_000 }),
        { currentBundleId: 'b1', versionCode: VC },
      );
      expect(nextRecord.fallbackAttemptedFor).toBe('b1');
      expect(nextRecord.fallbackAttemptedAt).toBe(1_000);
    });

    it('is idempotent — the second boot falls through to steady state instead of re-firing', () => {
      const first = reconcileBootState(
        record({ fallbackAttemptedFor: 'b1', fallbackAttemptedAt: 1_000, lastHealthyBundleChannel: 'dev' }),
        { currentBundleId: 'b1', versionCode: VC },
      );
      const second = reconcileBootState(first.nextRecord, { currentBundleId: 'b1', versionCode: VC });
      expect(second.state).toBe('ota');
    });

    it('does not fire for an unrelated bundle merely because a marker exists for a different id', () => {
      const { state } = reconcileBootState(
        record({ fallbackAttemptedFor: 'b1', fallbackAttemptedAt: 1_000 }),
        { currentBundleId: 'b2', versionCode: VC },
      );
      expect(state).not.toBe('ota_after_fallback');
    });
  });

  it('stays ota in the steady state and restamps the version code', () => {
    const { state, nextRecord } = reconcileBootState(
      record({ installedBundleId: 'b2', installedBundleChannel: 'dev' }),
      { currentBundleId: 'b2', versionCode: VC },
    );
    expect(state).toBe('ota');
    expect(nextRecord.installedBundleChannel).toBe('dev');
  });

  describe('migration seed (no record.installedBundleChannel, bundle already running)', () => {
    it('seeds installedBundleChannel from channelHint on the very first boot (no record at all)', () => {
      const { state, nextRecord } = reconcileBootState(null, {
        currentBundleId: 'b1',
        versionCode: VC,
        channelHint: 'dev',
      });
      expect(state).toBe('ota');
      expect(nextRecord.installedBundleId).toBe('b1');
      expect(nextRecord.installedBundleChannel).toBe('dev');
    });

    it('seeds from channelHint when a record exists but never recorded a channel', () => {
      const { nextRecord } = reconcileBootState(record({ installedBundleId: 'b1' }), {
        currentBundleId: 'b1',
        versionCode: VC,
        channelHint: 'dev',
      });
      expect(nextRecord.installedBundleChannel).toBe('dev');
    });

    it('validates the hint — an unrecognised or missing hint leaves it null, not defaulted', () => {
      const bogus = reconcileBootState(null, {
        currentBundleId: 'b1',
        versionCode: VC,
        channelHint: 'staging',
      });
      expect(bogus.nextRecord.installedBundleChannel).toBeNull();

      const missing = reconcileBootState(null, { currentBundleId: 'b1', versionCode: VC });
      expect(missing.nextRecord.installedBundleChannel).toBeNull();
    });

    it('never reseeds once a channel is recorded, even if the hint disagrees', () => {
      const { nextRecord } = reconcileBootState(
        record({ installedBundleId: 'b1', installedBundleChannel: 'dev' }),
        { currentBundleId: 'b1', versionCode: VC, channelHint: 'early' },
      );
      expect(nextRecord.installedBundleChannel).toBe('dev');
    });
  });
});

describe('decideReloadBeforeReady', () => {
  const base = { stagedBundleId: 'b2', now: 1_000, deadlineMs: 9_000, busy: false };

  it('proceeds when a bundle is staged, there is budget, and nothing is busy', () => {
    expect(decideReloadBeforeReady(base)).toBe('proceed');
  });

  it('does nothing when the device is already current', () => {
    expect(decideReloadBeforeReady({ ...base, stagedBundleId: null })).toBe('nothing-staged');
  });

  it('declines past the deadline — the user is about to see the app', () => {
    expect(decideReloadBeforeReady({ ...base, now: 9_000 })).toBe('past-deadline');
  });

  it('treats the deadline as inclusive', () => {
    expect(decideReloadBeforeReady({ ...base, now: 8_999 })).toBe('proceed');
  });

  it('checks staged BEFORE busy, so a busy device with nothing to apply reports nothing-staged', () => {
    expect(decideReloadBeforeReady({ ...base, stagedBundleId: null, busy: true })).toBe(
      'nothing-staged',
    );
  });

  it('checks the deadline before busy', () => {
    expect(decideReloadBeforeReady({ ...base, now: 9_000, busy: true })).toBe('past-deadline');
  });

  it('defers when busy', () => {
    expect(decideReloadBeforeReady({ ...base, busy: true })).toBe('busy');
  });
});

describe('keepSetFor', () => {
  it('retains one previous bundle alongside the live pair', () => {
    expect(keepSetFor({ current: 'b3', next: 'b4', previous: 'b2' })).toEqual(
      new Set(['b3', 'b4', 'b2']),
    );
  });

  it('drops nulls', () => {
    expect(keepSetFor({ current: 'b3', next: null, previous: null })).toEqual(new Set(['b3']));
  });
});

describe('decideReadyGate', () => {
  it('confirms immediately when the running bundle already proved itself — the watchdog arms every launch, so re-proving a known-good bundle risks the whole chain on one network call for no reason', () => {
    expect(
      decideReadyGate({ currentBundleId: 'b1', lastHealthyBundleId: 'b1', fallbackAttemptedFor: null }),
    ).toBe('confirm-immediately');
  });

  it('requires the probe on a first run of a new bundle', () => {
    expect(
      decideReadyGate({ currentBundleId: 'b2', lastHealthyBundleId: 'b1', fallbackAttemptedFor: null }),
    ).toBe('probe-required');
  });

  it('requires the probe when nothing has ever been confirmed', () => {
    expect(
      decideReadyGate({ currentBundleId: 'b1', lastHealthyBundleId: null, fallbackAttemptedFor: null }),
    ).toBe('probe-required');
  });

  it('requires the probe on native — there is nothing to have proved itself', () => {
    expect(
      decideReadyGate({ currentBundleId: null, lastHealthyBundleId: 'b1', fallbackAttemptedFor: null }),
    ).toBe('probe-required');
  });

  it('requires the probe on the boot right after a forced fallback, even though the candidate equals lastHealthyBundleId by construction — this is the closed-loop bug: without this exclusion, a candidate that was never actually reachable would confirm itself forever, since it IS lastHealthyBundleId precisely because it was chosen as the fallback target', () => {
    expect(
      decideReadyGate({ currentBundleId: 'b1', lastHealthyBundleId: 'b1', fallbackAttemptedFor: 'b1' }),
    ).toBe('probe-required');
  });

  it('confirms immediately again once the marker is cleared for a DIFFERENT bundle — the exclusion is scoped to the exact fallback candidate, not a general veto', () => {
    expect(
      decideReadyGate({ currentBundleId: 'b1', lastHealthyBundleId: 'b1', fallbackAttemptedFor: 'b9' }),
    ).toBe('confirm-immediately');
  });
});

describe('decideRollbackFallback', () => {
  const base = {
    state: 'native_after_rollback' as const,
    lastHealthyBundleId: 'b1',
    fallbackAttemptedFor: null as string | null,
    fallbackAttemptedAt: null as number | null,
    now: 10_000,
    downloadedBundleIds: ['b1'],
    blockedBundleIds: [] as string[],
  };

  it('applies lastHealthyBundleId after a rollback when it is downloaded and unblocked', () => {
    expect(decideRollbackFallback(base)).toEqual({ apply: true, bundleId: 'b1' });
  });

  it('declines after a binary change — a candidate built for the old binary may call an API the new one no longer has', () => {
    expect(decideRollbackFallback({ ...base, state: 'native_after_binary_change' })).toEqual({
      apply: false,
      reason: 'not-after-rollback',
    });
  });

  it('declines on a fresh install — nothing has ever run', () => {
    expect(decideRollbackFallback({ ...base, state: 'native_fresh' })).toEqual({
      apply: false,
      reason: 'not-after-rollback',
    });
  });

  it('declines while already running an OTA bundle', () => {
    expect(decideRollbackFallback({ ...base, state: 'ota' })).toEqual({
      apply: false,
      reason: 'not-after-rollback',
    });
  });

  it('declines with no candidate', () => {
    expect(decideRollbackFallback({ ...base, lastHealthyBundleId: null })).toEqual({
      apply: false,
      reason: 'no-candidate',
    });
  });

  it('declines a repeat of the same candidate within the cooldown — this is what stops native → fallback → fails-again → native from looping when the backend itself is still down', () => {
    expect(
      decideRollbackFallback({
        ...base,
        fallbackAttemptedFor: 'b1',
        fallbackAttemptedAt: 9_000,
        now: 9_000 + FALLBACK_COOLDOWN_MS - 1,
      }),
    ).toEqual({ apply: false, reason: 'already-attempted' });
  });

  it('allows the same candidate again once the cooldown has fully elapsed — a marker that never clears must not kill the feature forever', () => {
    expect(
      decideRollbackFallback({
        ...base,
        fallbackAttemptedFor: 'b1',
        fallbackAttemptedAt: 9_000,
        now: 9_000 + FALLBACK_COOLDOWN_MS,
      }),
    ).toEqual({ apply: true, bundleId: 'b1' });
  });

  it('treats a future attemptedAt (clock moved backwards) as inside the cooldown', () => {
    expect(
      decideRollbackFallback({
        ...base,
        fallbackAttemptedFor: 'b1',
        fallbackAttemptedAt: base.now + 1_000,
      }),
    ).toEqual({ apply: false, reason: 'already-attempted' });
  });

  it('is unaffected by a marker for a DIFFERENT bundle', () => {
    expect(
      decideRollbackFallback({ ...base, fallbackAttemptedFor: 'b9', fallbackAttemptedAt: 9_999 }),
    ).toEqual({ apply: true, bundleId: 'b1' });
  });

  it('declines when the candidate is not on disk', () => {
    expect(decideRollbackFallback({ ...base, downloadedBundleIds: [] })).toEqual({
      apply: false,
      reason: 'not-downloaded',
    });
  });

  it('declines when the plugin has blocked the candidate itself — respects autoBlockRolledBackBundles rather than overriding it', () => {
    expect(decideRollbackFallback({ ...base, blockedBundleIds: ['b1'] })).toEqual({
      apply: false,
      reason: 'blocked',
    });
  });

  it('checks the cooldown BEFORE the disk — an in-cooldown candidate declines as already-attempted even if it is also not downloaded', () => {
    expect(
      decideRollbackFallback({
        ...base,
        fallbackAttemptedFor: 'b1',
        fallbackAttemptedAt: 9_999,
        downloadedBundleIds: [],
      }),
    ).toEqual({ apply: false, reason: 'already-attempted' });
  });
});

describe('decideReady', () => {
  it('confirms when the backend was reached', () => {
    expect(decideReady({ reachedBackend: true, online: true })).toEqual({
      ready: true,
      reason: 'backend',
    });
  });

  it('does not confirm when neither reachable nor offline', () => {
    expect(decideReady({ reachedBackend: false, online: true })).toEqual({
      ready: false,
      reason: 'unconfirmed',
    });
  });

  it('confirms when provably offline — a device with no network must not have the bundle blamed for it, even though this is a one-way door (the watchdog is cancelled regardless of whether the bundle is actually fine)', () => {
    expect(decideReady({ reachedBackend: false, online: false })).toEqual({
      ready: true,
      reason: 'offline',
    });
  });

  it('checks offline BEFORE reachedBackend — being offline confirms even if reachedBackend somehow also reports true', () => {
    expect(decideReady({ reachedBackend: true, online: false })).toEqual({
      ready: true,
      reason: 'offline',
    });
  });
});
