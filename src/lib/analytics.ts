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
  completedCycles: number;
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
 * Unified Price Basis Helper:
 * All cross-product analytics (calculateEstimatedMonthlyConsumption, getCostEfficiencyRankings,
 * and getUpcomingPurchases) use the latest recorded purchase price (by purchase_date DESC)
 * so run-rate, efficiency, and upcoming rebuy estimates consistently reflect current replacement cost.
 * Returns null if no valid (>= 0) purchase exists.
 */
export function getLatestPurchasePrice(purchases: ProductWithHistory['purchases']): number | null {
  if (!purchases || purchases.length === 0) return null;
  const sorted = [...purchases].sort((a, b) =>
    b.purchase_date.localeCompare(a.purchase_date)
  );
  const latest = sorted[0];
  if (!latest || typeof latest.price !== 'number' || isNaN(latest.price) || latest.price < 0) {
    return null;
  }
  return latest.price;
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
      const estimatedNextPrice = getLatestPurchasePrice(item.purchases) ?? 0;

      upcoming.push({
        product: item.product,
        predictedFinishDate,
        predictedRemainingDays,
        isOverdue,
        estimatedNextPrice,
        activeUsage,
        completedCycles: item.finished_periods.length,
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
 * Sum of (latest_purchase_price ÷ average finished lifespan × 30) across ACTIVE products
 * with completed history. Inactive products (no active_usage) are excluded.
 * Returns null if no eligible active products exist.
 */
export function calculateEstimatedMonthlyConsumption(
  productsWithHistory: ProductWithHistory[]
): number | null {
  let totalMonthlyCost = 0;
  let eligibleCount = 0;

  for (const item of productsWithHistory) {
    if (!item.active_usage) continue;

    const averageLifespan = calculateAverageLifespan(item.finished_periods);
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const latestPrice = getLatestPurchasePrice(item.purchases);
    if (latestPrice === null) continue;

    const monthlyCost = (latestPrice / averageLifespan) * 30;
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

    const latestPrice = getLatestPurchasePrice(item.purchases);
    if (latestPrice === null) continue;

    const costPerDay = calculateCostPerDay(latestPrice, averageLifespan);
    if (costPerDay === null || isNaN(costPerDay) || !isFinite(costPerDay)) continue;

    const monthlyCost = (latestPrice / averageLifespan) * 30;

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

// ------------------------------------------------------------------------------
// Category Spending Intelligence (Stage 18)
// Pure, deterministic aggregation of estimated monthly consumption by category.
// ------------------------------------------------------------------------------

export interface CategorySpending {
  category: string;
  monthlyCost: number;
  productCount: number;
  percentageOfTotal: number;
}

/**
 * Calculates Estimated Monthly Consumption Cost aggregated by Product Category.
 * Strictly includes only products eligible under existing monthly consumption logic
 * (requires completed lifespan history and valid latest purchase price).
 *
 * Deterministic Sorting:
 * 1. Primary: Highest monthly cost first (descending)
 * 2. Secondary: Alphabetical category order when monthly costs are equal
 *
 * Returns empty array if no eligible products exist or total monthly cost is 0.
 */
export function getCategorySpending(
  productsWithHistory: ProductWithHistory[]
): CategorySpending[] {
  const categoryMap = new Map<string, { totalMonthly: number; count: number }>();
  let totalEligibleMonthly = 0;

  for (const item of productsWithHistory) {
    const averageLifespan = calculateAverageLifespan(item.finished_periods);
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const latestPrice = getLatestPurchasePrice(item.purchases);
    if (latestPrice === null) continue;

    const monthlyCost = (latestPrice / averageLifespan) * 30;
    if (isNaN(monthlyCost) || !isFinite(monthlyCost)) continue;

    totalEligibleMonthly += monthlyCost;

    const catName = item.product.category || 'Other';
    const existing = categoryMap.get(catName) || { totalMonthly: 0, count: 0 };
    existing.totalMonthly += monthlyCost;
    existing.count += 1;
    categoryMap.set(catName, existing);
  }

  if (categoryMap.size === 0) {
    return [];
  }

  const results: CategorySpending[] = [];

  for (const [category, data] of categoryMap.entries()) {
    const roundedCost = Math.round(data.totalMonthly);
    const percentage =
      totalEligibleMonthly > 0
        ? Math.round((data.totalMonthly / totalEligibleMonthly) * 100)
        : 0;

    results.push({
      category,
      monthlyCost: roundedCost,
      productCount: data.count,
      percentageOfTotal: percentage,
    });
  }

  // Deterministic Sort: Highest monthly cost first; tie-breaker: alphabetical
  return results.sort((a, b) => {
    if (b.monthlyCost !== a.monthlyCost) {
      return b.monthlyCost - a.monthlyCost;
    }
    return a.category.localeCompare(b.category);
  });
}

export const calculateCategorySpending = getCategorySpending;
