// ==============================================================================
// Nittoo Product Comparison & Value Intelligence Engine (Stage 11)
// Pure, deterministic calculations for personal product comparisons.
// Strictly separates OBSERVED historical data from PREDICTED active estimates.
// ==============================================================================

import type { Product, ProductWithHistory, SizeUnit } from '../types';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculatePredictedRemainingDays,
} from './prediction';
import { getDaysUsed, addDays } from './dateUtils';

export type ComparisonConfidence = 'no_data' | 'early_data' | 'historical';

export interface ProductActiveUsageContext {
  openedDate: string;
  elapsedDays: number;
  predictedRemainingDays: number | null;
  predictedFinishDate: string | null;
}

export interface ProductObservedMetrics {
  product: Product;
  completedCycles: number;
  confidenceState: ComparisonConfidence;
  confidenceLabel: string;
  observedAverageLifespan: number | null;
  observedCostPerDay: number | null;
  observedMonthlyConsumption: number | null;
  latestPurchasePrice: number | null;
  latestPurchaseCurrency: string;
  sizeValue: number | null;
  sizeUnit: SizeUnit | null;
  unitPrice: number | null;
  unitPriceLabel: string | null;
  isActive: boolean;
  activeUsageContext: ProductActiveUsageContext | null;
}

export interface MetricDifference {
  absolute: number;
  percentage: number | null; // e.g. +15.5 (%)
  formattedDiff: string;
}

export interface SizeComparisonResult {
  isCompatible: boolean;
  sizeA: number | null;
  sizeB: number | null;
  unit: string | null;
  difference: number | null;
  percentage: number | null;
  formattedDiff: string;
}

export interface ComparisonReport {
  productA: ProductObservedMetrics;
  productB: ProductObservedMetrics;
  isSameProduct: boolean;
  isSameCategory: boolean;
  priceComparison: MetricDifference | null;
  sizeComparison: SizeComparisonResult;
  unitPriceComparison: MetricDifference | null;
  lifespanComparison: MetricDifference | null;
  costPerDayComparison: MetricDifference | null;
  monthlyConsumptionComparison: MetricDifference | null;
  hasBothConsumptionData: boolean;
  isEarlyData: boolean;
  insightSummary: string;
  confidenceNotice: string | null;
}

/**
 * Compares two purchase prices.
 * Returns difference (B - A) and percentage relative to A.
 */
export function comparePrices(priceA: number, priceB: number): MetricDifference {
  const absolute = Math.round((priceB - priceA) * 100) / 100;
  const percentage =
    priceA > 0 ? Math.round(((priceB - priceA) / priceA) * 1000) / 10 : null;

  const sign = absolute > 0 ? '+' : '';
  const pctStr = percentage !== null ? ` (${sign}${percentage}%)` : '';
  const formattedDiff = `${sign}৳${Math.abs(absolute).toLocaleString()}${pctStr}`;

  return { absolute, percentage, formattedDiff };
}

/**
 * Compares product sizes if units are identical/compatible.
 * Does not perform cross-unit guesswork (e.g. ml vs g).
 */
export function compareSizes(
  sizeA?: number | null,
  unitA?: string | null,
  sizeB?: number | null,
  unitB?: string | null
): SizeComparisonResult {
  if (
    sizeA === undefined ||
    sizeA === null ||
    sizeA <= 0 ||
    sizeB === undefined ||
    sizeB === null ||
    sizeB <= 0 ||
    !unitA ||
    !unitB ||
    unitA.trim().toLowerCase() !== unitB.trim().toLowerCase()
  ) {
    return {
      isCompatible: false,
      sizeA: sizeA ?? null,
      sizeB: sizeB ?? null,
      unit: null,
      difference: null,
      percentage: null,
      formattedDiff: 'Size comparison unavailable',
    };
  }

  const cleanUnit = unitA.trim();
  const diff = Math.round((sizeB - sizeA) * 100) / 100;
  const pct = Math.round(((sizeB - sizeA) / sizeA) * 1000) / 10;
  const sign = diff > 0 ? '+' : '';
  const formattedDiff = `${sign}${diff} ${cleanUnit} (${sign}${pct}%)`;

  return {
    isCompatible: true,
    sizeA,
    sizeB,
    unit: cleanUnit,
    difference: diff,
    percentage: pct,
    formattedDiff,
  };
}

