// ==============================================================================
// Nittoo Analytics Engine (Stage 6)
// Pure, Node-testable calculations for cross-product consumption analytics
//
// PRICE BASIS RULE:
// - Current-cost metrics (calculateEstimatedMonthlyConsumption,
//   getCostEfficiencyRankings, getCostComparisonChartData, getCategorySpending)
//   use the ACTIVE purchase's price (matching usePrediction) when an active
//   usage period is linked, falling back to latest_purchase only when no active
//   usage exists. An unopened backup bottle never inflates current run-rate.
//   Where unit economics are computed, effective size is
//   COALESCE(purchase.size_value, product.size_value) via getEffectiveSize.
// - Forward-looking estimates (getUpcomingPurchases) use
//   calculateEstimatedNextPrice (historical average purchase price).
// ==============================================================================

import type { Product, Purchase, UsagePeriod, ProductWithDetails, ProductWithHistory } from '../types';
import {
  calculateCostPerDay,
  calculateCurrentDaysUsed,
  calculatePredictedLifespan,
  calculatePredictedRemainingDays,
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
 * Returns the latest valid (>= 0) purchase price by purchase_date DESC, or null.
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
 * Resolves the current purchase for a product:
 * 1) the active usage period's linked purchase when an active usage exists,
 * 2) otherwise the latest purchase by purchase_date DESC,
 * 3) or null if the product has no purchases.
 */
export function getCurrentPurchase(item: ProductWithHistory): Purchase | null {
  if (item.active_usage) {
    const activePurchase = item.purchases.find(
      (p) => p.id === item.active_usage?.purchase_id
    );
    if (activePurchase) return activePurchase;
  }
  if (!item.purchases || item.purchases.length === 0) return null;
  const sorted = [...item.purchases].sort((a, b) =>
    b.purchase_date.localeCompare(a.purchase_date)
  );
  return sorted[0] ?? null;
}

/**
 * Current-Cost Price Basis Helper (matches usePrediction):
 * Uses the active usage period's linked purchase price when an active usage exists,
 * falling back to getLatestPurchasePrice when no active usage is present.
 */
export function getActiveOrLatestPurchasePrice(item: ProductWithHistory): number | null {
  const currentPurchase = getCurrentPurchase(item);
  if (
    currentPurchase &&
    typeof currentPurchase.price === 'number' &&
    !isNaN(currentPurchase.price) &&
    currentPurchase.price >= 0
  ) {
    return currentPurchase.price;
  }
  return getLatestPurchasePrice(item.purchases);
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

    // Must have valid finished history to have a predicted lifespan
    const activePurchase =
      item.purchases.find((p) => p.id === activeUsage.purchase_id) ?? item.purchases[0] ?? null;
    const averageLifespan = calculatePredictedLifespan({
      usagePeriods: item.finished_periods,
      product: item.product,
      purchases: item.purchases,
      activePurchase,
    });
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
 * Sum of (active_purchase_price ÷ average finished lifespan × 30) across ACTIVE products
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

    const activePurchase = getCurrentPurchase(item);
    const averageLifespan = calculatePredictedLifespan({
      usagePeriods: item.finished_periods,
      product: item.product,
      purchases: item.purchases,
      activePurchase,
    });
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const activePrice = getActiveOrLatestPurchasePrice(item);
    if (activePrice === null) continue;

    const monthlyCost = (activePrice / averageLifespan) * 30;
    if (!isNaN(monthlyCost) && isFinite(monthlyCost)) {
      totalMonthlyCost += monthlyCost;
      eligibleCount++;
    }
  }

  if (eligibleCount === 0) return null;
  return totalMonthlyCost;
}

/**
 * Single source of truth for Dashboard summary monthly consumption:
 * converts ProductWithDetails[] to ProductWithHistory[] and delegates
 * to calculateEstimatedMonthlyConsumption so Dashboard and Analytics
 * always match identically.
 */
export function calculateEstimatedMonthlyConsumptionFromDetails(
  products: ProductWithDetails[]
): number | null {
  const histories: ProductWithHistory[] = products.map((p) => {
    const purchases = p.purchases ?? [];
    const fallbackPurchases =
      purchases.length > 0
        ? purchases
        : [p.active_purchase, p.latest_purchase].filter(
            (x): x is NonNullable<typeof x> => Boolean(x)
          );

    return {
      product: p,
      purchases: fallbackPurchases,
      usage_periods: p.finished_periods ?? [],
      finished_periods: p.finished_periods ?? [],
      active_usage: p.active_usage ?? null,
      unopened_purchases: [],
    };
  });

  return calculateEstimatedMonthlyConsumption(histories);
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
    // Products without an active bottle remain eligible in cost-efficiency rankings
    // using their latest purchase (via getCurrentPurchase), so historical cost/day
    // stays available even when a user is temporarily between bottles.
    const activePurchase = getCurrentPurchase(item);
    const averageLifespan = calculatePredictedLifespan({
      usagePeriods: item.finished_periods,
      product: item.product,
      purchases: item.purchases,
      activePurchase,
    });
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const currentPrice = getActiveOrLatestPurchasePrice(item);
    if (currentPrice === null) continue;

    const costPerDay = calculateCostPerDay(currentPrice, averageLifespan);
    if (costPerDay === null || isNaN(costPerDay) || !isFinite(costPerDay)) continue;

    const monthlyCost = (currentPrice / averageLifespan) * 30;

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
    // Include only products with an active usage period so category totals
    // reconcile 1:1 with calculateEstimatedMonthlyConsumption.
    if (!item.active_usage) continue;

    const activePurchase = getCurrentPurchase(item);
    const averageLifespan = calculatePredictedLifespan({
      usagePeriods: item.finished_periods,
      product: item.product,
      purchases: item.purchases,
      activePurchase,
    });
    if (averageLifespan === null || averageLifespan <= 0) continue;

    const currentPrice = getActiveOrLatestPurchasePrice(item);
    if (currentPrice === null) continue;

    const monthlyCost = (currentPrice / averageLifespan) * 30;
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
