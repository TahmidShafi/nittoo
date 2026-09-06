// ==============================================================================
// Nittoo Stage 7 End-to-End Application State Lifecycle Verification
// Pure Node-level verification of all data and domain state transitions:
// Auth → Dashboard → Add Product → Persist → Reload → History → Finish → Analytics → Logout → Login
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import { generateDeterministicMockUserId } from '../src/contexts/AuthContext';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculateCurrentDaysUsed,
  calculatePredictedRemainingDays,
  calculateCostPerDay,
} from '../src/lib/prediction';
import {
  getUpcomingPurchases,
  calculateEstimatedMonthlyConsumption,
  getCostEfficiencyRankings,
  getCostComparisonChartData,
} from '../src/lib/analytics';
import type { ProductWithHistory } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runFullWalkthroughVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 7 COMPLETE APPLICATION STATE WALKTHROUGH');
  console.log('=================================================================\n');

  // Use a shared in-memory storage adapter simulating browser localStorage across sessions
  const storageAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(storageAdapter);

  // ----------------------------------------------------------------------------
  // STEP 1: AUTHENTICATE AS A NEW USER
  // ----------------------------------------------------------------------------
  console.log('--- Step 1: User Authentication & Mock Session ---');
  const userEmail = 'new-user-walkthrough@nittoo.local';
  const userId = generateDeterministicMockUserId(userEmail);
  assert(Boolean(userId), `Generated deterministic user ID: ${userId}`);

  // Simulate storing session token
  storageAdapter.setItem('nittoo_auth_session', JSON.stringify({
    user: { id: userId, email: userEmail, created_at: new Date().toISOString() },
    token: 'mock-session-token',
  }));

  const sessionRaw = storageAdapter.getItem('nittoo_auth_session');
  assert(Boolean(sessionRaw), 'Session token persisted in storage adapter');
  const session = JSON.parse(sessionRaw!);
  assert(session.user.id === userId, 'Restored session user ID matches');
  assert(session.user.email === userEmail, 'Restored session user email matches');

  // ----------------------------------------------------------------------------
  // STEP 2: LOAD INITIAL DASHBOARD DATA (Empty State)
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 2: Load Initial Dashboard Data (Empty State) ---');
  const initialActive = await db.getActiveProducts(userId);
  assert(initialActive.length === 0, `New user starts with 0 active products (got: ${initialActive.length})`);

  const initialAllProducts = await db.getAllUserProducts(userId);
  assert(initialAllProducts.length === 0, `New user has 0 total products in portfolio`);

  // ----------------------------------------------------------------------------
  // STEP 3: CREATE ARBITRARY PRODUCT & PURCHASE & START USAGE
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 3: Add Essential Product (Buy -> Add -> Start Using) ---');
  const createdProduct = await db.createProduct(userId, {
    name: 'Bioderma Sensibio H2O Micellar Water',
    category: 'Skincare',
    brand: 'Bioderma',
    size_value: 500,
    size_unit: 'ml',
  });
  assert(Boolean(createdProduct.id), `Product created with ID: ${createdProduct.id}`);

  const createdPurchase = await db.createPurchase(userId, {
    product_id: createdProduct.id,
    purchase_date: '2026-07-01',
    price: 1650,
    currency: 'BDT',
  });
  assert(createdPurchase.price === 1650, `Purchase recorded at ৳1,650`);

  const createdUsage = await db.startUsagePeriod(userId, {
    product_id: createdProduct.id,
    purchase_id: createdPurchase.id,
    opened_date: '2026-07-01',
  });
  assert(createdUsage.status === 'active', 'Usage period started in active status');
  assert(createdUsage.finished_date === null, 'Active usage period has null finished_date');

  // ----------------------------------------------------------------------------
  // STEP 4: VERIFY REFRESH & PERSISTENCE
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 4: Verify Persistence Across Simulated Page Reload ---');
  // Instantiate fresh MockDatabase connected to the same storage adapter
  const reloadedDb = new MockDatabase(storageAdapter);

  const reloadedActive = await reloadedDb.getActiveProducts(userId);
  assert(reloadedActive.length === 1, `After reload, exactly 1 active product on dashboard`);
  assert(reloadedActive[0].name === 'Bioderma Sensibio H2O Micellar Water', 'Active product data persisted accurately');
  assert(reloadedActive[0].latest_purchase?.price === 1650, 'Latest purchase price persisted accurately');

  // ----------------------------------------------------------------------------
  // STEP 5: VIEW PRODUCT DETAIL BEFORE ANY FINISHED CYCLE
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 5: Product Detail Lifecycle (First Cycle / No History) ---');
  const initialHistory = await reloadedDb.getProductHistory(createdProduct.id, userId);
  assert(Boolean(initialHistory), 'Product history successfully retrieved');
  assert(initialHistory!.finished_periods.length === 0, 'Zero finished periods exist');
  assert(initialHistory!.active_usage !== null, 'Active bottle is in use');

  const initialLifespan = calculateAverageLifespan(initialHistory!.finished_periods);
  assert(initialLifespan === null, 'Average lifespan is strictly null ("Not enough data")');

  // ----------------------------------------------------------------------------
  // STEP 6: FINISH PRODUCT USAGE PERIOD
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 6: Mark Product Finished (Opened: Jul 1 -> Finished: Aug 20 = 50 days) ---');
  const finishDate = '2026-08-20';
  const finishedPeriod = await reloadedDb.finishUsagePeriod(userId, createdUsage.id, finishDate);
  assert(finishedPeriod.status === 'finished', 'Usage period status is now "finished"');
  assert(finishedPeriod.finished_date === finishDate, `Finished date recorded as ${finishDate}`);

  // Verify dashboard immediately reflects removal
  const activeAfterFinish = await reloadedDb.getActiveProducts(userId);
  assert(activeAfterFinish.length === 0, 'Finished product is immediately removed from active dashboard grid');

  // ----------------------------------------------------------------------------
  // STEP 7: VERIFY PRODUCT DETAIL & HISTORY UPDATED
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 7: Verify Historical Timeline & Average Metrics ---');
  const updatedHistory = await reloadedDb.getProductHistory(createdProduct.id, userId);
  assert(Boolean(updatedHistory), 'Updated history loaded');
  assert(updatedHistory!.active_usage === null, 'Product now has 0 active bottles');
  assert(updatedHistory!.finished_periods.length === 1, 'Product has exactly 1 finished usage period');

  const duration = calculateUsageDuration(updatedHistory!.finished_periods[0]);
  assert(duration === 50, `Completed cycle duration is exactly 50 days (got: ${duration})`);

  const averageLifespan = calculateAverageLifespan(updatedHistory!.finished_periods);
  assert(averageLifespan === 50, `Average historical lifespan is 50 days (got: ${averageLifespan})`);

  const costPerDay = calculateCostPerDay(1650, averageLifespan);
  assert(costPerDay === 33.00, `Cost per day is ৳33.00 (1650 / 50 = 33)`);

  // ----------------------------------------------------------------------------
  // STEP 8: REPEAT PURCHASE & ANALYTICS VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 8: Log Repeat Purchase & Verify Analytics ---');
  const repeatPurchase = await reloadedDb.createPurchase(userId, {
    product_id: createdProduct.id,
    purchase_date: '2026-08-21',
    price: 1700,
    currency: 'BDT',
  });
  const repeatUsage = await reloadedDb.startUsagePeriod(userId, {
    product_id: createdProduct.id,
    purchase_id: repeatPurchase.id,
    opened_date: '2026-08-21',
  });
  assert(repeatUsage.status === 'active', 'Bottle #2 is now active');

  const fullHistoryWithBottle2 = await reloadedDb.getProductHistory(createdProduct.id, userId);
  assert(fullHistoryWithBottle2!.purchases.length === 2, '2 total purchases recorded');
  assert(fullHistoryWithBottle2!.finished_periods.length === 1, '1 finished period retained');
  assert(fullHistoryWithBottle2!.active_usage !== null, 'Active bottle #2 present');

  // Test Analytics
  const refDate = '2026-08-25'; // 4 days used, 50 - 4 = 46 days remaining (> 30 days)
  const upcomingEarly = getUpcomingPurchases([fullHistoryWithBottle2!], refDate);
  assert(upcomingEarly.length === 0, 'No upcoming purchases at 46 days remaining (> 30 days)');

  const refDateNear = '2026-10-05'; // 45 days used, 50 - 45 = 5 days remaining (<= 30 days)
  const upcomingNear = getUpcomingPurchases([fullHistoryWithBottle2!], refDateNear);
  assert(upcomingNear.length === 1, 'Product appears in upcoming purchases when remaining <= 30 days');
  assert(upcomingNear[0].predictedRemainingDays === 5, 'Upcoming product shows 5 days remaining');
  assert(upcomingNear[0].predictedFinishDate === '2026-10-10', 'Predicted finish date is 2026-10-10');
  assert(upcomingNear[0].estimatedNextPrice === 1675, 'Estimated next purchase is average historical price ৳1,675 ((1650+1700)/2)');

  // Monthly consumption: 1700 / 50 * 30 = 1020
  const monthlyCost = calculateEstimatedMonthlyConsumption([fullHistoryWithBottle2!]);
  assert(monthlyCost === 1020, `Monthly consumption run rate is ৳1,020 (got: ৳${monthlyCost})`);

  // Chart data
  const chartData = getCostComparisonChartData([fullHistoryWithBottle2!]);
  assert(chartData.length === 1, 'Chart contains exactly 1 data point');
  assert(chartData[0].costPerDay === 34, `Chart cost per day is ৳34/day (1700 / 50)`);

  // ----------------------------------------------------------------------------
  // STEP 9: SIGN OUT & SIGN IN AGAIN
  // ----------------------------------------------------------------------------
  console.log('\n--- Step 9: Sign Out & Re-Authentication ---');
  storageAdapter.removeItem('nittoo_auth_session');
  assert(storageAdapter.getItem('nittoo_auth_session') === null, 'Auth session cleared upon logout');

  // Sign back in as the user
  storageAdapter.setItem('nittoo_auth_session', JSON.stringify({
    user: { id: userId, email: userEmail, created_at: new Date().toISOString() },
    token: 'mock-session-token-2',
  }));

  const sessionRestored = JSON.parse(storageAdapter.getItem('nittoo_auth_session')!);
  assert(sessionRestored.user.id === userId, 'Re-authenticated with same user ID');

  const activeAfterReauth = await reloadedDb.getActiveProducts(userId);
  assert(activeAfterReauth.length === 1, 'User data is completely preserved after re-authentication');
  assert(activeAfterReauth[0].id === createdProduct.id, 'User product verified after re-authentication');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 7 END-TO-END APPLICATION STATE VERIFICATIONS PASSED');
  console.log('=================================================================');
}

runFullWalkthroughVerification().catch((err) => {
  console.error('Fatal error during walkthrough verification:', err);
  process.exit(1);
});
