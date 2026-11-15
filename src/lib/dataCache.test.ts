import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  dataCache,
  areValuesEqual,
  STALE_TIME_MS,
  MAX_CACHE_ENTRIES_PER_USER,
} from './dataCache';

describe('dataCache', () => {
  beforeEach(() => {
    dataCache.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores, retrieves, and invalidates user/product entries', () => {
    dataCache.set('u1', 'dashboard', [{ id: 'p1' }]);
    const hit = dataCache.get<{ id: string }[]>('u1', 'dashboard');
    expect(hit).not.toBeNull();
    expect(hit!.data).toHaveLength(1);
    expect(dataCache.isStale(hit!)).toBe(false);

    dataCache.invalidateProduct('u1', 'p1');
    expect(dataCache.get('u1', 'dashboard')).toBeNull();
  });

  it('marks entries stale after STALE_TIME_MS and clears per user', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    dataCache.set('u1', 'k1', { ok: true });
    vi.advanceTimersByTime(STALE_TIME_MS + 1000);

    const hit = dataCache.get<{ ok: boolean }>('u1', 'k1');
    expect(hit).not.toBeNull();
    expect(dataCache.isStale(hit!)).toBe(true);

    dataCache.set('u2', 'k2', { ok: true });
    dataCache.clearUser('u1');
    expect(dataCache.get('u1', 'k1')).toBeNull();
    expect(dataCache.get('u2', 'k2')).not.toBeNull();
  });

  it('compares values deterministically with areValuesEqual', () => {
    expect(areValuesEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true);
    expect(areValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(areValuesEqual(null, { a: 1 })).toBe(false);
    expect(areValuesEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('evicts oldest entries when exceeding MAX_CACHE_ENTRIES_PER_USER', () => {
    for (let i = 0; i <= MAX_CACHE_ENTRIES_PER_USER + 2; i++) {
      dataCache.set('u-lru', `key-${i}`, i);
    }
    expect(dataCache.get('u-lru', 'key-0')).toBeNull();
    expect(dataCache.get('u-lru', `key-${MAX_CACHE_ENTRIES_PER_USER + 2}`)?.data).toBe(
      MAX_CACHE_ENTRIES_PER_USER + 2
    );
  });
});
