// ==============================================================================
// Nittoo Stage 1 Automated Verification Script
// Tests Multi-User Isolation, Full Lifecycle, Constraints, Seed Data, and Predictions
// Uses InMemoryStorageAdapter to avoid any dependency on browser localStorage
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
} from '../src/lib/mock-db';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculatePredictedRemainingDays,
  calculateCostPerDay,
  calculatePricePerUnit,
  calculateProgressPercent,
  calculateMonthlyConsumptionCost,
} from '../src/lib/prediction';
import { getDaysBetween } from '../src/lib/dateUtils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function assertRejects(promise: Promise<unknown>, expectedSubstring: string, testName: string) {
  try {
    await promise;
    console.error(`❌ ASSERTION FAILED: Expected rejection for "${testName}", but it succeeded.`);
    process.exit(1);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes(expectedSubstring)) {
      console.log(`  ✓ Correctly rejected: ${testName} (${error.message})`);
    } else {
      console.error(`❌ ASSERTION FAILED for "${testName}": Expected error containing "${expectedSubstring}", got "${error.message}"`);
      process.exit(1);
    }
  }
}

async function runVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 1 DATA LAYER VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  // ----------------------------------------------------------------------------
  // 1. SEED DATA VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying Default Seed Data & Prediction Logic ---');
  const seedProducts = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  assert(seedProducts.length === 3, 'Default mock user has exactly 3 seeded products');

  // CeraVe Cleanser
  const ceraveHistory = await db.getProductHistory('prod-cerave-cleanser', DEFAULT_MOCK_USER_ID);
  assert(ceraveHistory !== null, 'CeraVe product history is retrievable');
  assert(ceraveHistory!.finished_periods.length === 2, 'CeraVe has 2 finished periods');
  assert(ceraveHistory!.active_usage !== null, 'CeraVe has 1 active usage period');

  const period1Duration = calculateUsageDuration(ceraveHistory!.finished_periods[0]);
  const period2Duration = calculateUsageDuration(ceraveHistory!.finished_periods[1]);
  assert(period1Duration === 61 || period1Duration === 63, `CeraVe finished period duration is valid (${period1Duration}d)`);
  assert(period2Duration === 61 || period2Duration === 63, `CeraVe finished period duration is valid (${period2Duration}d)`);

  const ceraveAvgLifespan = calculateAverageLifespan(ceraveHistory!.usage_periods);
  assert(ceraveAvgLifespan === 62, `CeraVe average lifespan strictly calculates to 62 days (got: ${ceraveAvgLifespan})`);

  // Olaplex Shampoo (Zero finished periods -> "Not enough data")
  const olaplexHistory = await db.getProductHistory('prod-olaplex-shampoo', DEFAULT_MOCK_USER_ID);
  assert(olaplexHistory !== null, 'Olaplex product history is retrievable');
  assert(olaplexHistory!.finished_periods.length === 0, 'Olaplex has 0 finished periods');
  assert(olaplexHistory!.active_usage !== null, 'Olaplex has 1 active usage period');

  const olaplexAvgLifespan = calculateAverageLifespan(olaplexHistory!.usage_periods);
  assert(olaplexAvgLifespan === null, 'Olaplex average lifespan returns null ("Not enough data") with 0 finished periods');

  const olaplexCostPerDay = calculateCostPerDay(3200, olaplexAvgLifespan);
  assert(olaplexCostPerDay === null, 'Olaplex cost per day returns null ("Not enough data")');

  const olaplexUnitPrice = calculatePricePerUnit(3200, olaplexHistory!.product.size_value);
  assert(olaplexUnitPrice === 12.8, `Olaplex price per unit correctly calculates to 12.8 BDT/ml (got: ${olaplexUnitPrice})`);

  // Sensodyne Toothpaste
  const sensodyneHistory = await db.getProductHistory('prod-sensodyne-toothpaste', DEFAULT_MOCK_USER_ID);
  assert(sensodyneHistory !== null, 'Sensodyne product history is retrievable');
  assert(sensodyneHistory!.finished_periods.length === 1, 'Sensodyne has 1 finished period');
  assert(sensodyneHistory!.active_usage !== null, 'Sensodyne has 1 active usage period');

  const sensodyneAvgLifespan = calculateAverageLifespan(sensodyneHistory!.usage_periods);
  assert(sensodyneAvgLifespan === 45, `Sensodyne average lifespan calculates to 45 days (got: ${sensodyneAvgLifespan})`);

  console.log('\n--- 2. Verifying Complete Product Lifecycle ---');
  const userA = 'user-test-alice';

  // Create Product
  const productA = await db.createProduct(userA, {
    name: 'Laneige Lip Sleeping Mask',
    category: 'Skincare',
    brand: 'Laneige',
    size_value: 20,
    size_unit: 'g',
  });
  assert(productA.id.startsWith('prod-'), `Product created with ID: ${productA.id}`);
  assert(productA.user_id === userA, 'Product assigned to User A');

  // Create Purchase
  const purchaseA = await db.createPurchase(userA, {
    product_id: productA.id,
    purchase_date: '2026-09-01',
    price: 1800,
    currency: 'BDT',
  });
  assert(purchaseA.id.startsWith('pur-'), `Purchase created with ID: ${purchaseA.id}`);
  assert(purchaseA.price === 1800, 'Purchase price is 1800 BDT');

  // Start Usage Period
  const usageA = await db.startUsagePeriod(userA, {
    product_id: productA.id,
    purchase_id: purchaseA.id,
    opened_date: '2026-09-01',
  });
  assert(usageA.status === 'active', 'Usage period started in active status');
  assert(usageA.finished_date === null, 'Active usage period has null finished_date');

  // Check Active Products
  const activeProductsA = await db.getActiveProducts(userA);
  assert(activeProductsA.length === 1, 'User A has 1 active product on dashboard');
  assert(activeProductsA[0].id === productA.id, 'User A active product matches Laneige');

  // Finish Usage Period
  const finishedUsageA = await db.finishUsagePeriod(userA, usageA.id, '2026-09-21');
  assert(finishedUsageA.status === 'finished', 'Usage period status changed to finished');
  assert(finishedUsageA.finished_date === '2026-09-21', 'Usage period finished_date updated to 2026-09-21');

  // Check Active Products after finishing
  const activeAfterFinish = await db.getActiveProducts(userA);
  assert(activeAfterFinish.length === 0, 'User A has 0 active products on dashboard after finishing bottle');

  // Check History
  const historyA = await db.getProductHistory(productA.id, userA);
  assert(historyA !== null, 'Product history retrieved for User A');
  assert(historyA!.finished_periods.length === 1, 'Product has 1 completed period');
  assert(historyA!.active_usage === null, 'Product has no active usage');
  const durationA = calculateUsageDuration(historyA!.finished_periods[0]);
  assert(durationA === 20, `Finished period duration is 20 days (got: ${durationA})`);

  console.log('\n--- 3. Verifying Single Active Usage Constraint ---');
  // Start another bottle
  const purchaseA2 = await db.createPurchase(userA, {
    product_id: productA.id,
    purchase_date: '2026-09-22',
    price: 1800,
  });
  const usageA2 = await db.startUsagePeriod(userA, {
    product_id: productA.id,
    purchase_id: purchaseA2.id,
    opened_date: '2026-09-22',
  });
  assert(usageA2.status === 'active', 'Started new bottle for Laneige');

  // Attempt to start a second concurrent active period on the same product
  await assertRejects(
    db.startUsagePeriod(userA, {
      product_id: productA.id,
      purchase_id: purchaseA2.id,
      opened_date: '2026-09-23',
    }),
    'already has an active usage period',
    'Cannot start second active usage period on same product'
  );

  console.log('\n--- 4. Verifying Multi-User Isolation & Ownership Enforcement ---');
  const userB = 'user-test-bob';

  // User B cannot see User A's products
  const productsB = await db.getAllUserProducts(userB);
  assert(productsB.length === 0, 'User B sees 0 products initially (isolated from User A)');

  const activeB = await db.getActiveProducts(userB);
  assert(activeB.length === 0, 'User B sees 0 active products (isolated from User A)');

  // User B cannot view User A's product history
  await assertRejects(
    db.getProductHistory(productA.id, userB),
    'Unauthorized',
    'User B cannot read User A product history'
  );

  // User B cannot create a purchase on User A's product
  await assertRejects(
    db.createPurchase(userB, {
      product_id: productA.id,
      purchase_date: '2026-09-23',
      price: 1500,
    }),
    'Unauthorized',
    'User B cannot create purchase for User A product'
  );

  // User B cannot start usage period on User A's product
  await assertRejects(
    db.startUsagePeriod(userB, {
      product_id: productA.id,
      purchase_id: purchaseA2.id,
      opened_date: '2026-09-23',
    }),
    'Unauthorized',
    'User B cannot start usage on User A product'
  );

  // User B cannot finish User A's usage period
  await assertRejects(
    db.finishUsagePeriod(userB, usageA2.id, '2026-10-01'),
    'Unauthorized',
    'User B cannot finish User A usage period'
  );

  console.log('\n--- 5. Verifying Date and Prediction Math Utilities ---');
  assert(getDaysBetween('2026-01-01', '2026-01-10') === 9, 'getDaysBetween correctly computes 9 days');
  assert(getDaysBetween('2026-01-10', '2026-01-01') === -9, 'getDaysBetween computes negative for inverted dates');

  // Math edge cases
  assert(calculateCostPerDay(1000, 0) === null, 'calculateCostPerDay guards against 0 lifespan');
  assert(calculateCostPerDay(1000, null) === null, 'calculateCostPerDay returns null for null lifespan');
  assert(calculatePricePerUnit(500, 0) === null, 'calculatePricePerUnit guards against 0 size');
  assert(calculateProgressPercent(30, 60) === 50, 'calculateProgressPercent returns 50% for 30/60');
  assert(calculateProgressPercent(70, 60) === 100, 'calculateProgressPercent clamps to 100%');
  assert(calculatePredictedRemainingDays(60, 25) === 35, 'calculatePredictedRemainingDays computes 35 days remaining');
  assert(calculatePredictedRemainingDays(null, 25) === null, 'calculatePredictedRemainingDays returns null when no avg lifespan');
  assert(calculateMonthlyConsumptionCost(1250, 62) === Math.round((1250 / 62) * 30), 'calculateMonthlyConsumptionCost computes estimated monthly spend');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=================================================================');
}

runVerification().catch((err) => {
  console.error('Unexpected failure during verification:', err);
  process.exit(1);
});
