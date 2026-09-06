// ==============================================================================
// Nittoo Prediction & Metric Engine
// Strict Business Logic: Finished Periods Only, No Fabricated Estimates
// ==============================================================================

import type { UsagePeriod } from '../types';
import { getDaysBetween, getDaysUsed } from './dateUtils';

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
 * Calculates average lifespan in days strictly from finished usage periods.
 * If zero finished periods exist, returns null ("Not enough data").
 */
export function calculateAverageLifespan(usagePeriods: UsagePeriod[]): number | null {
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

  // Avoid division by zero
  if (finishedPeriods.length === 0) return null;

  return Math.round((totalDays / finishedPeriods.length) * 10) / 10;
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
 * Predicts remaining days of an active usage period using historical average lifespan.
 * Returns null if no finished lifespan data exists ("Not enough data").
 * Result can be negative if the user has already exceeded the historical average lifespan.
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