/**
 * Computes price per unit (৳/ml, ৳/g, ৳/count).
 */
export function calculateUnitPrice(
  price: number,
  sizeValue?: number | null,
  sizeUnit?: string | null
): { unitPrice: number | null; unitPriceLabel: string | null } {
  if (
    sizeValue === undefined ||
    sizeValue === null ||
    sizeValue <= 0 ||
    price < 0 ||
    !sizeUnit
  ) {
    return { unitPrice: null, unitPriceLabel: null };
  }

  const unitPrice = Math.round((price / sizeValue) * 100) / 100;
  const unitPriceLabel = `৳${unitPrice.toFixed(2)} / ${sizeUnit}`;
  return { unitPrice, unitPriceLabel };
}

/**
 * Compares two unit prices when units are compatible.
 */
export function compareUnitPrices(
  unitPriceA: number | null,
  unitPriceB: number | null,
  isCompatibleUnits: boolean
): MetricDifference | null {
  if (
    unitPriceA === null ||
    unitPriceB === null ||
    unitPriceA <= 0 ||
    unitPriceB <= 0 ||
    !isCompatibleUnits
  ) {
    return null;
  }

  const absolute = Math.round((unitPriceB - unitPriceA) * 100) / 100;
  const percentage = Math.round(((unitPriceB - unitPriceA) / unitPriceA) * 1000) / 10;
  const sign = absolute > 0 ? '+' : '';
  const formattedDiff = `${sign}৳${Math.abs(absolute).toFixed(2)}${
    percentage !== null ? ` (${sign}${percentage}%)` : ''
  }`;

  return { absolute, percentage, formattedDiff };
}

/**
 * Derives strictly observed personal metrics from product history.
 * Never substitutes a predicted metric into an observed metric.
 */
export function deriveProductObservedMetrics(
  history: ProductWithHistory
): ProductObservedMetrics {
  const { product, purchases, finished_periods, active_usage } = history;
  const completedCycles = finished_periods.length;

  let confidenceState: ComparisonConfidence = 'no_data';
  let confidenceLabel = 'Not enough data';

  if (completedCycles === 1) {
    confidenceState = 'early_data';
    confidenceLabel = 'Early data (1 completed cycle)';
  } else if (completedCycles >= 2) {
    confidenceState = 'historical';
    confidenceLabel = `Based on your history (${completedCycles} completed cycles)`;
  }

  // 1. Observed Average Lifespan (strictly finished cycles)
  const observedAverageLifespan =
    completedCycles > 0 ? calculateAverageLifespan(finished_periods) : null;

  // 2. Observed Weighted Cost / Day
  let observedCostPerDay: number | null = null;
  if (completedCycles > 0) {
    let totalFinishedDays = 0;
    let totalFinishedPrice = 0;

    for (const fp of finished_periods) {
      const duration = calculateUsageDuration(fp) ?? 0;
      const linkedPurchase = purchases.find((pu) => pu.id === fp.purchase_id);
      if (duration > 0 && linkedPurchase && linkedPurchase.price >= 0) {
        totalFinishedDays += duration;
        totalFinishedPrice += linkedPurchase.price;
      }
    }

    if (totalFinishedDays > 0) {
      observedCostPerDay = Math.round((totalFinishedPrice / totalFinishedDays) * 100) / 100;
    }
  }

  // 3. Observed Monthly Normalized Consumption (strictly cost/day * 30)
  const observedMonthlyConsumption =
    observedCostPerDay !== null ? Math.round(observedCostPerDay * 30) : null;

  // 4. Latest Purchase Price & Unit Price
  const latestPurchase = purchases[0] || null;
  const latestPurchasePrice = latestPurchase ? latestPurchase.price : null;
  const latestPurchaseCurrency = latestPurchase?.currency || 'BDT';

  const { unitPrice, unitPriceLabel } = latestPurchasePrice !== null
    ? calculateUnitPrice(latestPurchasePrice, product.size_value, product.size_unit)
    : { unitPrice: null, unitPriceLabel: null };

  // 5. Active Usage Context (Strictly isolated context, never substituted into observed metrics)
  let activeUsageContext: ProductActiveUsageContext | null = null;
  if (active_usage) {
    const elapsedDays = getDaysUsed(active_usage.opened_date);
    const predictedRemainingDays =
      observedAverageLifespan !== null
        ? calculatePredictedRemainingDays(observedAverageLifespan, elapsedDays)
        : null;
    const predictedFinishDate =
      observedAverageLifespan !== null
        ? addDays(active_usage.opened_date, Math.round(observedAverageLifespan))
        : null;

    activeUsageContext = {
      openedDate: active_usage.opened_date,
      elapsedDays,
      predictedRemainingDays,
      predictedFinishDate,
    };
  }

  return {
    product,
    completedCycles,
    confidenceState,
    confidenceLabel,
    observedAverageLifespan,
    observedCostPerDay,
    observedMonthlyConsumption,
    latestPurchasePrice,
    latestPurchaseCurrency,
    sizeValue: product.size_value ?? null,
    sizeUnit: product.size_unit ?? null,
    unitPrice,
    unitPriceLabel,
    isActive: Boolean(active_usage),
    activeUsageContext,
  };
}

