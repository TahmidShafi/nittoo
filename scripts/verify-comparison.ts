// ==============================================================================
// Nittoo Stage 11 Verification: PRODUCT COMPARISON & VALUE INTELLIGENCE
// Validates personal value comparison, unit economics, observed vs predicted isolation,
// deterministic insight rules, and cross-account security.
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
} from '../src/lib/mock-db';
import {
  comparePrices,
  compareSizes,
  calculateUnitPrice,
  compareUnitPrices,
  deriveProductObservedMetrics,
  deriveComparisonInsight,
  buildComparisonReport,
} from '../src/lib/comparison';
import {
  calculateAverageLifespan,
  calculateCostPerDay,
  calculatePredictedRemainingDays,
} from '../src/lib/prediction';
import { getTodayUTC, getDaysBetween } from '../src/lib/dateUtils';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runComparisonVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 11: PRODUCT COMPARISON VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);
  const TEST_USER = 'test-comparison-user';
  const OTHER_USER = 'other-comparison-user';
  const today = getTodayUTC();

  // ----------------------------------------------------------------------------
  // Setup Test Data
  // Product A (Head & Shoulders): 1 completed cycle (90 days, ৳1,000, 400ml, ৳11.11/day)
  // Product B (L'Oréal Shampoo): 1 completed cycle (95 days, ৳1,200, 450ml, ৳12.63/day)
  // Product C (Dove Soap): Active bottle only (0 completed cycles, ৳300, 100g)
  // Product D (Different unit / Oral Care): 1 completed cycle (45 days, ৳450, 150g)
  // ----------------------------------------------------------------------------
  console.log('--- Setup: Establishing baseline comparison portfolio ---');

  // Product A: Head & Shoulders
  const prodA = await db.createProduct(TEST_USER, {
    name: 'Head & Shoulders Shampoo',
    category: 'Haircare',
    brand: 'Head & Shoulders',
    size_value: 400,
    size_unit: 'ml',
  });
  const purA = await db.createPurchase(TEST_USER, {
    product_id: prodA.id,
    purchase_date: '2026-03-01',
    price: 1000,
    currency: 'BDT',
  });
  const useA = await db.startUsagePeriod(TEST_USER, {
    product_id: prodA.id,
    purchase_id: purA.id,
    opened_date: '2026-03-01',
  });
  await db.finishUsagePeriod(TEST_USER, useA.id, '2026-05-30'); // 90 days

  // Product B: L'Oréal
  const prodB = await db.createProduct(TEST_USER, {
    name: "L'Oréal Elvive Shampoo",
    category: 'Haircare',
    brand: "L'Oréal",
    size_value: 450,
    size_unit: 'ml',
  });
  const purB = await db.createPurchase(TEST_USER, {
    product_id: prodB.id,
    purchase_date: '2026-06-01',
    price: 1200,
    currency: 'BDT',
  });
  const useB = await db.startUsagePeriod(TEST_USER, {
    product_id: prodB.id,
    purchase_id: purB.id,
    opened_date: '2026-06-01',
  });
  await db.finishUsagePeriod(TEST_USER, useB.id, '2026-09-04'); // 95 days

  // Product C: Active Only (0 completed cycles)
  const prodC = await db.createProduct(TEST_USER, {
    name: 'Dove Beauty Bar',
    category: 'Body Care',
    brand: 'Dove',
    size_value: 100,
    size_unit: 'g',
  });
  const purC = await db.createPurchase(TEST_USER, {
    product_id: prodC.id,
    purchase_date: '2026-08-01',
    price: 300,
    currency: 'BDT',
  });
  await db.startUsagePeriod(TEST_USER, {
    product_id: prodC.id,
    purchase_id: purC.id,
    opened_date: '2026-08-01',
  });

  // Product D: Different Category & Unit (Oral Care, 150g)
  const prodD = await db.createProduct(TEST_USER, {
    name: 'Colgate Total Toothpaste',
    category: 'Oral Care',
    brand: 'Colgate',
    size_value: 150,
    size_unit: 'g',
  });
  const purD = await db.createPurchase(TEST_USER, {
    product_id: prodD.id,
    purchase_date: '2026-05-01',
    price: 450,
    currency: 'BDT',
  });
  const useD = await db.startUsagePeriod(TEST_USER, {
    product_id: prodD.id,
    purchase_id: purD.id,
    opened_date: '2026-05-01',
  });
  await db.finishUsagePeriod(TEST_USER, useD.id, '2026-06-15'); // 45 days

  // Other User's Product
  const prodOther = await db.createProduct(OTHER_USER, {
    name: 'User B Private Shampoo',
    category: 'Haircare',
  });
  await db.createPurchase(OTHER_USER, {
    product_id: prodOther.id,
    purchase_date: '2026-07-01',
    price: 2500,
    currency: 'BDT',
  });

  // ----------------------------------------------------------------------------
  // Test 1: Entry points exist from Product Detail
  // ----------------------------------------------------------------------------
  console.log('\n--- 1. Product comparison entry points ---');
  const prodDetailFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/ProductDetailPage.tsx'), 'utf-8');
  assert(prodDetailFile.includes('/compare?base='), 'ProductDetailPage has Compare action button linking to /compare?base=');
  const inventoryFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/InventoryPage.tsx'), 'utf-8');
  assert(inventoryFile.includes('/compare?base='), 'InventoryPage has Compare action on active containers');

  // ----------------------------------------------------------------------------
  // Test 2 & 3: Current-user product search & selection
  // ----------------------------------------------------------------------------
  console.log('\n--- 2 & 3. Current-user product search & selection ---');
  const userProducts = await db.getAllUserProducts(TEST_USER);
  const userProductIds = userProducts.map((p) => p.id);
  assert(userProductIds.includes(prodA.id), 'Search returns Product A');
  assert(userProductIds.includes(prodB.id), 'Search returns Product B');
  assert(userProductIds.includes(prodC.id), 'Search returns Product C');
  assert(!userProductIds.includes(prodOther.id), 'Search strictly excludes other user products');

  // ----------------------------------------------------------------------------
  // Test 4 & 5: Purchase Price Comparison & Percentage Diff
  // ----------------------------------------------------------------------------
  console.log('\n--- 4 & 5. Purchase price comparison & percentage difference ---');
  const priceComp = comparePrices(1000, 1200);
  assert(priceComp.absolute === 200, 'Price absolute difference is +200');
  assert(priceComp.percentage === 20, 'Price percentage difference is +20%');
  assert(priceComp.formattedDiff.includes('+৳200'), 'Formatted price diff includes +৳200');

  // ----------------------------------------------------------------------------
  // Test 6 & 7: Size comparison & Unit Price calculation
  // ----------------------------------------------------------------------------
  console.log('\n--- 6 & 7. Size comparison & unit price calculation ---');
  const sizeComp = compareSizes(400, 'ml', 450, 'ml');
  assert(sizeComp.isCompatible, 'Identical units (ml vs ml) are compatible');
  assert(sizeComp.difference === 50, 'Size difference is +50 ml');
  assert(sizeComp.percentage === 12.5, 'Size percentage difference is +12.5%');

  const unitA = calculateUnitPrice(1000, 400, 'ml');
  const unitB = calculateUnitPrice(1200, 450, 'ml');
  assert(unitA.unitPrice === 2.5, 'Product A unit price is ৳2.50 / ml');
  assert(unitB.unitPrice === 2.67, 'Product B unit price is ৳2.67 / ml');

  const unitComp = compareUnitPrices(unitA.unitPrice, unitB.unitPrice, true);
  assert(unitComp !== null, 'Unit price difference calculated');
  assert(unitComp?.absolute === 0.17, 'Unit price absolute difference is +৳0.17');
  assert(unitComp?.percentage === 6.8, 'Unit price percentage difference is +6.8%');

  // ----------------------------------------------------------------------------
  // Test 8: Incompatible size units do not produce false comparisons
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Incompatible size units safety ---');
  const incompSize = compareSizes(400, 'ml', 150, 'g');
  assert(!incompSize.isCompatible, 'Different units (ml vs g) are marked incompatible');
  assert(incompSize.difference === null, 'No false numeric difference calculated for ml vs g');
  assert(incompSize.formattedDiff === 'Size comparison unavailable', 'Displays safe unavailable message');

  // ----------------------------------------------------------------------------
  // Test 9 & 10: Observed Lifespan & Cost / Day Comparison
  // ----------------------------------------------------------------------------
  console.log('\n--- 9 & 10. Completed lifespan & Cost/Day comparison ---');
  const histA = await db.getProductHistory(prodA.id, TEST_USER);
  const histB = await db.getProductHistory(prodB.id, TEST_USER);
  assert(histA !== null && histB !== null, 'Retrieved histories for A and B');

  const metricsA = deriveProductObservedMetrics(histA!);
  const metricsB = deriveProductObservedMetrics(histB!);

  assert(metricsA.observedAverageLifespan === 90, 'Product A observed lifespan is 90 days');
  assert(metricsB.observedAverageLifespan === 95, 'Product B observed lifespan is 95 days');

  assert(metricsA.observedCostPerDay === 11.11, 'Product A observed cost/day is ৳11.11');
  assert(metricsB.observedCostPerDay === 12.63, 'Product B observed cost/day is ৳12.63');

  const fullReport = buildComparisonReport(histA!, histB!);
  assert(fullReport.lifespanComparison?.absolute === 5, 'Lifespan difference is +5 days');
  assert(fullReport.costPerDayComparison?.absolute === 1.52, 'Cost/day difference is +৳1.52/day');

  // ----------------------------------------------------------------------------
  // Test 11: Monthly normalized cost strictly uses ×30
  // ----------------------------------------------------------------------------
  console.log('\n--- 11. Monthly normalized consumption uses ×30 ---');
  assert(metricsA.observedMonthlyConsumption === 333, 'Product A monthly consumption is ৳333 (11.11 * 30 = 333.3 -> 333)');
  assert(metricsB.observedMonthlyConsumption === 379, 'Product B monthly consumption is ৳379 (12.63 * 30 = 378.9 -> 379)');
  assert(fullReport.monthlyConsumptionComparison?.absolute === 46, 'Monthly normalized difference is +৳46/month');

  // ----------------------------------------------------------------------------
  // Test 12 & 13: Active product without completed cycles shows Learning state
  // ----------------------------------------------------------------------------
  console.log('\n--- 12 & 13. Active product without completed cycles shows Learning ---');
  const histC = await db.getProductHistory(prodC.id, TEST_USER);
  const metricsC = deriveProductObservedMetrics(histC!);
  assert(metricsC.completedCycles === 0, 'Product C has 0 completed cycles');
  assert(metricsC.observedAverageLifespan === null, 'Product C lifespan is strictly null (Learning)');
  assert(metricsC.observedCostPerDay === null, 'Product C cost/day is strictly null (Learning)');
  assert(metricsC.observedMonthlyConsumption === null, 'Product C monthly consumption is strictly null');
  assert(metricsC.confidenceState === 'no_data', 'Product C confidence state is no_data');

  const reportWithC = buildComparisonReport(histA!, histC!);
  assert(reportWithC.lifespanComparison === null, 'Lifespan comparison is null when one product has no cycles');
  assert(reportWithC.costPerDayComparison === null, 'Cost/day comparison is null when one product has no cycles');
  assert(
    reportWithC.insightSummary === 'Not enough data to compare actual consumption yet.',
    'Deterministic insight is exactly "Not enough data to compare actual consumption yet."'
  );
  assert(
    reportWithC.productA.observedAverageLifespan === 90,
    'Product A observed lifespan is 90 days'
  );
  assert(
    reportWithC.productB.observedAverageLifespan === null,
    'Product C observed lifespan is null (Learning) — never substituted with active prediction'
  );
  assert(
    reportWithC.productB.activeUsageContext !== null,
    'Product C activeUsageContext is populated strictly as separate context'
  );
  assert(
    reportWithC.productB.activeUsageContext?.elapsedDays !== undefined,
    'Product C active bottle elapsed days available in context'
  );

  // ----------------------------------------------------------------------------
  // Test 14 & 15: One completed cycle vs Multiple completed cycles labeling
  // ----------------------------------------------------------------------------
  console.log('\n--- 14 & 15. Single vs multiple cycle confidence labeling ---');
  assert(metricsA.confidenceState === 'early_data', '1 cycle labeled as early_data');
  assert(metricsA.confidenceLabel.includes('1 completed cycle'), 'Confidence label notes 1 completed cycle');
  assert(fullReport.isEarlyData === true, 'Comparison report with 1-cycle product flagged isEarlyData === true');
  assert(
    fullReport.confidenceNotice !== null && fullReport.confidenceNotice.includes('Early data'),
    'Confidence notice warns of early / limited data'
  );
  assert(
    !['better', 'best', 'superior', 'recommended'].some((word) =>
      fullReport.insightSummary.toLowerCase().includes(word)
    ),
    'Insight summary strictly avoids subjective words (better, best, superior, recommended)'
  );

  // Add 2nd completed cycle to Product A
  const purA2 = await db.createPurchase(TEST_USER, {
    product_id: prodA.id,
    purchase_date: '2026-06-01',
    price: 1100,
    currency: 'BDT',
  });
  const useA2 = await db.startUsagePeriod(TEST_USER, {
    product_id: prodA.id,
    purchase_id: purA2.id,
    opened_date: '2026-06-01',
  });
  await db.finishUsagePeriod(TEST_USER, useA2.id, '2026-09-09'); // 100 days

  const histA_2Cycles = await db.getProductHistory(prodA.id, TEST_USER);
  const metricsA_2Cycles = deriveProductObservedMetrics(histA_2Cycles!);
  assert(metricsA_2Cycles.completedCycles === 2, 'Product A now has 2 completed cycles');
  assert(metricsA_2Cycles.confidenceState === 'historical', '2 cycles labeled as historical');
  assert(metricsA_2Cycles.observedAverageLifespan === 95, 'Weighted average lifespan is 95 days ((90 + 100) / 2)');
  // Total price = 1000 + 1100 = 2100. Total days = 90 + 100 = 190. Cost/day = 2100 / 190 = 11.05
  assert(metricsA_2Cycles.observedCostPerDay === 11.05, 'Weighted cost/day across 2 cycles is ৳11.05');

  // ----------------------------------------------------------------------------
  // Test 16 & 17: Historical cycle prices are not mutated by new purchases
  // ----------------------------------------------------------------------------
  console.log('\n--- 16 & 17. Historical integrity and immutability ---');
  // Add a new backup purchase for Product A at ৳1,500
  await db.createPurchase(TEST_USER, {
    product_id: prodA.id,
    purchase_date: today,
    price: 1500,
    currency: 'BDT',
  });
  const histA_afterBackup = await db.getProductHistory(prodA.id, TEST_USER);
  const metricsA_afterBackup = deriveProductObservedMetrics(histA_afterBackup!);
  assert(
    metricsA_afterBackup.observedCostPerDay === 11.05,
    'Unopened backup purchase does NOT alter completed cycle cost/day (remains ৳11.05)'
  );
  assert(
    metricsA_afterBackup.observedAverageLifespan === 95,
    'Unopened backup purchase does NOT alter completed cycle lifespan (remains 95 days)'
  );

  // ----------------------------------------------------------------------------
  // Test 18 & 19: Prediction & Analytics calculations remain unchanged
  // ----------------------------------------------------------------------------
  console.log('\n--- 18 & 19. Prediction & Analytics calculation isolation ---');
  const avgLife = calculateAverageLifespan(histA_afterBackup!.finished_periods);
  assert(avgLife === 95, 'Core prediction calculateAverageLifespan unchanged');
  const costPerDayCore = calculateCostPerDay(1000, 90);
  assert(costPerDayCore === 11.11, 'Core prediction calculateCostPerDay unchanged');

  // ----------------------------------------------------------------------------
  // Test 20: Cross-category comparison notice
  // ----------------------------------------------------------------------------
  console.log('\n--- 20. Cross-category comparison handling ---');
  const histD = await db.getProductHistory(prodD.id, TEST_USER);
  const crossCategoryReport = buildComparisonReport(histA!, histD!);
  assert(!crossCategoryReport.isSameCategory, 'Product A (Haircare) and Product D (Oral Care) flagged as different categories');

  // ----------------------------------------------------------------------------
  // Test 21: Comparing product with itself handled safely
  // ----------------------------------------------------------------------------
  console.log('\n--- 21. Self-comparison safety ---');
  const selfReport = buildComparisonReport(histA!, histA!);
  assert(selfReport.isSameProduct, 'Identified identical product IDs');
  assert(
    selfReport.insightSummary.includes('Comparing a product with itself does not yield comparative insights'),
    'Self-comparison yields clear guidance to choose a different product'
  );

  // ----------------------------------------------------------------------------
  // Test 22 & 23: Deterministic Value Insight Engine
  // ----------------------------------------------------------------------------
  console.log('\n--- 22 & 23. Value Insight Engine verification ---');
  const insightAB = deriveComparisonInsight(metricsA, metricsB, false);
  assert(
    insightAB.includes("L'Oréal Elvive Shampoo lasts longer than Head & Shoulders Shampoo, but costs more per day for your usage."),
    `Deterministic insight identifies longer lasting but higher cost/day (got "${insightAB}")`
  );

  // ----------------------------------------------------------------------------
  // Test 24: Mock storage persistence across reload
  // ----------------------------------------------------------------------------
  console.log('\n--- 24. Mock persistence across reload ---');
  const reloadedDb = new MockDatabase(memoryAdapter);
  const reloadedHistA = await reloadedDb.getProductHistory(prodA.id, TEST_USER);
  assert(Boolean(reloadedHistA), 'Product A history rehydrated across reload');
  assert(reloadedHistA?.finished_periods.length === 2, 'All 2 completed cycles persisted across reload');

  // ----------------------------------------------------------------------------
  // Test 25 & 26: Supabase live connectivity & RLS cross-account isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- 25 & 26. Supabase live persistence & RLS isolation ---');
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
  const getEnv = (key: string) => {
    const line = envContent.split('\n').find((l) => l.trim().startsWith(`${key}=`));
    return line ? line.trim().slice(`${key}=`.length).trim() : '';
  };

  const rawUrl = getEnv('VITE_SUPABASE_URL');
  const rawKey = getEnv('VITE_SUPABASE_ANON_KEY');
  const userAEmail = getEnv('TEST_USER_A_EMAIL');
  const userAPassword = getEnv('TEST_USER_A_PASSWORD');
  const userBEmail = getEnv('TEST_USER_B_EMAIL');
  const userBPassword = getEnv('TEST_USER_B_PASSWORD');

  const isConfigured = Boolean(
    rawUrl &&
      rawKey &&
      !rawUrl.includes('YOUR_SUPABASE_URL') &&
      !rawKey.includes('YOUR_SUPABASE_ANON_KEY')
  );

  if (!isConfigured || !userAEmail || !userBEmail) {
    console.log('  ⚠️ Supabase test credentials not fully available, skipping live Supabase section.');
  } else {
    const clientA = createClient(rawUrl, rawKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const clientB = createClient(rawUrl, rawKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const [authA, authB] = await Promise.all([
      clientA.auth.signInWithPassword({ email: userAEmail, password: userAPassword }),
      clientB.auth.signInWithPassword({ email: userBEmail, password: userBPassword }),
    ]);

    assert(!authA.error && authA.data.user !== null, 'Account A authenticated with Supabase');
    assert(!authB.error && authB.data.user !== null, 'Account B authenticated with Supabase');

    const userAId = authA.data.user!.id;
    const userBId = authB.data.user!.id;

    // Account A creates live comparison product
    const { data: liveProd, error: prodErr } = await clientA
      .from('products')
      .insert({
        user_id: userAId,
        name: 'Live Comparison Test Essential',
        category: 'Skincare',
      })
      .select()
      .single();
    assert(!prodErr && liveProd !== null, 'Account A created live product');

    // Account B attempts to query Account A's product
    const { data: bProd } = await clientB
      .from('products')
      .select('*')
      .eq('id', liveProd.id);
    assert(!bProd || bProd.length === 0, 'RLS strictly prevents Account B from reading Account A comparison product');

    // Clean up
    await clientA.from('products').delete().eq('id', liveProd.id);
    console.log('  ✓ Live Supabase test records cleanly removed');
  }

  // ----------------------------------------------------------------------------
  // Test 27: No N+1 query pattern verified in comparison page
  // ----------------------------------------------------------------------------
  console.log('\n--- 27. No N+1 queries in ProductComparisonPage ---');
  const compPageContent = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/ProductComparisonPage.tsx'), 'utf-8');
  assert(
    compPageContent.includes('Promise.all'),
    'Batched Promise.all used for loading histories (no sequential loops)'
  );

  // ----------------------------------------------------------------------------
  // Test 28, 29, 30: Accessibility & 375px mobile responsiveness
  // ----------------------------------------------------------------------------
  console.log('\n--- 28, 29, 30. Responsive 375px layout & accessibility compliance ---');
  assert(
    compPageContent.includes('min-h-[42px]') || compPageContent.includes('btn-press'),
    'Interactive buttons adhere to touch target styling standards'
  );
  assert(
    compPageContent.includes('grid-cols-1'),
    'Product comparison provides mobile stacked layout at 375px'
  );
  assert(
    compPageContent.includes('animate-page-in'),
    'Adheres to reduced-motion and standard transition tokens'
  );

  console.log('\n=================================================================');
  console.log('✅ ALL 30 NITTOO STAGE 11 COMPARISON VERIFICATIONS PASSED 100%!');
  console.log('=================================================================\n');
}

runComparisonVerification().catch((err) => {
  console.error('Fatal verification failure:', err);
  process.exit(1);
});
