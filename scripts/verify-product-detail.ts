// ==============================================================================
// Nittoo Stage 5 Automated Verification Script: Product Detail & History
// Tests Zero/One/Multiple Finished Cycles, Weighted Cost/Day, Active vs Finished Separation, and Chart Safety
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculateCurrentDaysUsed,
  calculatePricePerUnit,
} from '../src/lib/prediction';
import { formatDisplayDate } from '../src/lib/dateUtils';
import type { ProductWithHistory } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

/**
 * Pure calculation logic matching ProductDetailPage for weighted cost per day and chart transformation
 */
function computeProductDetailStats(history: ProductWithHistory) {
  const { product, purchases, finished_periods } = history;

  const averageDuration = calculateAverageLifespan(finished_periods);

  let totalCompletedPrice = 0;
  let totalCompletedDays = 0;

  for (const fp of finished_periods) {
    const duration = calculateUsageDuration(fp);
    if (duration !== null && duration > 0) {
      const linkedPurchase = purchases.find((pu) => pu.id === fp.purchase_id);
      if (linkedPurchase) {
        totalCompletedPrice += linkedPurchase.price;
        totalCompletedDays += duration;
      }
    }
  }

  const weightedCostPerDay =
    totalCompletedDays > 0
      ? Math.round((totalCompletedPrice / totalCompletedDays) * 100) / 100
      : null;

  const totalSpent = purchases.reduce((sum, p) => sum + p.price, 0);
  const purchaseCount = purchases.length;

  const latestPurchase = purchases[0] || null;
  const unitRate =
    latestPurchase && product.size_value
      ? calculatePricePerUnit(latestPurchase.price, product.size_value)
      : null;

  const chartData = [...finished_periods]
    .sort((a, b) => (a.finished_date || '').localeCompare(b.finished_date || ''))
    .map((fp, index) => {
      const duration = calculateUsageDuration(fp) ?? 0;
      return {
        cycle: `Cycle ${index + 1}`,
        finishedDate: formatDisplayDate(fp.finished_date || ''),
        duration,
      };
    });

  return {
    averageDuration,
    weightedCostPerDay,
    totalSpent,
    purchaseCount,
    unitRate,
    chartData,
  };
}