/**
 * Deterministic Value Insight Engine.
 * Produces objective, evidence-based statements without subjective praise.
 */
export function deriveComparisonInsight(
  metricsA: ProductObservedMetrics,
  metricsB: ProductObservedMetrics,
  isSameProduct: boolean
): string {
  if (isSameProduct) {
    return 'Comparing a product with itself does not yield comparative insights. Select a different product.';
  }

  const nameA = metricsA.product.name;
  const nameB = metricsB.product.name;

  // If either product lacks completed cycles, consumption comparison is not possible
  if (metricsA.completedCycles === 0 || metricsB.completedCycles === 0) {
    return 'Not enough data to compare actual consumption yet.';
  }

  const costA = metricsA.observedCostPerDay;
  const costB = metricsB.observedCostPerDay;

  if (costA === null || costB === null) {
    return 'Not enough data to compare actual consumption yet.';
  }

  const diffCost = Math.round((costB - costA) * 100) / 100;
  const priceA = metricsA.latestPurchasePrice ?? 0;
  const priceB = metricsB.latestPurchasePrice ?? 0;
  const lifeA = metricsA.observedAverageLifespan ?? 0;
  const lifeB = metricsB.observedAverageLifespan ?? 0;
  const unitA = metricsA.unitPrice;
  const unitB = metricsB.unitPrice;

  // Rule 1: Similar Value (within 2% or ৳0.25/day)
  if (Math.abs(diffCost) <= 0.25 || (costA > 0 && Math.abs(diffCost) / costA <= 0.02)) {
    return 'Your usage shows very similar value between these products.';
  }

  // Rule 2: Product B is cheaper per day for user
  if (costB < costA) {
    if (priceB > priceA) {
      return `${nameB} costs more upfront than ${nameA}, but is cheaper per day for your usage.`;
    }
    if (unitA !== null && unitB !== null && unitB > unitA) {
      return `Although the unit price is higher than ${nameA}, your usage makes ${nameB} cheaper per day.`;
    }
    return `${nameB} costs less per day than ${nameA} for your usage.`;
  }

  // Rule 3: Product B is more expensive per day for user
  if (costB > costA) {
    if (lifeB > lifeA) {
      return `${nameB} lasts longer than ${nameA}, but costs more per day for your usage.`;
    }
    return `${nameB} costs more per day than ${nameA} for your usage.`;
  }

  return 'Your usage shows very similar value between these products.';
}

/**
 * Builds the complete structured comparison report for two products.
 */
