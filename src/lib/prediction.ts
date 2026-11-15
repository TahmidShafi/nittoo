// ==============================================================================
// Nittoo Prediction & Metric Engine
// Strict Business Logic: Valid Finished Periods Only, Rate-Normalized When Sized
// ==============================================================================

import type { Product, Purchase, SizeUnit, UsagePeriod } from '../types';
import { addDays, getDaysBetween, getDaysUsed, getTodayLocal } from './dateUtils';
import calibrationData from './forecast/calibration.json';

/** Rule-based duration validity bounds shared with analytics/src/nittoo_lab/config.py. */
export const MIN_VALID_DURATION_DAYS = 1;
export const MAX_VALID_DURATION_DAYS = 1000;
export const MIN_RANGE_CYCLES = 2;

export type HistoryBucket = '2' | '3-4' | '5+';

export interface PredictedLifespanInput {
  usagePeriods: UsagePeriod[];
  product: Pick<Product, 'size_value' | 'size_unit'>;
  purchases: Pick<Purchase, 'id' | 'size_value' | 'size_unit'>[];
  activePurchase?: Pick<Purchase, 'size_value' | 'size_unit'> | null;
}

export interface RunOutRange {
  minDate: string;
  maxDate: string;
  lowDays: number;
  highDays: number;
  bucket: HistoryBucket;
}

/**
 * Calculates duration in days for a finished usage period.
 * Returns null if the usage period is not finished or dates are missing.
 */
export function calculateUsageDuration(period: UsagePeriod): number | null {
  if (period.status !== 'finished' || !period.finished_date) {
    return null;
  }
  const duration = getDaysBetween(period.opened_date, period.finished_date);
  return Math.max(0, duration);
}

/**
 * Returns finished usage periods whose durations pass rule-based validity
 * (1 <= duration_days < 1000, excluding 0-day and >=1000-day data-entry faults).
 */
export function getValidFinishedPeriods(usagePeriods: UsagePeriod[]): UsagePeriod[] {
  return usagePeriods.filter((p) => {
    if (p.status !== 'finished' || p.finished_date === null || p.finished_date === undefined) {
      return false;
    }
    const duration = calculateUsageDuration(p);
    return (
      duration !== null &&
      duration >= MIN_VALID_DURATION_DAYS &&
      duration < MAX_VALID_DURATION_DAYS
    );
  });
}

/**
 * Legacy duration-only arithmetic mean kept ONLY for Part A baseline parity script and tests.
 */
export function legacyAverageLifespan(usagePeriods: UsagePeriod[]): number | null {
  const finishedPeriods = usagePeriods.filter(
    (p) => p.status === 'finished' && p.finished_date !== null && p.finished_date !== undefined
  );

  if (finishedPeriods.length === 0) {
    return null;
  }

  const totalDays = finishedPeriods.reduce((sum, p) => {
    const duration = calculateUsageDuration(p);
    return sum + (duration ?? 0);
  }, 0);

  const avg = Math.round((totalDays / finishedPeriods.length) * 10) / 10;
  return avg > 0 ? avg : null;
}

/**
 * Predicts expected lifespan (days) of the active bottle using rate_mean (rule_only):
 * - Excludes 0-day and >=1000-day cycles.
 * - When active effective size is known and at least one valid finished cycle has a known
 *   effective size with matching unit, predicts active_size / mean(size_i / duration_i).
 * - Otherwise falls back to the rule-cleaned mean duration.
 */
export function calculatePredictedLifespan({
  usagePeriods,
  product,
  purchases,
  activePurchase,
}: PredictedLifespanInput): number | null {
  const validPeriods = getValidFinishedPeriods(usagePeriods);
  if (validPeriods.length === 0) {
    return null;
  }

  const purchaseById = new Map(purchases.map((p) => [p.id, p]));
  const activeSize = getEffectiveSize(activePurchase, product);

  const rates: number[] = [];
  for (const period of validPeriods) {
    const duration = calculateUsageDuration(period);
    if (duration === null || duration <= 0) continue;

    const linkedPurchase = purchaseById.get(period.purchase_id) ?? null;
    const eff = getEffectiveSize(linkedPurchase, product);
    if (eff.size_value === null || eff.size_value <= 0) continue;
    if (activeSize.size_unit !== null && eff.size_unit !== activeSize.size_unit) continue;

    rates.push(eff.size_value / duration);
  }

  let rawLifespan: number;
  if (activeSize.size_value !== null && activeSize.size_value > 0 && rates.length > 0) {
    const meanRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    if (meanRate <= 0) return null;
    rawLifespan = activeSize.size_value / meanRate;
  } else {
    const totalDays = validPeriods.reduce((sum, p) => sum + (calculateUsageDuration(p) ?? 0), 0);
    rawLifespan = totalDays / validPeriods.length;
  }

  const rounded = Math.round(rawLifespan * 10) / 10;
  return rounded > 0 ? rounded : null;
}

