import { describe, it, expect } from 'vitest';
import parityFixture from '../../analytics/fixtures/forecast_parity.json';
import { addDays } from './dateUtils';
import {
  calculateCostPerDay,
  calculateCurrentDaysUsed,
  calculateMonthlyConsumptionCost,
  calculatePredictedLifespan,
  calculatePredictedRemainingDays,
  calculatePricePerUnit,
  calculateProgressPercent,
  computeLifespanTrackLayout,
  calculateRunOutRange,
  formatRunOutRange,
  getEffectiveSize,
  getHistoryBucket,
  getValidFinishedPeriods,
  legacyAverageLifespan,
} from './prediction';
import type { Product, Purchase, SizeUnit, UsagePeriod } from '../types';

const makeProduct = (
  size_value: number | null = 200,
  size_unit: SizeUnit | null = 'ml'
): Product => ({
  id: 'prod-1',
  user_id: 'user-1',
  name: 'Test Product',
  brand: 'Brand',
  category: 'Skincare',
  size_value,
  size_unit,
  created_at: '2026-01-01T00:00:00Z',
});

const makePurchase = (
  id: string,
  size_value: number | null = null,
  size_unit: SizeUnit | null = null
): Purchase => ({
  id,
  product_id: 'prod-1',
  purchase_date: '2026-01-01',
  price: 500,
  currency: 'BDT',
  store_vendor: 'Shwapno',
  size_value,
  size_unit,
  created_at: '2026-01-01T00:00:00Z',
});

const makeFinished = (id: string, opened: string, finished: string): UsagePeriod => ({
  id,
  product_id: 'prod-1',
  purchase_id: `pur-${id}`,
  opened_date: opened,
  finished_date: finished,
  status: 'finished',
  created_at: `${opened}T00:00:00Z`,
});