export function buildComparisonReport(
  historyA: ProductWithHistory,
  historyB: ProductWithHistory
): ComparisonReport {
  const metricsA = deriveProductObservedMetrics(historyA);
  const metricsB = deriveProductObservedMetrics(historyB);

  const isSameProduct = metricsA.product.id === metricsB.product.id;
  const isSameCategory = metricsA.product.category === metricsB.product.category;

  // Price Difference
  const priceComparison =
    metricsA.latestPurchasePrice !== null && metricsB.latestPurchasePrice !== null
      ? comparePrices(metricsA.latestPurchasePrice, metricsB.latestPurchasePrice)
      : null;

  // Size Comparison
  const sizeComparison = compareSizes(
    metricsA.sizeValue,
    metricsA.sizeUnit,
    metricsB.sizeValue,
    metricsB.sizeUnit
  );

  // Unit Price Comparison
  const unitPriceComparison = compareUnitPrices(
    metricsA.unitPrice,
    metricsB.unitPrice,
    sizeComparison.isCompatible
  );

  // Lifespan Comparison
  let lifespanComparison: MetricDifference | null = null;
  if (
    metricsA.observedAverageLifespan !== null &&
    metricsB.observedAverageLifespan !== null
  ) {
    const absDiff =
      Math.round(
        (metricsB.observedAverageLifespan - metricsA.observedAverageLifespan) * 10
      ) / 10;
    const pct =
      metricsA.observedAverageLifespan > 0
        ? Math.round(
            ((metricsB.observedAverageLifespan - metricsA.observedAverageLifespan) /
              metricsA.observedAverageLifespan) *
              1000
          ) / 10
        : null;
    const sign = absDiff > 0 ? '+' : '';
    const formattedDiff = `${sign}${absDiff} days${pct !== null ? ` (${sign}${pct}%)` : ''}`;
    lifespanComparison = { absolute: absDiff, percentage: pct, formattedDiff };
  }

  // Cost Per Day Comparison
  let costPerDayComparison: MetricDifference | null = null;
  if (metricsA.observedCostPerDay !== null && metricsB.observedCostPerDay !== null) {
    const absDiff =
      Math.round((metricsB.observedCostPerDay - metricsA.observedCostPerDay) * 100) / 100;
    const pct =
      metricsA.observedCostPerDay > 0
        ? Math.round(
            ((metricsB.observedCostPerDay - metricsA.observedCostPerDay) /
              metricsA.observedCostPerDay) *
              1000
          ) / 10
        : null;
    const sign = absDiff > 0 ? '+' : '';
    const formattedDiff = `${sign}৳${Math.abs(absDiff).toFixed(2)}/day${
      pct !== null ? ` (${sign}${pct}%)` : ''
    }`;
    costPerDayComparison = { absolute: absDiff, percentage: pct, formattedDiff };
  }

  // Monthly Consumption Comparison
  let monthlyConsumptionComparison: MetricDifference | null = null;
  if (
    metricsA.observedMonthlyConsumption !== null &&
    metricsB.observedMonthlyConsumption !== null
  ) {
    const absDiff =
      metricsB.observedMonthlyConsumption - metricsA.observedMonthlyConsumption;
    const pct =
      metricsA.observedMonthlyConsumption > 0
        ? Math.round(
            ((metricsB.observedMonthlyConsumption - metricsA.observedMonthlyConsumption) /
              metricsA.observedMonthlyConsumption) *
              1000
          ) / 10
        : null;
    const sign = absDiff > 0 ? '+' : '';
    const formattedDiff = `${sign}৳${Math.abs(absDiff).toLocaleString()}/month${
      pct !== null ? ` (${sign}${pct}%)` : ''
    }`;
    monthlyConsumptionComparison = {
      absolute: absDiff,
      percentage: pct,
      formattedDiff,
    };
  }

  const hasBothConsumptionData =
    metricsA.completedCycles > 0 && metricsB.completedCycles > 0;

  const isEarlyData =
    hasBothConsumptionData &&
    (metricsA.completedCycles === 1 || metricsB.completedCycles === 1);

  const insightSummary = deriveComparisonInsight(metricsA, metricsB, isSameProduct);

  let confidenceNotice: string | null = null;
  if (hasBothConsumptionData && isEarlyData) {
    confidenceNotice =
      'Early data: One or both products have only 1 completed cycle. Value metrics will refine with more cycles.';
  }

  return {
    productA: metricsA,
    productB: metricsB,
    isSameProduct,
    isSameCategory,
    priceComparison,
    sizeComparison,
    unitPriceComparison,
    lifespanComparison,
    costPerDayComparison,
    monthlyConsumptionComparison,
    hasBothConsumptionData,
    isEarlyData,
    insightSummary,
    confidenceNotice,
  };
}
