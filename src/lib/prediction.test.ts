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

  it('guards division by zero in costPerDay, pricePerUnit, monthlyCost, and progressPercent', () => {
    expect(calculateCostPerDay(500, 0)).toBeNull();
    expect(calculateCostPerDay(500, -5)).toBeNull();
    expect(calculateCostPerDay(500, null)).toBeNull();
    expect(calculateCostPerDay(500, 50)).toBe(10);

    expect(calculatePricePerUnit(500, 0)).toBeNull();
    expect(calculatePricePerUnit(500, null)).toBeNull();
    expect(calculatePricePerUnit(500, 100)).toBe(5);

    expect(calculateMonthlyConsumptionCost(500, 0)).toBeNull();
    expect(calculateMonthlyConsumptionCost(500, 30)).toBe(500);

    expect(calculateProgressPercent(10, 0)).toBeNull();
    expect(calculateProgressPercent(10, null)).toBeNull();
    expect(calculateProgressPercent(30, 60)).toBe(50);
    expect(calculateProgressPercent(90, 60)).toBe(100);
  });

  it('computes days used and remaining days deterministically', () => {
    expect(calculateCurrentDaysUsed('2026-09-01', '2026-09-11')).toBe(10);
    expect(calculatePredictedRemainingDays(60, 25)).toBe(35);
    expect(calculatePredictedRemainingDays(null, 25)).toBeNull();
  });
});
