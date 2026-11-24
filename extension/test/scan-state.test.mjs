import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCAN_STATE,
  sanitizeScanState,
  getScanState,
  setScanState,
  resetScanState,
  watchScanState,
} from '../src/shared/scan-state.ts';

describe('scan-state synchronization & runtime validation', () => {
  it('sanitizeScanState falls back to defaults on invalid input', () => {
    assert.deepEqual(sanitizeScanState(null), DEFAULT_SCAN_STATE);
    assert.deepEqual(sanitizeScanState(undefined), DEFAULT_SCAN_STATE);
    assert.deepEqual(sanitizeScanState('malformed string'), DEFAULT_SCAN_STATE);
    assert.deepEqual(sanitizeScanState(123), DEFAULT_SCAN_STATE);
  });

  it('sanitizeScanState validates and extracts known typed fields', () => {
    const raw = {
      inProgress: true,
      type: 'search',
      statusMessage: 'Searching...',
      termsSearched: ['dev', 'eng'],
      currentTerm: 'dev',
      totalFound: 10,
      newIngested: 4,
      droppedDedup: 6,
      errors: ['rate limit'],
      startedAt: 1000,
      completedAt: 2000,
      untrustedPayload: 'malicious',
    };

    const sanitized = sanitizeScanState(raw);
    assert.equal(sanitized.inProgress, true);
    assert.equal(sanitized.type, 'search');
    assert.equal(sanitized.statusMessage, 'Searching...');
    assert.deepEqual(sanitized.termsSearched, ['dev', 'eng']);
    assert.equal(sanitized.currentTerm, 'dev');
    assert.equal(sanitized.totalFound, 10);
    assert.equal(sanitized.newIngested, 4);
    assert.equal(sanitized.droppedDedup, 6);
    assert.deepEqual(sanitized.errors, ['rate limit']);
    assert.equal(sanitized.startedAt, 1000);
    assert.equal(sanitized.completedAt, 2000);
    assert.equal(sanitized.untrustedPayload, undefined);
  });

  it('sanitizeScanState handles corrupt or non-finite numbers', () => {
    const raw = {
      inProgress: 'yes',
      type: 'invalid-type',
      totalFound: NaN,
      newIngested: -5,
      errors: [123, null, 'actual error'],
    };

    const sanitized = sanitizeScanState(raw);
    assert.equal(sanitized.inProgress, true);
    assert.equal(sanitized.type, null);
    assert.equal(sanitized.totalFound, 0);
    assert.equal(sanitized.newIngested, 0);
    assert.deepEqual(sanitized.errors, ['actual error']);
  });

  it('persists, updates, and resets state via storage implementation', async () => {
    const store = new Map();
    const mockStorage = {
      get: async (key) => ({ [key]: store.get(key) }),
      set: async (obj) => {
        for (const [k, v] of Object.entries(obj)) store.set(k, v);
      },
    };

    const initial = await getScanState({ storageImpl: mockStorage });
    assert.equal(initial.inProgress, false);

    await setScanState(
      {
        inProgress: true,
        type: 'scan',
        statusMessage: 'Scanning feeds...',
        newIngested: 3,
      },
      { storageImpl: mockStorage }
    );

    const active = await getScanState({ storageImpl: mockStorage });
    assert.equal(active.inProgress, true);
    assert.equal(active.type, 'scan');
    assert.equal(active.newIngested, 3);

    await resetScanState({ storageImpl: mockStorage });
    const reset = await getScanState({ storageImpl: mockStorage });
    assert.equal(reset.inProgress, false);
    assert.equal(reset.type, null);
    assert.equal(reset.statusMessage, 'Ready');
  });

  it('watchScanState receives updates and sanitizes change values', () => {
    let observed = null;
    let listenerRef = null;

    const mockStorage = {
      addListener: (fn) => {
        listenerRef = fn;
      },
      removeListener: () => {
        listenerRef = null;
      },
    };

    const unwatch = watchScanState(
      (state) => {
        observed = state;
      },
      { storageImpl: mockStorage }
    );

    assert.ok(listenerRef);

    listenerRef(
      {
        'jobfoundry-scan-state': {
          newValue: {
            inProgress: true,
            type: 'search',
            statusMessage: 'Live update',
            totalFound: 15,
          },
        },
      },
      'local'
    );

    assert.equal(observed?.inProgress, true);
    assert.equal(observed?.type, 'search');
    assert.equal(observed?.statusMessage, 'Live update');
    assert.equal(observed?.totalFound, 15);

    unwatch();
    assert.equal(listenerRef, null);
  });
});