describe('prediction', () => {
  it('legacyAverageLifespan preserves Part A baseline arithmetic mean', () => {
    expect(legacyAverageLifespan([])).toBeNull();
    expect(
      legacyAverageLifespan([makeFinished('z1', '2026-08-01', '2026-08-01')])
    ).toBeNull();
    expect(
      legacyAverageLifespan([
        makeFinished('1', '2026-01-01', '2026-03-03'), // 61d
        makeFinished('2', '2026-03-05', '2026-05-07'), // 63d
      ])
    ).toBe(62);
  });

  describe('calculatePredictedLifespan (rate_mean, rule_only)', () => {
    it('scales lifespan proportionally when active pack size switches', () => {
      const product = makeProduct(236, 'ml');
      const purchases = [
        makePurchase('pur-1', null, null), // inherits 236 ml
        makePurchase('pur-2', null, null), // inherits 236 ml
        makePurchase('pur-active', 472, 'ml'), // 2x bottle
      ];
      const usagePeriods = [
        makeFinished('1', '2026-01-01', addDays('2026-01-01', 40)),
        makeFinished('2', '2026-03-01', addDays('2026-03-01', 40)),
      ];
      expect(
        calculatePredictedLifespan({
          usagePeriods,
          product,
          purchases,
          activePurchase: purchases[2],
        })
      ).toBe(80);
    });

    it('excludes 0-day and >=1000-day cycles from both lifespan and valid count', () => {
      const product = makeProduct(200, 'ml');
      const purchases = [
        makePurchase('pur-z', 200, 'ml'),
        makePurchase('pur-x', 200, 'ml'),
        makePurchase('pur-1', 200, 'ml'),
        makePurchase('pur-2', 200, 'ml'),
      ];
      const usagePeriods = [
        makeFinished('z', '2026-01-01', '2026-01-01'), // 0d -> excluded
        makeFinished('x', '2026-01-02', addDays('2026-01-02', 1000)), // 1000d -> excluded
        makeFinished('1', '2026-02-01', addDays('2026-02-01', 30)),
        makeFinished('2', '2026-04-01', addDays('2026-04-01', 30)),
      ];
      expect(getValidFinishedPeriods(usagePeriods)).toHaveLength(2);
      expect(
        calculatePredictedLifespan({
          usagePeriods,
          product,
          purchases,
          activePurchase: purchases[3],
        })
      ).toBe(30);

      // All invalid -> null
      expect(
        calculatePredictedLifespan({
          usagePeriods: usagePeriods.slice(0, 2),
          product,
          purchases,
          activePurchase: purchases[3],
        })
      ).toBeNull();
    });

    it('uses only known-size cycles when history has mixed known/unknown sizes', () => {
      const product = makeProduct(null, null);
      const purchases = [
        makePurchase('pur-1', null, null), // unknown size (90d ignored for rate)
        makePurchase('pur-2', 200, 'ml'), // 20d -> 10 ml/day
        makePurchase('pur-active', 400, 'ml'),
      ];
      const usagePeriods = [
        makeFinished('1', '2026-01-01', addDays('2026-01-01', 90)),
        makeFinished('2', '2026-05-01', addDays('2026-05-01', 20)),
      ];
      expect(
        calculatePredictedLifespan({
          usagePeriods,
          product,
          purchases,
          activePurchase: purchases[2],
        })
      ).toBe(40);
    });

    it('excludes cycles whose effective unit differs from active purchase unit', () => {
      const product = makeProduct(null, null);
      const purchases = [
        makePurchase('pur-1', 100, 'g'), // unit mismatch -> excluded from ml rate
        makePurchase('pur-2', 150, 'ml'), // 30d -> 5 ml/day
        makePurchase('pur-active', 300, 'ml'),
      ];
      const usagePeriods = [
        makeFinished('1', '2026-01-01', addDays('2026-01-01', 10)),
        makeFinished('2', '2026-02-01', addDays('2026-02-01', 30)),
      ];
      expect(
        calculatePredictedLifespan({
          usagePeriods,
          product,
          purchases,
          activePurchase: purchases[2],
        })
      ).toBe(60);
    });

    it('falls back to rule-cleaned mean duration when no size is known', () => {
      const product = makeProduct(null, null);
      const purchases = [makePurchase('pur-1'), makePurchase('pur-2')];
      const usagePeriods = [
        makeFinished('1', '2026-01-01', addDays('2026-01-01', 10)),
        makeFinished('2', '2026-02-01', addDays('2026-02-01', 11)),
      ];
      expect(
        calculatePredictedLifespan({
          usagePeriods,
          product,
          purchases,
          activePurchase: null,
        })
      ).toBe(10.5);
    });
  });

  describe('calculateRunOutRange & overdue guard', () => {
    it('returns null when fewer than 2 valid cycles exist', () => {
      expect(calculateRunOutRange('2026-01-01', 40, 1, '2026-01-10')).toBeNull();
    });

    it('returns calibrated range before maxDate and null when today > maxDate (overdue)', () => {
      const range = calculateRunOutRange('2026-01-01', 40, 2, '2026-01-15');
      expect(range).not.toBeNull();
      expect(range!.bucket).toBe('2');
      expect(formatRunOutRange(range!)).toMatch(/^Runs out between /);

      // Exactly on maxDate -> still shown
      expect(calculateRunOutRange('2026-01-01', 40, 2, range!.maxDate)).not.toBeNull();

      // One day past maxDate -> hidden so overdue state takes over
      const pastMax = addDays(range!.maxDate, 1);
      expect(calculateRunOutRange('2026-01-01', 40, 2, pastMax)).toBeNull();
    });

    it('formats overdue-within-range copy using the point-estimate expected finish date', () => {
      const expectedFinishDate = addDays('2026-01-01', 40); // 2026-02-10
      const range = calculateRunOutRange('2026-01-01', 40, 2, '2026-02-12');
      expect(range).not.toBeNull();

      const text = formatRunOutRange(range!, {
        expectedFinishDate,
        isOverdue: true,
        referenceDate: '2026-02-12',
      });
      expect(text).toMatch(/^Was expected Feb 10 · may last until /);
      expect(text).not.toContain('Runs out between');
    });
  });

  describe('computeLifespanTrackLayout', () => {
    const sampleRange = {
      minDate: '2026-02-02',
      maxDate: '2026-02-20',
      lowDays: 32,
      highDays: 50,
      bucket: '2' as const,
    };

    it('maps normal progress onto [0 .. highDays] with unclipped band and expected tick', () => {
      const layout = computeLifespanTrackLayout({
        daysUsed: 15,
        expectedLifespan: 40,
        runOutRange: sampleRange,
      });
      expect(layout).not.toBeNull();
      expect(layout!.domainMax).toBe(50);
      expect(layout!.fillPercent).toBe(30);
      expect(layout!.expectedPercent).toBe(80);
      expect(layout!.bandStartPercent).toBe(64);
      expect(layout!.bandWidthPercent).toBe(36);
    });

    it('keeps expected tick ahead of fill near the end of the cycle', () => {
      const layout = computeLifespanTrackLayout({
        daysUsed: 38,
        expectedLifespan: 40,
        runOutRange: sampleRange,
      });
      expect(layout!.fillPercent).toBe(76);
      expect(layout!.expectedPercent).toBe(80);
      expect(layout!.fillPercent).toBeLessThan(layout!.expectedPercent);
    });

    it('expands domainMax to daysUsed when overdue past highDays', () => {
      const layout = computeLifespanTrackLayout({
        daysUsed: 60,
        expectedLifespan: 40,
        runOutRange: null,
      });
      expect(layout!.domainMax).toBe(60);
      expect(layout!.fillPercent).toBe(100);
      expect(layout!.expectedPercent).toBeLessThan(100);
      expect(layout!.bandStartPercent).toBeNull();
    });
  });

  describe('Python/TypeScript parity (analytics/fixtures/forecast_parity.json)', () => {
    it.each(parityFixture.cases)('matches Python output for $name', (c) => {
      const product = makeProduct(null, null);
      const purchases: Purchase[] = c.cycles.map((cyc, idx) =>
        makePurchase(
          `pur-${idx}`,
          cyc.effective_size_value,
          cyc.effective_size_unit as SizeUnit | null
        )
      );
      const activePurchase = makePurchase(
        'pur-active',
        c.active_size_value,
        c.active_size_unit as SizeUnit | null
      );
      const openedBase = '2020-01-01';
      const usagePeriods: UsagePeriod[] = c.cycles.map((cyc, idx) => ({
        id: `u-${idx}`,
        product_id: 'prod-1',
        purchase_id: `pur-${idx}`,
        opened_date: openedBase,
        finished_date: addDays(openedBase, cyc.duration_days),
        status: 'finished',
        created_at: '2020-01-01T00:00:00Z',
      }));

      const validCount = getValidFinishedPeriods(usagePeriods).length;
      expect(validCount).toBe(c.expected.valid_cycle_count);

      const lifespan = calculatePredictedLifespan({
        usagePeriods,
        product,
        purchases,
        activePurchase,
      });
      expect(lifespan).toBe(c.expected.predicted_lifespan);

      const remaining = calculatePredictedRemainingDays(lifespan, c.current_days_used);
      expect(remaining).toBe(c.expected.predicted_remaining_days);

      expect(getHistoryBucket(validCount)).toBe(c.expected.history_bucket);

      const range = calculateRunOutRange('2026-01-01', lifespan, validCount, '2026-01-01');
      if (c.expected.range_low_days === null) {
        expect(range).toBeNull();
      } else {
        expect(range).not.toBeNull();
        expect(range!.lowDays).toBe(c.expected.range_low_days);
        expect(range!.highDays).toBe(c.expected.range_high_days);
      }
    });
  });

  describe('division-by-zero and null guards', () => {
    it.each([
      [500, 0, null],
      [500, -5, null],
      [500, null, null],
      [500, 50, 10],
    ])('calculateCostPerDay(%s, %s) -> %s', (price, days, expected) => {
      expect(calculateCostPerDay(price, days)).toBe(expected);
    });

    it.each([
      [500, 0, null],
      [500, null, null],
      [500, 100, 5],
    ])('calculatePricePerUnit(%s, %s) -> %s', (price, size, expected) => {
      expect(calculatePricePerUnit(price, size)).toBe(expected);
    });

    it.each([
      [500, 0, null],
      [500, 30, 500],
    ])('calculateMonthlyConsumptionCost(%s, %s) -> %s', (price, days, expected) => {
      expect(calculateMonthlyConsumptionCost(price, days)).toBe(expected);
    });

    it.each([
      [10, 0, null],
      [10, null, null],
      [30, 60, 50],
      [90, 60, 100],
    ])('calculateProgressPercent(%s, %s) -> %s', (used, lifespan, expected) => {
      expect(calculateProgressPercent(used, lifespan)).toBe(expected);
    });
  });

  it('computes days used and remaining days deterministically', () => {
    expect(calculateCurrentDaysUsed('2026-09-01', '2026-09-16')).toBe(15);
    expect(calculatePredictedRemainingDays(45, 15)).toBe(30);
    expect(calculatePredictedRemainingDays(45, 50)).toBe(-5);
    expect(calculatePredictedRemainingDays(null, 15)).toBeNull();
  });

  it('computes effective size as COALESCE(purchase, product)', () => {
    const product = { size_value: 236, size_unit: 'ml' as const };
    expect(getEffectiveSize(null, product)).toEqual({ size_value: 236, size_unit: 'ml' });
    expect(getEffectiveSize({ size_value: null, size_unit: null }, product)).toEqual({
      size_value: 236,
      size_unit: 'ml',
    });
    expect(getEffectiveSize({ size_value: 473, size_unit: 'ml' }, product)).toEqual({
      size_value: 473,
      size_unit: 'ml',
    });
  });
});