async function runProductDetailVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 5 PRODUCT DETAIL & HISTORY VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  // ----------------------------------------------------------------------------
  // 1. ZERO FINISHED PERIODS (Olaplex No. 4 Shampoo)
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying Product with 0 Finished Periods (Olaplex) ---');
  const olaplexHistory = await db.getProductHistory('prod-olaplex-shampoo', DEFAULT_MOCK_USER_ID);
  assert(olaplexHistory !== null, 'Olaplex history loaded');
  assert(olaplexHistory!.finished_periods.length === 0, 'Olaplex has exactly 0 finished periods');
  assert(olaplexHistory!.active_usage !== null, 'Olaplex has 1 active usage period');

  const olaplexStats = computeProductDetailStats(olaplexHistory!);
  assert(olaplexStats.averageDuration === null, 'Average duration is null ("Not enough data")');
  assert(olaplexStats.weightedCostPerDay === null, 'Average cost/day is null ("Not enough data")');
  assert(olaplexStats.totalSpent === 3200, 'Total spent is 3200 BDT (single purchase)');
  assert(olaplexStats.purchaseCount === 1, 'Purchase count is 1');
  assert(olaplexStats.unitRate === 12.8, 'Unit rate is ৳12.80 / ml');
  assert(olaplexStats.chartData.length === 0, 'Chart dataset is empty (renders empty state)');

  // ----------------------------------------------------------------------------
  // 2. ONE FINISHED PERIOD (Sensodyne Rapid Relief Toothpaste)
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Verifying Product with 1 Finished Period (Sensodyne) ---');
  const sensodyneHistory = await db.getProductHistory('prod-sensodyne-toothpaste', DEFAULT_MOCK_USER_ID);
  assert(sensodyneHistory !== null, 'Sensodyne history loaded');
  assert(sensodyneHistory!.finished_periods.length === 1, 'Sensodyne has exactly 1 finished period');
  assert(sensodyneHistory!.active_usage !== null, 'Sensodyne has 1 active usage period separate from finished');

  const sensodyneStats = computeProductDetailStats(sensodyneHistory!);
  assert(sensodyneStats.averageDuration === 45, 'Average duration is exactly 45 days');
  // 1 purchase cycle finished: 480 BDT / 45 days = 10.67 BDT/day
  assert(sensodyneStats.weightedCostPerDay === 10.67, `Weighted cost/day is ৳10.67 (got: ${sensodyneStats.weightedCostPerDay})`);
  assert(sensodyneStats.totalSpent === 960, 'Total spent across 2 purchases is 960 BDT');
  assert(sensodyneStats.purchaseCount === 2, 'Purchase count is 2');
  assert(sensodyneStats.chartData.length === 1, 'Chart dataset contains exactly 1 data point');
  assert(sensodyneStats.chartData[0].duration === 45, 'Chart point duration is 45 days');

  // ----------------------------------------------------------------------------
  // 3. MULTIPLE FINISHED PERIODS (CeraVe Hydrating Cleanser)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Verifying Product with Multiple Finished Periods (CeraVe) ---');
  const ceraveHistory = await db.getProductHistory('prod-cerave-cleanser', DEFAULT_MOCK_USER_ID);
  assert(ceraveHistory !== null, 'CeraVe history loaded');
  assert(ceraveHistory!.finished_periods.length === 2, 'CeraVe has 2 finished periods');
  assert(ceraveHistory!.active_usage !== null, 'CeraVe has 1 active usage period');

  const ceraveStats = computeProductDetailStats(ceraveHistory!);
  assert(ceraveStats.averageDuration === 62, 'Average duration is 62 days ((61 + 63) / 2)');

  // Weighted cost/day: (1250 + 1250) / (61 + 63) = 2500 / 124 = 20.16
  assert(ceraveStats.weightedCostPerDay === 20.16, `Weighted cost/day matches ৳20.16 (got: ${ceraveStats.weightedCostPerDay})`);

  // Total spent includes active bottle purchase: 1250 * 3 = 3750
  assert(ceraveStats.totalSpent === 3750, 'Total spent includes all 3 purchases (3750 BDT)');
  assert(ceraveStats.purchaseCount === 3, 'Purchase count is 3');

  // Chart data
  assert(ceraveStats.chartData.length === 2, 'Chart dataset contains 2 data points');
  assert(ceraveStats.chartData[0].duration === 61, 'Cycle 1 duration is 61 days');
  assert(ceraveStats.chartData[1].duration === 63, 'Cycle 2 duration is 63 days');

  // Chronological ordering check
  assert(
    ceraveStats.chartData[0].finishedDate.includes('Jun 26') &&
    ceraveStats.chartData[1].finishedDate.includes('Aug 29'),
    'Chart data is ordered chronologically by finish date'
  );

  // ----------------------------------------------------------------------------
  // 4. ACTIVE VS FINISHED SEPARATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Active vs Finished Period Separation ---');
  const activeCycle = ceraveHistory!.active_usage!;
  assert(activeCycle.status === 'active', 'Active bottle is in active status');
  assert(activeCycle.finished_date === null, 'Active bottle has null finished_date');

  // Confirm active bottle is NOT included in finished_periods
  assert(
    !ceraveHistory!.finished_periods.some((p) => p.id === activeCycle.id),
    'Active usage period is strictly excluded from finished_periods list'
  );

  // Confirm active days used is calculated separately
  const activeDaysUsed = calculateCurrentDaysUsed(activeCycle.opened_date, '2026-09-06');
  assert(activeDaysUsed === 7, `Active days used as of Sep 6 is 7 days (got: ${activeDaysUsed})`);

  // ----------------------------------------------------------------------------
  // 5. CHART SAFETY (No NaN, No Infinity, Stable Domains)
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying Chart Safety & Domain Calculations ---');

  // Test with 0 data points
  const emptyDomain = (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.15));
  assert(emptyDomain(0) === 10, 'Empty dataMax returns stable baseline domain [0, 10]');
  assert(!isNaN(emptyDomain(0)), 'Domain calculation produces no NaN');

  // Test with 1 data point (duration = 45)
  assert(emptyDomain(45) === 52, 'Single data point (45) returns stable domain [0, 52]');

  // Test with division by zero safety in weighted cost
  const zeroDayHistory: ProductWithHistory = {
    product: {
      id: 'prod-zero',
      user_id: 'test',
      name: 'Zero Day Item',
      category: 'Household',
      created_at: '2026-01-01',
    },
    purchases: [{ id: 'pur-zero', product_id: 'prod-zero', purchase_date: '2026-01-01', price: 500, currency: 'BDT', created_at: '2026-01-01' }],
    usage_periods: [],
    active_usage: null,
    finished_periods: [],
  };

  const zeroStats = computeProductDetailStats(zeroDayHistory);
  assert(zeroStats.weightedCostPerDay === null, 'Zero days returns null cost/day (no division by zero or NaN)');
  assert(zeroStats.averageDuration === null, 'Zero finished periods returns null average duration');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 5 PRODUCT DETAIL VERIFICATION CHECKS PASSED!');
  console.log('=================================================================');
}

runProductDetailVerification().catch((err) => {
  console.error('Unexpected failure during Stage 5 verification:', err);
  process.exit(1);
});
