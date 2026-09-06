// ==============================================================================
// Nittoo Stage 6 Automated Verification Script: Analytics
// Tests Upcoming Purchases, Monthly Consumption, Cost Efficiency, Chart Data, and Guards
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import {
  getUpcomingPurchases,
  calculateEstimatedMonthlyConsumption,
  getCostEfficiencyRankings,
  getCostComparisonChartData,
  calculateEstimatedNextPrice,
} from '../src/lib/analytics';
import type { ProductWithHistory } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

function assertCloseTo(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.error(`❌ ASSERTION FAILED: ${message} (expected ~${expected}, got ${actual}, diff ${diff} > ${tolerance})`);
    process.exit(1);
  }
  console.log(`  ✓ ${message} (got ${actual})`);
}

async function runAnalyticsVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 6 CONSUMPTION ANALYTICS VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  const referenceDate = '2026-09-06';
  const products = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  assert(products.length === 3, `Found 3 user products in seed data (got: ${products.length})`);

  const historyPromises = products.map((p) => db.getProductHistory(p.id, DEFAULT_MOCK_USER_ID));
  const histories = (await Promise.all(historyPromises)).filter(
    (h): h is ProductWithHistory => h !== null
  );
  assert(histories.length === 3, `Loaded history for all 3 products`);

  // ----------------------------------------------------------------------------
  // 1. UPCOMING PURCHASES (30-day window, reference: 2026-09-06)
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying Upcoming Purchases (Window: <= 30 days) ---');
  const upcoming = getUpcomingPurchases(histories, referenceDate);

  assert(upcoming.length === 1, `Exactly 1 upcoming purchase found (got: ${upcoming.length})`);
  const sensodyneUpcoming = upcoming[0];

  assert(sensodyneUpcoming.product.name.includes('Sensodyne'), 'Sensodyne is the upcoming purchase');
  assert(sensodyneUpcoming.predictedRemainingDays === -6, `Sensodyne predicted remaining is -6 days (got: ${sensodyneUpcoming.predictedRemainingDays})`);
  assert(sensodyneUpcoming.isOverdue === true, 'Sensodyne is marked overdue');
  assert(sensodyneUpcoming.predictedFinishDate === '2026-08-31', `Sensodyne predicted finish date is 2026-08-31 (got: ${sensodyneUpcoming.predictedFinishDate})`);
  assert(sensodyneUpcoming.estimatedNextPrice === 480, `Sensodyne estimated next purchase price is ৳480 (got: ৳${sensodyneUpcoming.estimatedNextPrice})`);

  // Exclusion checks
  const ceraveInUpcoming = upcoming.some((u) => u.product.name.includes('CeraVe'));
  assert(!ceraveInUpcoming, 'CeraVe is EXCLUDED from upcoming purchases (55 days remaining > 30 days)');

  const olaplexInUpcoming = upcoming.some((u) => u.product.name.includes('Olaplex'));
  assert(!olaplexInUpcoming, 'Olaplex is EXCLUDED from upcoming purchases (0 finished periods, no prediction)');

  // ----------------------------------------------------------------------------
  // 2. ESTIMATED MONTHLY CONSUMPTION COST
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Verifying Estimated Monthly Consumption Cost ---');
  const monthlyCost = calculateEstimatedMonthlyConsumption(histories);
  assert(monthlyCost !== null, 'Estimated monthly consumption is not null');

  // Expected:
  // CeraVe: 1250 ÷ 62 × 30 ≈ 604.8387
  // Sensodyne: 480 ÷ 45 × 30 = 320.0000
  // Total: ~924.8387
  assertCloseTo(monthlyCost!, 924.84, 0.5, 'Total monthly consumption cost is ~৳924.84');
  assert(Math.round(monthlyCost!) === 925, `Rounded monthly consumption is ৳925 (got: ৳${Math.round(monthlyCost!)})`);

  // ----------------------------------------------------------------------------
  // 3. COST EFFICIENCY RANKINGS
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Verifying Cost Efficiency Rankings ---');
  const { mostEfficient, leastEfficient } = getCostEfficiencyRankings(histories);

  assert(mostEfficient.length === 2, `Rankings include exactly 2 eligible products (got: ${mostEfficient.length})`);
  assert(leastEfficient.length === 2, `Least efficient includes exactly 2 eligible products (got: ${leastEfficient.length})`);

  // Most efficient: Sensodyne first (lowest cost/day: ~10.67)
  const topEfficient = mostEfficient[0];
  assert(topEfficient.product.name.includes('Sensodyne'), `Most cost-efficient is Sensodyne (got: ${topEfficient.product.name})`);
  assertCloseTo(topEfficient.costPerDay, 10.67, 0.05, 'Sensodyne cost per day is ~৳10.67');

  // Second in most efficient: CeraVe (~20.16)
  const secondEfficient = mostEfficient[1];
  assert(secondEfficient.product.name.includes('CeraVe'), `Second cost-efficient is CeraVe (got: ${secondEfficient.product.name})`);
  assertCloseTo(secondEfficient.costPerDay, 20.16, 0.05, 'CeraVe cost per day is ~৳20.16');

  // Least efficient: CeraVe first (highest cost/day)
  const topLeastEfficient = leastEfficient[0];
  assert(topLeastEfficient.product.name.includes('CeraVe'), `Least cost-efficient is CeraVe (got: ${topLeastEfficient.product.name})`);

  // Olaplex must be excluded
  const olaplexInRankings = mostEfficient.some((item) => item.product.name.includes('Olaplex'));
  assert(!olaplexInRankings, 'Olaplex is EXCLUDED from cost efficiency rankings (0 finished periods)');

  // ----------------------------------------------------------------------------
  // 4. CHART DATA INTEGRITY
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Cost Per Day Chart Data ---');
  const chartPoints = getCostComparisonChartData(histories);

  assert(chartPoints.length === 2, `Chart data has exactly 2 points (got: ${chartPoints.length})`);
  for (const point of chartPoints) {
    assert(typeof point.name === 'string' && point.name.length > 0, `Valid point name: "${point.name}"`);
    assert(typeof point.costPerDay === 'number', `Valid point costPerDay type`);
    assert(!isNaN(point.costPerDay), `costPerDay is not NaN for ${point.name}`);
    assert(isFinite(point.costPerDay), `costPerDay is finite for ${point.name}`);
    assert(point.costPerDay > 0, `costPerDay is positive (${point.costPerDay}) for ${point.name}`);
  }

  // ----------------------------------------------------------------------------
  // 5. EDGE CASES AND CHART SAFETY
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying Edge Cases & Chart Safety ---');

  // 5A: Zero eligible products (e.g. empty account)
  const emptyUpcoming = getUpcomingPurchases([], referenceDate);
  assert(emptyUpcoming.length === 0, 'Empty input produces 0 upcoming purchases');

  const emptyMonthly = calculateEstimatedMonthlyConsumption([]);
  assert(emptyMonthly === null, 'Empty input produces null monthly consumption ("Not enough data")');

  const emptyRankings = getCostEfficiencyRankings([]);
  assert(emptyRankings.mostEfficient.length === 0 && emptyRankings.leastEfficient.length === 0, 'Empty input produces empty rankings');

  const emptyChart = getCostComparisonChartData([]);
  assert(emptyChart.length === 0, 'Empty input produces 0 chart points (safe empty state)');

  // 5B: Only products with 0 finished periods (Olaplex only)
  const olaplexOnly = histories.filter((h) => h.product.name.includes('Olaplex'));
  const olaplexMonthly = calculateEstimatedMonthlyConsumption(olaplexOnly);
  assert(olaplexMonthly === null, 'Olaplex-only produces null monthly consumption');

  const olaplexChart = getCostComparisonChartData(olaplexOnly);
  assert(olaplexChart.length === 0, 'Olaplex-only produces 0 chart points');

  // 5C: Single eligible product (Sensodyne only)
  const sensodyneOnly = histories.filter((h) => h.product.name.includes('Sensodyne'));
  const singleChart = getCostComparisonChartData(sensodyneOnly);
  assert(singleChart.length === 1, 'Single-product produces 1 chart point safely');
  assert(!isNaN(singleChart[0].costPerDay) && isFinite(singleChart[0].costPerDay), 'Single chart point is finite and not NaN');

  // 5D: Multi-item sorting in Upcoming Purchases (overdue first, then near-term)
  const mockHistories: ProductWithHistory[] = [
    {
      product: { id: 'p1', user_id: 'u1', name: 'Future Near', category: 'Skincare', created_at: '' },
      purchases: [{ id: 'pu1', product_id: 'p1', purchase_date: '2026-08-01', price: 100, currency: 'BDT', created_at: '' }],
      usage_periods: [],
      active_usage: { id: 'u1', product_id: 'p1', purchase_id: 'pu1', opened_date: '2026-08-25', finished_date: null, status: 'active', created_at: '' },
      finished_periods: [
        { id: 'f1', product_id: 'p1', purchase_id: 'pu1', opened_date: '2026-07-01', finished_date: '2026-07-21', status: 'finished', created_at: '' }, // 20d
      ],
    },
    {
      product: { id: 'p2', user_id: 'u1', name: 'Very Overdue', category: 'Oral Care', created_at: '' },
      purchases: [{ id: 'pu2', product_id: 'p2', purchase_date: '2026-06-01', price: 200, currency: 'BDT', created_at: '' }],
      usage_periods: [],
      active_usage: { id: 'u2', product_id: 'p2', purchase_id: 'pu2', opened_date: '2026-06-01', finished_date: null, status: 'active', created_at: '' },
      finished_periods: [
        { id: 'f2', product_id: 'p2', purchase_id: 'pu2', opened_date: '2026-05-01', finished_date: '2026-05-31', status: 'finished', created_at: '' }, // 30d
      ],
    },
  ];

  const sortedUpcoming = getUpcomingPurchases(mockHistories, referenceDate);
  assert(sortedUpcoming.length === 2, 'Found 2 upcoming items in multi-sort test');
  assert(sortedUpcoming[0].product.name === 'Very Overdue', 'Overdue product sorted before future product');
  assert(sortedUpcoming[1].product.name === 'Future Near', 'Future product sorted second');

  // 5E: calculateEstimatedNextPrice safety
  const emptyPrice = calculateEstimatedNextPrice([]);
  assert(emptyPrice === 0, 'calculateEstimatedNextPrice returns 0 for empty purchases');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 6 ANALYTICS VERIFICATIONS PASSED SUCCESSFULLY');
  console.log('=================================================================');
}

runAnalyticsVerification().catch((err) => {
  console.error('Fatal error during analytics verification:', err);
  process.exit(1);
});