export function getHistoryBucket(validCycleCount: number): HistoryBucket | null {
  if (validCycleCount < MIN_RANGE_CYCLES) return null;
  if (validCycleCount === 2) return '2';
  if (validCycleCount <= 4) return '3-4';
  return '5+';
}

/**
 * Computes calibrated P10-P90 run-out date range for an active cycle.
 * Returns null if fewer than MIN_RANGE_CYCLES valid cycles exist, or if today > maxDate (overdue).
 */
export function calculateRunOutRange(
  openedDate: string,
  predictedLifespan: number | null,
  validCycleCount: number,
  referenceDate?: string
): RunOutRange | null {
  if (!openedDate || predictedLifespan === null || predictedLifespan <= 0) {
    return null;
  }
  const bucket = getHistoryBucket(validCycleCount);
  if (!bucket) return null;

  const { q10, q90 } = calibrationData.buckets[bucket];
  const lowDays = Math.max(1, Math.round(predictedLifespan * (1 + q10)));
  const highDays = Math.max(lowDays, Math.round(predictedLifespan * (1 + q90)));

  const minDate = addDays(openedDate, lowDays);
  const maxDate = addDays(openedDate, highDays);

  const today = referenceDate ?? getTodayLocal();
  if (today > maxDate) {
    return null;
  }

  return { minDate, maxDate, lowDays, highDays, bucket };
}

export function formatRunOutRange(range: RunOutRange): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  return `Runs out between ${fmt(range.minDate)} and ${fmt(range.maxDate)}`;
}

/**
 * Calculates days used so far for an active period.
 */
export function calculateCurrentDaysUsed(
  openedDate: string,
  referenceDate?: string
): number {
  return getDaysUsed(openedDate, referenceDate);
}

/**
 * Predicts remaining days of an active usage period using historical predicted lifespan.
 * Returns null if no valid finished lifespan data exists ("Not enough data").
 * Result can be negative if the user has already exceeded the predicted lifespan.
 */
export function calculatePredictedRemainingDays(
  averageLifespan: number | null,
  currentDaysUsed: number
): number | null {
  if (averageLifespan === null || averageLifespan <= 0) {
    return null;
  }
  return Math.round(averageLifespan - currentDaysUsed);
}

/**
 * Calculates cost per day.
 * Must only be calculated when a valid positive lifespan (in days) exists.
 * Returns null if lifespan is 0, negative, or unavailable.
 */
export function calculateCostPerDay(
  purchasePrice: number,
  lifespanDays: number | null
): number | null {
  if (lifespanDays === null || lifespanDays <= 0 || purchasePrice < 0) {
    return null;
  }
  const cost = purchasePrice / lifespanDays;
  return Math.round(cost * 100) / 100;
}

/**
 * Calculates price per unit (e.g. ৳/ml, ৳/g, ৳/count).
 * Returns null if sizeValue is missing or <= 0.
 * Must NEVER be confused with cost per day.
 */
export function calculatePricePerUnit(
  purchasePrice: number,
  sizeValue?: number | null
): number | null {
  if (!sizeValue || sizeValue <= 0 || purchasePrice < 0) {
    return null;
  }
  const unitPrice = purchasePrice / sizeValue;
  return Math.round(unitPrice * 100) / 100;
}

/**
 * Calculates progress percentage (0-100+) based on current days used vs average lifespan.
 * Returns null if no average lifespan exists.
 */
export function calculateProgressPercent(
  currentDaysUsed: number,
  averageLifespan: number | null
): number | null {
  if (averageLifespan === null || averageLifespan <= 0) {
    return null;
  }
  const percent = (currentDaysUsed / averageLifespan) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/**
 * Calculates estimated monthly consumption cost for a product:
 * price ÷ average_lifespan × 30
 * Returns null if no finished lifespan history exists.
 */
export function calculateMonthlyConsumptionCost(
  purchasePrice: number,
  averageLifespan: number | null
): number | null {
  if (averageLifespan === null || averageLifespan <= 0 || purchasePrice < 0) {
    return null;
  }
  const monthlyCost = (purchasePrice / averageLifespan) * 30;
  return Math.round(monthlyCost);
}

/**
 * Effective pack size for a purchase: COALESCE(purchase size, product size).
 * Returns null for size_value/size_unit if neither has a valid size.
 */
export function getEffectiveSize(
  purchase: Pick<Purchase, 'size_value' | 'size_unit'> | null | undefined,
  product: Pick<Product, 'size_value' | 'size_unit'> | null | undefined
): { size_value: number | null; size_unit: SizeUnit | null } {
  if (purchase?.size_value !== undefined && purchase?.size_value !== null && purchase.size_value > 0) {
    return {
      size_value: purchase.size_value,
      size_unit: purchase.size_unit ?? product?.size_unit ?? null,
    };
  }
  return {
    size_value: product?.size_value ?? null,
    size_unit: product?.size_unit ?? null,
  };
}
