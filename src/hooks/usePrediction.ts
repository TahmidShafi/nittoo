// ==============================================================================
// Nittoo usePrediction Hook & Prediction Utilities
// Pure Calculation Pipeline: Finished Lifespans Only, No Fabricated Estimates
// ==============================================================================

import { useMemo } from 'react';
import type { ProductWithDetails } from '../types';
import {
  calculateAverageLifespan,
  calculateCurrentDaysUsed,
  calculateCostPerDay,
  calculatePricePerUnit,
  calculateProgressPercent,
} from '../lib/prediction';

export interface PredictionMetrics {
  daysUsed: number;
  averageLifespan: number | null;
  predictedRemainingDays: number | null;
  costPerDay: number | null;
  pricePerUnit: number | null;
  progressPercent: number | null;
  hasEnoughData: boolean;
  isOverdue: boolean;
  overdueDays: number;
  urgencyState: 'overdue' | 'running_soon' | 'no_prediction';
  urgencyLabel: string;
}

/**
 * Pure calculation function for product prediction metrics.
 * Callable in both React components and Node test scripts.
 */
export function getPredictionMetrics(
  product: ProductWithDetails,
  referenceDate?: string
): PredictionMetrics {
  const activeUsage = product.active_usage;
  const latestPurchase = product.latest_purchase;

  if (!activeUsage) {
    return {
      daysUsed: 0,
      averageLifespan: null,
      predictedRemainingDays: null,
      costPerDay: null,
      pricePerUnit: null,
      progressPercent: null,
      hasEnoughData: false,
      isOverdue: false,
      overdueDays: 0,
      urgencyState: 'no_prediction',
      urgencyLabel: 'Inactive',
    };
  }

  // 1. Days Used: today UTC - opened_date
  const daysUsed = calculateCurrentDaysUsed(activeUsage.opened_date, referenceDate);

  // 2. Average Lifespan: finished usage periods ONLY
  const finishedPeriods = product.finished_periods || [];
  const averageLifespan = calculateAverageLifespan(finishedPeriods);
  const hasEnoughData = averageLifespan !== null && averageLifespan > 0;

  // 3. Predicted Remaining Days: averageLifespan - daysUsed (preserves negative values for overdue detection)
  const predictedRemainingDays = hasEnoughData
    ? Math.round(averageLifespan! - daysUsed)
    : null;

  const isOverdue = predictedRemainingDays !== null && predictedRemainingDays < 0;
  const overdueDays = isOverdue ? Math.abs(predictedRemainingDays!) : 0;

  // 4. Cost Per Day: purchase_price / averageLifespan
  const costPerDay =
    latestPurchase && hasEnoughData
      ? calculateCostPerDay(latestPurchase.price, averageLifespan)
      : null;

  // 5. Price Per Unit: purchase_price / size_value (separated metric)
  const pricePerUnit =
    latestPurchase && product.size_value
      ? calculatePricePerUnit(latestPurchase.price, product.size_value)
      : null;

  // 6. Progress: daysUsed / averageLifespan * 100 (clamped visually to 0-100)
  const progressPercent = hasEnoughData
    ? calculateProgressPercent(daysUsed, averageLifespan)
    : null;

  // 7. Urgency State & Label
  let urgencyState: 'overdue' | 'running_soon' | 'no_prediction';
  let urgencyLabel: string;

  if (isOverdue) {
    urgencyState = 'overdue';
    urgencyLabel = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
  } else if (predictedRemainingDays !== null) {
    urgencyState = 'running_soon';
    urgencyLabel = `${predictedRemainingDays} day${predictedRemainingDays === 1 ? '' : 's'} left`;
  } else {
    urgencyState = 'no_prediction';
    urgencyLabel = 'First Cycle';
  }

  return {
    daysUsed,
    averageLifespan,
    predictedRemainingDays,
    costPerDay,
    pricePerUnit,
    progressPercent,
    hasEnoughData,
    isOverdue,
    overdueDays,
    urgencyState,
    urgencyLabel,
  };
}

/**
 * Reusable React hook for computing prediction metrics of an active product
 */
export function usePrediction(
  product: ProductWithDetails,
  referenceDate?: string
): PredictionMetrics {
  return useMemo(
    () => getPredictionMetrics(product, referenceDate),
    [product, referenceDate]
  );
}
