// ==============================================================================
// Nittoo Analytics Engine (Stage 6)
// Pure, Node-testable calculations for cross-product consumption analytics
// ==============================================================================

import type { Product, UsagePeriod, ProductWithHistory } from '../types';
import {
  calculateAverageLifespan,
  calculateCurrentDaysUsed,
  calculatePredictedRemainingDays,
  calculateCostPerDay,
} from './prediction';
import { addDays } from './dateUtils';

export interface UpcomingPurchaseItem {
  product: Product;
  predictedFinishDate: string;
  predictedRemainingDays: number;
  isOverdue: boolean;
  estimatedNextPrice: number;
  activeUsage: UsagePeriod;
}

export interface ProductCostEfficiency {
  product: Product;
  costPerDay: number;
  averageLifespan: number;
  monthlyCost: number;
}

export interface CostComparisonChartPoint {
  name: string;
  costPerDay: number;
}

/**
 * Calculates estimated next purchase cost from the user's historical purchase prices.
 * Returns average historical purchase price, or 0 if no purchases exist.
 */
export function calculateEstimatedNextPrice(purchases: ProductWithHistory['purchases']): number {
  const validPrices = purchases
    .map((p) => p.price)
    .filter((price) => typeof price === 'number' && !isNaN(price) && price >= 0);

  if (validPrices.length === 0) return 0;
  const sum = validPrices.reduce((total, p) => total + p, 0);
  return Math.round((sum / validPrices.length) * 100) / 100;
}

/**
 * Retrieves products predicted to run out within 30 days (or currently overdue).
 * Only includes active products with finished lifespan history.
 *
 * Sort order:
 * 1. Overdue products first, most overdue first.
 * 2. Future predicted run-outs next, soonest first.
 */
export function getUpcomingPurchases(
  productsWithHistory: ProductWithHistory[],
  referenceDate?: string
): UpcomingPurchaseItem[] {
  const upcoming: UpcomingPurchaseItem[] = [];

  for (const item of productsWithHistory) {
    const activeUsage = item.active_usage;
    if (!activeUsage) continue;

    // Must have finished history to have an average lifespan
    const averageLifespan = calculateAverageLifespan(item.finished_periods);
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const daysUsed = calculateCurrentDaysUsed(activeUsage.opened_date, referenceDate);
    const predictedRemainingDays = calculatePredictedRemainingDays(averageLifespan, daysUsed);

    if (predictedRemainingDays === null) continue;

    // Filter: predicted to run out within 30 days (including overdue products)
    if (predictedRemainingDays <= 30) {
      const isOverdue = predictedRemainingDays < 0;
      const predictedFinishDate = addDays(
        activeUsage.opened_date,
        Math.round(averageLifespan)
      );
      const estimatedNextPrice = calculateEstimatedNextPrice(item.purchases);

      upcoming.push({
        product: item.product,
        predictedFinishDate,
        predictedRemainingDays,
        isOverdue,
        estimatedNextPrice,
        activeUsage,
      });
    }
  }

  // Sort: Overdue first (most overdue first: -10 before -6), then future runouts (0, 1, 2...)
  return upcoming.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.predictedRemainingDays - b.predictedRemainingDays;
  });
}

/**
 * Calculates Estimated Monthly Consumption Cost:
 * Sum of (price ÷ average finished lifespan × 30) across eligible products with completed history.
 * Returns null if no eligible products exist.
 */
export function calculateEstimatedMonthlyConsumption(
  productsWithHistory: ProductWithHistory[]
): number | null {
  let totalMonthlyCost = 0;
  let eligibleCount = 0;

  for (const item of productsWithHistory) {
    const averageLifespan = calculateAverageLifespan(item.finished_periods);
    if (averageLifespan === null || averageLifespan <= 0) continue;

    // Get current/latest recorded purchase price
    const sortedPurchases = [...item.purchases].sort((a, b) =>
      b.purchase_date.localeCompare(a.purchase_date)
    );
    const latestPurchase = sortedPurchases[0];
    if (!latestPurchase || typeof latestPurchase.price !== 'number' || latestPurchase.price < 0) {
      continue;
    }

    const monthlyCost = (latestPurchase.price / averageLifespan) * 30;
    if (!isNaN(monthlyCost) && isFinite(monthlyCost)) {
      totalMonthlyCost += monthlyCost;
      eligibleCount++;
    }
  }

  if (eligibleCount === 0) return null;
  return totalMonthlyCost;
}

/**
 * Calculates Cost Efficiency Rankings:
 * Rank products by cost per day (lowest = most efficient, highest = least efficient).
 * Products without completed history are excluded.
 */
export function getCostEfficiencyRankings(
  productsWithHistory: ProductWithHistory[]
): {
  mostEfficient: ProductCostEfficiency[];
  leastEfficient: ProductCostEfficiency[];
} {
  const eligible: ProductCostEfficiency[] = [];

  for (const item of productsWithHistory) {
    const averageLifespan = calculateAverageLifespan(item.finished_periods);
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const sortedPurchases = [...item.purchases].sort((a, b) =>
      b.purchase_date.localeCompare(a.purchase_date)
    );
    const latestPurchase = sortedPurchases[0];
    if (!latestPurchase || typeof latestPurchase.price !== 'number' || latestPurchase.price < 0) {
      continue;
    }

    const costPerDay = calculateCostPerDay(latestPurchase.price, averageLifespan);
    if (costPerDay === null || isNaN(costPerDay) || !isFinite(costPerDay)) continue;

    const monthlyCost = (latestPurchase.price / averageLifespan) * 30;

    eligible.push({
      product: item.product,
      costPerDay,
      averageLifespan,
      monthlyCost,
    });
  }

  // Sort ascending by cost per day
  const sortedAscending = [...eligible].sort((a, b) => a.costPerDay - b.costPerDay);
  const sortedDescending = [...eligible].sort((a, b) => b.costPerDay - a.costPerDay);

  return {
    mostEfficient: sortedAscending,
    leastEfficient: sortedDescending,
  };
}

/**
 * Prepares chart data for Cost Per Day comparison.
 * Only includes products with valid historical cost/day.
 * Sorted ascending by cost per day for deterministic display.
 */
export function getCostComparisonChartData(
  productsWithHistory: ProductWithHistory[]
): CostComparisonChartPoint[] {
  const { mostEfficient } = getCostEfficiencyRankings(productsWithHistory);

  return mostEfficient.map((item) => {
    const brand = item.product.brand;
    const name = item.product.name;
    const displayName = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${name}`
      : name;

    return {
      name: displayName,
      costPerDay: Number(item.costPerDay.toFixed(2)),
    };
  });
}
