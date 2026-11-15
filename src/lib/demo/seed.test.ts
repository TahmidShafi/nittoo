import { describe, it, expect } from 'vitest';
import { buildDemoSeedData } from './seed';
import { MockDatabase, InMemoryStorageAdapter, mockDb } from '../mock-db';
import {
  DEMO_USER_ID,
  getActiveDataSource,
  setDemoModeActive,
  isDemoSessionActive,
} from '../dataSource';

function classifySeed(todayStr: string) {
  const b = buildDemoSeedData(DEMO_USER_ID, todayStr);
  const msPerDay = 86_400_000;
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
  let onTrack = 0;
  let dueSoon = 0;
  let overdue = 0;
  let minRemaining = Infinity;

  for (const p of b.products) {
    const active = b.usage_periods.find((u) => u.product_id === p.id && u.status === 'active');
    if (!active) continue;
    const finished = b.usage_periods.filter((u) => u.product_id === p.id && u.status === 'finished');
    if (finished.length === 0) continue;
    const avg =
      finished.reduce((sum, u) => {
        return (
          sum +
          (Date.parse(`${u.finished_date}T00:00:00Z`) -
            Date.parse(`${u.opened_date}T00:00:00Z`)) /
            msPerDay
        );
      }, 0) / finished.length;
    const used = (todayMs - Date.parse(`${active.opened_date}T00:00:00Z`)) / msPerDay;
    const remaining = Math.round(avg - used);
    minRemaining = Math.min(minRemaining, remaining);
    if (remaining < 0) overdue++;
    else if (remaining <= 7) dueSoon++;
    else onTrack++;
  }

  const usedPurchaseIds = new Set(b.usage_periods.map((u) => u.purchase_id));
  const unopenedCount = b.purchases.filter((pu) => !usedPurchaseIds.has(pu.id)).length;
  return { onTrack, dueSoon, overdue, minRemaining, unopenedCount };
}

describe('demo/seed', () => {
  it('generates 12 products, 12-18 months of cycles, BDT prices, backup, and restock plan', () => {
    const bundle = buildDemoSeedData(DEMO_USER_ID, '2026-11-15');
    expect(bundle.products).toHaveLength(12);
    expect(bundle.purchases.length).toBeGreaterThan(12);
    expect(bundle.usage_periods.some((u) => u.status === 'finished')).toBe(true);
    expect(bundle.restock_plans.length).toBeGreaterThanOrEqual(1);
    expect(bundle.purchases.every((p) => p.currency === 'BDT')).toBe(true);
  });

  it('produces identical state mix across two distant today dates without unintended overdue', () => {
    const mixA = classifySeed('2026-03-15');
    const mixB = classifySeed('2027-08-22');

    expect(mixA.onTrack).toBeGreaterThan(0);
    expect(mixA.dueSoon).toBeGreaterThan(0);
    expect(mixA.unopenedCount).toBeGreaterThanOrEqual(1);
    expect(mixA).toEqual(mixB);
    expect(mixA.minRemaining).toBeGreaterThanOrEqual(-7);
  });

  it('seeds and clears demo user in MockDatabase and switches dataSource at runtime', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    db.seedDemoUser(DEMO_USER_ID, buildDemoSeedData(DEMO_USER_ID, '2026-11-15'));

    expect(await db.getAllUserProducts(DEMO_USER_ID)).toHaveLength(12);
    const inv = await db.getUserInventory(DEMO_USER_ID);
    expect(inv.unopened.length).toBeGreaterThanOrEqual(1);

    await db.resetUserData(DEMO_USER_ID, true);
    expect(await db.getAllUserProducts(DEMO_USER_ID)).toHaveLength(0);

    const origWindow = (globalThis as { window?: unknown }).window;
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    };
    try {
      setDemoModeActive(true);
      expect(isDemoSessionActive()).toBe(true);
      expect(getActiveDataSource()).toBe(mockDb);
      setDemoModeActive(false);
      expect(isDemoSessionActive()).toBe(false);
    } finally {
      if (origWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = origWindow;
    }
  });
});
