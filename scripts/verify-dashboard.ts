// ==============================================================================
// Nittoo Stage 4 Automated Verification Script: Dashboard
// Tests Prediction Guards, Seed Prediction Math, Urgency Sorting, Finish Flow, and Division Safety
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import { getPredictionMetrics } from '../src/hooks/usePrediction';
import { sortActiveProducts } from '../src/pages/DashboardPage';
import {
  calculateAverageLifespan,
  calculateCostPerDay,
  calculatePricePerUnit,
  calculateProgressPercent,
  calculateMonthlyConsumptionCost,
} from '../src/lib/prediction';
import type { ProductWithDetails } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runDashboardVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 4 DASHBOARD & PREDICTION VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  // ----------------------------------------------------------------------------
  // 1. PREDICTION GUARDS (Zero Finished Periods)
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying Prediction Guards for 0 Finished Periods ---');
  const activeProducts = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);

  const olaplex = activeProducts.find((p) => p.name.includes('Olaplex'))!;
  assert(Boolean(olaplex), 'Found Olaplex in active products');

  const olaplexMetrics = getPredictionMetrics(olaplex, '2026-09-06');
  assert(olaplexMetrics.averageLifespan === null, 'Olaplex averageLifespan === null');
  assert(olaplexMetrics.predictedRemainingDays === null, 'Olaplex predictedRemainingDays === null');
  assert(olaplexMetrics.costPerDay === null, 'Olaplex costPerDay === null ("Not enough data")');
  assert(olaplexMetrics.progressPercent === null, 'Olaplex progressPercent === null (no misleading percentage)');
  assert(olaplexMetrics.hasEnoughData === false, 'Olaplex hasEnoughData is false');
  assert(olaplexMetrics.urgencyState === 'no_prediction', 'Olaplex urgencyState is "no_prediction"');
  assert(olaplexMetrics.pricePerUnit === 12.8, `Olaplex pricePerUnit exists separately (got: ৳${olaplexMetrics.pricePerUnit}/ml)`);

  // ----------------------------------------------------------------------------
  // 2. PREDICTION MATH AGAINST KNOWN SEED DATA (Reference: 2026-09-06)
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Verifying Prediction Math on Seed Data (as of Sep 6, 2026) ---');
  const referenceDate = '2026-09-06';

  // CeraVe Hydrating Cleanser
  const cerave = activeProducts.find((p) => p.name.includes('CeraVe'))!;
  assert(Boolean(cerave), 'Found CeraVe in active products');
  const ceraveMetrics = getPredictionMetrics(cerave, referenceDate);

  assert(ceraveMetrics.averageLifespan === 62, `CeraVe average lifespan is 62 days (got: ${ceraveMetrics.averageLifespan})`);
  assert(ceraveMetrics.daysUsed === 7, `CeraVe days used on Sep 6 (opened Aug 30) is 7 days (got: ${ceraveMetrics.daysUsed})`);
  assert(ceraveMetrics.predictedRemainingDays === 55, `CeraVe predicted remaining days is 55 (got: ${ceraveMetrics.predictedRemainingDays})`);
  assert(ceraveMetrics.isOverdue === false, 'CeraVe is not overdue');
  assert(ceraveMetrics.urgencyState === 'running_soon', 'CeraVe urgencyState is "running_soon"');
  assert(ceraveMetrics.costPerDay === 20.16, `CeraVe cost per day is ৳20.16 (got: ${ceraveMetrics.costPerDay})`);

  // Sensodyne Rapid Relief Toothpaste
  const sensodyne = activeProducts.find((p) => p.name.includes('Sensodyne'))!;
  assert(Boolean(sensodyne), 'Found Sensodyne in active products');
  const sensodyneMetrics = getPredictionMetrics(sensodyne, referenceDate);

  assert(sensodyneMetrics.averageLifespan === 45, `Sensodyne average lifespan is 45 days (got: ${sensodyneMetrics.averageLifespan})`);
  assert(sensodyneMetrics.daysUsed === 51, `Sensodyne days used on Sep 6 (opened Jul 17) is 51 days (got: ${sensodyneMetrics.daysUsed})`);
  assert(sensodyneMetrics.predictedRemainingDays === -6, `Sensodyne predicted remaining days is -6 (got: ${sensodyneMetrics.predictedRemainingDays})`);
  assert(sensodyneMetrics.isOverdue === true, 'Sensodyne is correctly flagged as overdue');
  assert(sensodyneMetrics.overdueDays === 6, 'Sensodyne overdueDays is 6');
  assert(sensodyneMetrics.urgencyState === 'overdue', 'Sensodyne urgencyState is "overdue"');
  assert(sensodyneMetrics.urgencyLabel === 'Overdue by 6 days', `Sensodyne label is "Overdue by 6 days" (got: "${sensodyneMetrics.urgencyLabel}")`);

  // ----------------------------------------------------------------------------
  // 3. DASHBOARD URGENCY SORTING
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Verifying Three-Tier Urgency Sorting Order ---');

  // Let's create dummy items to test full sorting order:
  // 1. Most overdue (-10)
  // 2. Less overdue (-6)
  // 3. Soonest future run-out (2 days left)
  // 4. Later future run-out (55 days left)
  // 5. No prediction (null)
  const itemMostOverdue: ProductWithDetails = {
    id: 'item-most-overdue',
    user_id: 'test',
    name: 'Item Most Overdue',
    category: 'Skincare',
    created_at: '2026-01-01',
    active_usage: {
      id: 'use-1',
      product_id: 'item-most-overdue',
      purchase_id: 'pur-1',
      opened_date: '2026-08-01',
      status: 'active',
      created_at: '2026-08-01',
    },
    // avg lifespan 26d, daysUsed as of Sep 6 (36d) -> remaining = 26 - 36 = -10
    finished_periods: [
      {
        id: 'fin-1',
        product_id: 'item-most-overdue',
        purchase_id: 'pur-0',
        opened_date: '2026-07-01',
        finished_date: '2026-07-27', // 26 days
        status: 'finished',
        created_at: '2026-07-01',
      },
    ],
  };

  const itemSoonRunOut: ProductWithDetails = {
    id: 'item-soon-runout',
    user_id: 'test',
    name: 'Item Soon Runout',
    category: 'Oral Care',
    created_at: '2026-01-01',
    active_usage: {
      id: 'use-2',
      product_id: 'item-soon-runout',
      purchase_id: 'pur-2',
      opened_date: '2026-08-27',
      status: 'active',
      created_at: '2026-08-27',
    },
    // avg lifespan 12d, daysUsed as of Sep 6 (10d) -> remaining = 12 - 10 = 2 days left
    finished_periods: [
      {
        id: 'fin-2',
        product_id: 'item-soon-runout',
        purchase_id: 'pur-02',
        opened_date: '2026-08-01',
        finished_date: '2026-08-13', // 12 days
        status: 'finished',
        created_at: '2026-08-01',
      },
    ],
  };

  const testList: ProductWithDetails[] = [
    cerave, // remaining 55
    olaplex, // no prediction
    sensodyne, // remaining -6 (overdue)
    itemSoonRunOut, // remaining 2
    itemMostOverdue, // remaining -10 (most overdue)
  ];

  const sorted = sortActiveProducts(testList, referenceDate);
  const sortedIds = sorted.map((p) => p.id);

  assert(sortedIds[0] === itemMostOverdue.id, '1st place: Most overdue product (Item Most Overdue, -10d)');
  assert(sortedIds[1] === sensodyne.id, '2nd place: Less overdue product (Sensodyne, -6d)');
  assert(sortedIds[2] === itemSoonRunOut.id, '3rd place: Soonest future run-out (Item Soon Runout, 2d left)');
  assert(sortedIds[3] === cerave.id, '4th place: Later future run-out (CeraVe, 55d left)');
  assert(sortedIds[4] === olaplex.id, '5th place: No prediction placed last (Olaplex)');

  // ----------------------------------------------------------------------------
  // 4. FINISH USAGE FLOW
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Finish Usage Flow ---');
  const sensodyneActiveId = sensodyne.active_usage!.id;

  // Mark Sensodyne as finished on Sep 6, 2026
  await db.finishUsagePeriod(DEFAULT_MOCK_USER_ID, sensodyneActiveId, referenceDate);

  // Check active products
  const activeAfterFinish = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);
  assert(activeAfterFinish.length === 2, 'Active products decreased from 3 to 2');
  assert(!activeAfterFinish.some((p) => p.id === sensodyne.id), 'Finished product immediately removed from active dashboard');

  // Verify product history still retains all records
  const sensodyneHistory = await db.getProductHistory(sensodyne.id, DEFAULT_MOCK_USER_ID);
  assert(sensodyneHistory !== null, 'Sensodyne history remains retrievable');
  assert(sensodyneHistory!.active_usage === null, 'Sensodyne has 0 active usage periods now');
  assert(sensodyneHistory!.finished_periods.length === 2, 'Sensodyne now has 2 completed historical lifespans');

  // ----------------------------------------------------------------------------
  // 5. DIVISION SAFETY & EDGE CASES
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying Division Safety & Edge Cases ---');

  assert(calculateCostPerDay(1000, 0) === null, 'calculateCostPerDay returns null for 0 lifespan (no division by zero)');
  assert(calculateCostPerDay(1000, -5) === null, 'calculateCostPerDay returns null for negative lifespan');
  assert(calculatePricePerUnit(1000, 0) === null, 'calculatePricePerUnit returns null for 0 size (no division by zero)');
  assert(calculatePricePerUnit(1000, null) === null, 'calculatePricePerUnit returns null for null size');
  assert(calculateProgressPercent(10, 0) === null, 'calculateProgressPercent returns null for 0 lifespan');
  assert(calculateProgressPercent(10, null) === null, 'calculateProgressPercent returns null for null lifespan');
  assert(calculateAverageLifespan([]) === null, 'calculateAverageLifespan returns null for empty array');
  assert(calculateMonthlyConsumptionCost(1000, 0) === null, 'calculateMonthlyConsumptionCost returns null for 0 lifespan');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 4 DASHBOARD VERIFICATION CHECKS PASSED!');
  console.log('=================================================================');
}

runDashboardVerification().catch((err) => {
  console.error('Unexpected failure during Stage 4 dashboard verification:', err);
  process.exit(1);
});
