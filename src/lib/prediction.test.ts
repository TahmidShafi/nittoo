import { describe, it, expect } from 'vitest';
import {
  calculateAverageLifespan,
  calculateCurrentDaysUsed,
  calculatePredictedRemainingDays,
  calculateCostPerDay,
  calculatePricePerUnit,
  calculateMonthlyConsumptionCost,
  calculateProgressPercent,
} from './prediction';
import type { UsagePeriod } from '../types';

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
  it('calculates arithmetic mean of finished cycles and returns null when empty or all 0-day', () => {
    expect(calculateAverageLifespan([])).toBeNull();
    expect(
      calculateAverageLifespan([makeFinished('z1', '2026-08-01', '2026-08-01')])
    ).toBeNull();
    expect(
      calculateAverageLifespan([
        makeFinished('1', '2026-01-01', '2026-03-03'), // 61d
        makeFinished('2', '2026-03-05', '2026-05-07'), // 63d
      ])
    ).toBe(62);
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
    ])('calculateProgressPercent(%s, %s) -> %s', (used, avg, expected) => {
      expect(calculateProgressPercent(used, avg)).toBe(expected);
    });
  });

  it('computes days used and remaining days deterministically', () => {
    expect(calculateCurrentDaysUsed('2026-09-01', '2026-09-11')).toBe(10);
    expect(calculatePredictedRemainingDays(60, 25)).toBe(35);
    expect(calculatePredictedRemainingDays(null, 25)).toBeNull();
  });
});
