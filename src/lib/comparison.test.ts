import { describe, it, expect } from 'vitest';
import {
  comparePrices,
  compareSizes,
  calculateUnitPrice,
  compareUnitPrices,
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
});
