import { describe, it, expect } from 'vitest';
import {
  comparePrices,
  compareSizes,
  calculateUnitPrice,
  compareUnitPrices,
  deriveProductObservedMetrics,
  buildComparisonReport,
} from './comparison';
import type { ProductWithHistory } from '../types';

const makeHist = (id: string, name: string, price: number, size: number | null, days: number): ProductWithHistory => ({
  product: {
    id,
    user_id: 'u1',
    name,
    category: 'Skincare',
    brand: 'Brand',
    size_value: size,
    size_unit: size !== null ? 'ml' : null,
    created_at: '2026-01-01T00:00:00Z',
  },
  purchases: [
    {
      id: `pu-${id}`,
      product_id: id,
      purchase_date: '2026-06-01',
      price,
      currency: 'BDT',
      store_vendor: null,
      created_at: '2026-06-01T00:00:00Z',
    },
  ],
  finished_periods: [
    {
      id: `fin-${id}`,
      product_id: id,
      purchase_id: `pu-${id}`,
      opened_date: '2026-06-01',
      finished_date: `2026-06-${String(1 + days).padStart(2, '0')}`,
      status: 'finished',
      created_at: '2026-06-01T00:00:00Z',
    },
  ],
  usage_periods: [],
  unopened_purchases: [],
  active_usage: null,
});

describe('comparison', () => {
  it('compares prices, sizes, and unit prices accurately', () => {
    const priceDiff = comparePrices(500, 600);
    expect(priceDiff.absolute).toBe(100);
    expect(priceDiff.percentage).toBe(20);

    const sizeComp = compareSizes(200, 'ml', 100, 'ml');
    expect(sizeComp.isCompatible).toBe(true);
    expect(sizeComp.difference).toBe(-100);

    const unitMismatch = compareSizes(200, 'ml', 100, 'g');
    expect(unitMismatch.isCompatible).toBe(false);

    expect(calculateUnitPrice(500, 100, 'ml')?.unitPrice).toBe(5);
    expect(calculateUnitPrice(500, 0, 'ml').unitPrice).toBeNull();
    expect(compareUnitPrices(5, 6, true)?.absolute).toBe(1);
  });

  it('builds a full head-to-head comparison report', () => {
    const a = makeHist('p1', 'Cleanser A', 600, 200, 20); // 30/day, 3/ml
    const b = makeHist('p2', 'Cleanser B', 500, 100, 25); // 20/day, 5/ml

    const report = buildComparisonReport(a, b);
    expect(report.hasBothConsumptionData).toBe(true);
    expect(report.isSameCategory).toBe(true);
    expect(report.costPerDayComparison?.absolute).toBe(-10);
    expect(report.lifespanComparison?.absolute).toBe(5);
    expect(report.insightSummary.length).toBeGreaterThan(0);
  });

  it('marks incompatible units (ml vs g) and omits numeric size/unit comparisons safely', () => {
    const mlItem = makeHist('p1', 'Toner', 600, 200, 20);
    const gItem = {
      ...makeHist('p2', 'Cream', 500, 100, 25),
      product: { ...makeHist('p2', 'Cream', 500, 100, 25).product, size_unit: 'g' as const },
    };

    const report = buildComparisonReport(mlItem, gItem);
    expect(report.sizeComparison.isCompatible).toBe(false);
    expect(report.sizeComparison.difference).toBeNull();
    expect(report.unitPriceComparison).toBeNull();
    expect(typeof report.insightSummary).toBe('string');
  });

  it('handles products with zero finished cycles or no purchases without NaN', () => {
    const noCycles = { ...makeHist('p1', 'New Item', 400, 100, 20), finished_periods: [] };
    const noPurchases = { ...makeHist('p2', 'Empty Item', 400, 100, 20), purchases: [], finished_periods: [] };

    const report = buildComparisonReport(noCycles, noPurchases);
    expect(report.hasBothConsumptionData).toBe(false);
    expect(report.costPerDayComparison).toBeNull();
    expect(report.monthlyConsumptionComparison).toBeNull();
    expect(report.lifespanComparison).toBeNull();
  });

  it('uses active purchase effective size when active (236ml) + latest backup (473ml), and falls back to latest when no active', () => {
    const prod = {
      id: 'p-mix',
      user_id: 'u1',
      name: 'Hydrating Cleanser',
      category: 'Skincare' as const,
      brand: 'CeraVe',
      size_value: 236,
      size_unit: 'ml' as const,
      created_at: '2026-01-01T00:00:00Z',
    };
    const activePurchase = {
      id: 'pur-active',
      product_id: 'p-mix',
      purchase_date: '2026-08-01',
      price: 1650,
      currency: 'BDT',
      store_vendor: 'Shajgoj',
      size_value: null,
      size_unit: null,
      created_at: '2026-08-01T00:00:00Z',
    };
    const backupPurchase = {
      id: 'pur-backup',
      product_id: 'p-mix',
      purchase_date: '2026-09-01',
      price: 2950,
      currency: 'BDT',
      store_vendor: 'Shajgoj',
      size_value: 473,
      size_unit: 'ml' as const,
      created_at: '2026-09-01T00:00:00Z',
    };
    const activeMetrics = deriveProductObservedMetrics({
      product: prod,
      purchases: [backupPurchase, activePurchase],
      usage_periods: [],
      active_usage: {
        id: 'u-act',
        product_id: 'p-mix',
        purchase_id: 'pur-active',
        opened_date: '2026-08-02',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-02T00:00:00Z',
      },
      finished_periods: [],
      unopened_purchases: [backupPurchase],
    });
    expect(activeMetrics.sizeValue).toBe(236);
    expect(activeMetrics.latestPurchasePrice).toBe(1650);
    expect(activeMetrics.unitPrice).toBeCloseTo(1650 / 236, 2);

    // Without active usage, falls back to latest purchase (473ml @ 2950)
    const inactiveMetrics = deriveProductObservedMetrics({
      product: prod,
      purchases: [backupPurchase, activePurchase],
      usage_periods: [],
      active_usage: null,
      finished_periods: [],
      unopened_purchases: [backupPurchase],
    });
    expect(inactiveMetrics.sizeValue).toBe(473);
    expect(inactiveMetrics.latestPurchasePrice).toBe(2950);
    expect(inactiveMetrics.unitPrice).toBeCloseTo(2950 / 473, 2);
  });
});
