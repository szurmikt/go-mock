import {
  decideReloadBeforeReady,
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
    expect(nextRecord.previousBundleId).toBe('b1');
    expect(nextRecord.stagedBundleId).toBeNull();
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
      record({ installedBundleId: 'b2', installedBundleChannel: 'dev', previousBundleId: 'b1' }),
      { currentBundleId: null, versionCode: VC },
    );
    expect(state).toBe('native_after_rollback');
    expect(nextRecord.installedBundleId).toBeNull();
    expect(nextRecord.installedBundleChannel).toBeNull();
  });

  it('KEEPS previousBundleId on rollback — it is the disk evidence and fallback target', () => {
    const { nextRecord } = reconcileBootState(
      record({ installedBundleId: 'b2', previousBundleId: 'b1' }),
      { currentBundleId: null, versionCode: VC },
    );
    expect(nextRecord.previousBundleId).toBe('b1');
  });

  it('wipes bundle state on a native binary change, keeping the property channel', () => {
    const { state, nextRecord } = reconcileBootState(
      record({
        installedBundleId: 'b2',
        installedBundleChannel: 'dev',
        previousBundleId: 'b1',
        lastResolvedChannel: 'dev',
      }),
      { currentBundleId: null, versionCode: '104' },
    );
    expect(state).toBe('native_after_binary_change');
    expect(nextRecord.versionCode).toBe('104');
    expect(nextRecord.installedBundleId).toBeNull();
    expect(nextRecord.previousBundleId).toBeNull();
    expect(nextRecord.lastResolvedChannel).toBe('dev');
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
