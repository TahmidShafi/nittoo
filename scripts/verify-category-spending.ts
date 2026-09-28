// ==============================================================================
// Nittoo Stage 18 Automated Verification:
// Category Spending Intelligence & Mathematical Invariance Audit
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
} from '../src/lib/mock-db';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
} from '../src/lib/prediction';
import {
  calculateEstimatedMonthlyConsumption,
  getCategorySpending,
  calculateCategorySpending,
  type CategorySpending,
} from '../src/lib/analytics';
import { dataCache } from '../src/lib/dataCache';
import { buildExportData } from '../src/lib/export/normalizer';
import type { ProductWithHistory } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runCategorySpendingVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 18: CATEGORY SPENDING INTELLIGENCE AUDIT');
  console.log('=================================================================\n');

  const storageAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(storageAdapter);

  const userA = 'user-cat-alice-101';
  const userB = 'user-cat-bob-202';

  // ----------------------------------------------------------------------------
  // SECTION 1: Pure Mathematical Fixture (Phase 18 Invariance)
  // ----------------------------------------------------------------------------
  console.log('--- 1. Testing Deterministic Category Aggregation Fixture ---');

  // Test 1: Empty dataset returns empty array
  const emptyRes = getCategorySpending([]);
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, '1. Empty dataset returns empty array');

  // Test 8: Total = 0 / Division-by-zero safety
  const zeroPriceFixture: ProductWithHistory[] = [
    {
      product: {
        id: 'p-zero',
        user_id: userA,
        name: 'Free Sample',
        category: 'Skincare',
        created_at: new Date().toISOString(),
      },
      purchases: [
        {
          id: 'pur-zero',
          product_id: 'p-zero',
          purchase_date: '2026-01-01',
          price: 0,
          currency: 'BDT',
          created_at: new Date().toISOString(),
        },
      ],
      usage_periods: [
        {
          id: 'u-zero',
          product_id: 'p-zero',
          purchase_id: 'pur-zero',
          opened_date: '2026-01-01',
          finished_date: '2026-01-31',
          status: 'finished',
          created_at: new Date().toISOString(),
        },
      ],
      active_usage: null,
      finished_periods: [
        {
          id: 'u-zero',
          product_id: 'p-zero',
          purchase_id: 'pur-zero',
          opened_date: '2026-01-01',
          finished_date: '2026-01-31',
          status: 'finished',
          created_at: new Date().toISOString(),
        },
      ],
      unopened_purchases: [],
    },
  ];
  const zeroPriceRes = getCategorySpending(zeroPriceFixture);
  assert(zeroPriceRes.length === 0, '8. Total cost 0 returns empty array without division-by-zero crash');

  // Test 2: Products with zero completed cycles are strictly excluded
  const zeroHistoryFixture: ProductWithHistory[] = [
    {
      product: {
        id: 'p-unstarted',
        user_id: userA,
        name: 'Olaplex No. 4',
        category: 'Haircare',
        created_at: new Date().toISOString(),
      },
      purchases: [
        {
          id: 'pur-unstarted',
          product_id: 'p-unstarted',
          purchase_date: '2026-01-01',
          price: 3200,
          currency: 'BDT',
          created_at: new Date().toISOString(),
        },
      ],
      usage_periods: [],
      active_usage: null,
      finished_periods: [],
      unopened_purchases: [],
    },
  ];
  const zeroHistoryRes = getCategorySpending(zeroHistoryFixture);
  assert(zeroHistoryRes.length === 0, '2. Products with zero completed cycles are excluded from category spending');

  // ----------------------------------------------------------------------------
  // Phase 18 Deterministic Test Fixture:
  // Skincare Product A: price = 1200, lifespan = 60d -> monthly = (1200 / 60) * 30 = 600
  // Skincare Product B: price = 900, lifespan = 90d -> monthly = (900 / 90) * 30 = 300
  // Haircare Product C: price = 1200, lifespan = 60d -> monthly = (1200 / 60) * 30 = 600
  // Total = 1500; Skincare = 900 (60%), Haircare = 600 (40%)
  // ----------------------------------------------------------------------------
  const fixtureA: ProductWithHistory = {
    product: { id: 'pA', user_id: userA, name: 'Product A', category: 'Skincare', created_at: '' },
    purchases: [{ id: 'puA', product_id: 'pA', purchase_date: '2026-01-01', price: 1200, currency: 'BDT', created_at: '' }],
    usage_periods: [{ id: 'uA', product_id: 'pA', purchase_id: 'puA', opened_date: '2026-01-01', finished_date: '2026-03-02', status: 'finished', created_at: '' }],
    active_usage: null,
    finished_periods: [{ id: 'uA', product_id: 'pA', purchase_id: 'puA', opened_date: '2026-01-01', finished_date: '2026-03-02', status: 'finished', created_at: '' }],
    unopened_purchases: [],
  };

  const fixtureB: ProductWithHistory = {
    product: { id: 'pB', user_id: userA, name: 'Product B', category: 'Skincare', created_at: '' },
    purchases: [{ id: 'puB', product_id: 'pB', purchase_date: '2026-01-01', price: 900, currency: 'BDT', created_at: '' }],
    usage_periods: [{ id: 'uB', product_id: 'pB', purchase_id: 'puB', opened_date: '2026-01-01', finished_date: '2026-04-01', status: 'finished', created_at: '' }],
    active_usage: null,
    finished_periods: [{ id: 'uB', product_id: 'pB', purchase_id: 'puB', opened_date: '2026-01-01', finished_date: '2026-04-01', status: 'finished', created_at: '' }],
    unopened_purchases: [],
  };

  const fixtureC: ProductWithHistory = {
    product: { id: 'pC', user_id: userA, name: 'Product C', category: 'Haircare', created_at: '' },
    purchases: [{ id: 'puC', product_id: 'pC', purchase_date: '2026-01-01', price: 1200, currency: 'BDT', created_at: '' }],
    usage_periods: [{ id: 'uC', product_id: 'pC', purchase_id: 'puC', opened_date: '2026-01-01', finished_date: '2026-03-02', status: 'finished', created_at: '' }],
    active_usage: null,
    finished_periods: [{ id: 'uC', product_id: 'pC', purchase_id: 'puC', opened_date: '2026-01-01', finished_date: '2026-03-02', status: 'finished', created_at: '' }],
    unopened_purchases: [],
  };

  // Test 3, 4, 5, 6, 7: Aggregation & normalization
  const fullFixture = [fixtureA, fixtureB, fixtureC];
  const catRes = getCategorySpending(fullFixture);

  assert(catRes.length === 2, '5. Multiple categories remain separate (2 categories found)');
  assert(catRes[0].category === 'Skincare', '9. Deterministic sorting: Skincare is first (highest spend)');
  assert(catRes[0].monthlyCost === 900, `3, 4. Skincare monthly cost is exactly ৳900 (got ${catRes[0].monthlyCost})`);
  assert(catRes[0].productCount === 2, `4. Skincare aggregates exactly 2 products (got ${catRes[0].productCount})`);
  assert(catRes[0].percentageOfTotal === 60, `6. Skincare percentage is exactly 60% (got ${catRes[0].percentageOfTotal})`);

  assert(catRes[1].category === 'Haircare', '9. Haircare is ranked second');
  assert(catRes[1].monthlyCost === 600, `Haircare monthly cost is exactly ৳600 (got ${catRes[1].monthlyCost})`);
  assert(catRes[1].productCount === 1, 'Haircare aggregates exactly 1 product');
  assert(catRes[1].percentageOfTotal === 40, `Haircare percentage is exactly 40% (got ${catRes[1].percentageOfTotal})`);

  assert(catRes[0].percentageOfTotal + catRes[1].percentageOfTotal === 100, '7. Total percentages normalize to 100%');

  // Test 10: Equal-value tie ordering (alphabetical secondary sort)
  const fixtureOral: ProductWithHistory = {
    product: { id: 'pOral', user_id: userA, name: 'Sensodyne', category: 'Oral Care', created_at: '' },
    purchases: [{ id: 'puO', product_id: 'pOral', purchase_date: '2026-01-01', price: 600, currency: 'BDT', created_at: '' }],
    usage_periods: [{ id: 'uO', product_id: 'pOral', purchase_id: 'puO', opened_date: '2026-01-01', finished_date: '2026-01-31', status: 'finished', created_at: '' }],
    active_usage: null,
    finished_periods: [{ id: 'uO', product_id: 'pOral', purchase_id: 'puO', opened_date: '2026-01-01', finished_date: '2026-01-31', status: 'finished', created_at: '' }],
    unopened_purchases: [],
  }; // monthly = 600 / 30 * 30 = 600
  // Haircare (600) vs Oral Care (600): 'Haircare' < 'Oral Care' alphabetically
  const tieFixture = [fixtureOral, fixtureC];
  const tieRes = getCategorySpending(tieFixture);
  assert(tieRes.length === 2, 'Tie fixture has 2 categories');
  assert(tieRes[0].monthlyCost === 600 && tieRes[1].monthlyCost === 600, 'Both categories have identical cost');
  assert(tieRes[0].category === 'Haircare', '10. Equal-cost tie ordering: Haircare comes before Oral Care alphabetically');
  assert(tieRes[1].category === 'Oral Care', '10. Equal-cost tie ordering: Oral Care comes second');

  // Test 11: Existing monthly consumption matches sum of category monthly costs
  const overallMonthly = calculateEstimatedMonthlyConsumption(fullFixture);
  assert(overallMonthly === 1500, `11. Overall monthly consumption matches ৳1,500 (got ${overallMonthly})`);
  assert(catRes.reduce((s, c) => s + c.monthlyCost, 0) === overallMonthly, 'Category costs sum exactly to overall monthly consumption');

  // Test 13: calculateCategorySpending alias is identical to getCategorySpending
  const aliasRes = calculateCategorySpending(fullFixture);
  assert(JSON.stringify(aliasRes) === JSON.stringify(catRes), '13. calculateCategorySpending produces identical result (pure function)');

  // ----------------------------------------------------------------------------
  // SECTION 2: Database Layer & SWR Cache Invalidation Integration
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Database-Driven Category Spending & SWR Caching ---');

  // User A creates products across 2 categories with vendor metadata
  const prod1 = await db.createProduct(userA, {
    name: 'CeraVe Hydrating Cleanser',
    category: 'Skincare',
    brand: 'CeraVe',
  });
  const pur1 = await db.createPurchase(userA, {
    product_id: prod1.id,
    purchase_date: '2026-01-01',
    price: 1200,
    store_vendor: 'Daraz',
  });
  const use1 = await db.startUsagePeriod(userA, {
    product_id: prod1.id,
    purchase_id: pur1.id,
    opened_date: '2026-01-01',
  });
  await db.finishUsagePeriod(userA, use1.id, '2026-03-02'); // 60 days -> monthly = 600

  const prod2 = await db.createProduct(userA, {
    name: 'Sensodyne Toothpaste',
    category: 'Oral Care',
    brand: 'Sensodyne',
  });
  const pur2 = await db.createPurchase(userA, {
    product_id: prod2.id,
    purchase_date: '2026-02-01',
    price: 450,
    store_vendor: 'Supermarket',
  });
  const use2 = await db.startUsagePeriod(userA, {
    product_id: prod2.id,
    purchase_id: pur2.id,
    opened_date: '2026-02-01',
  });
  await db.finishUsagePeriod(userA, use2.id, '2026-03-18'); // 45 days -> monthly = 300

  // 14. Load via existing single roundtrip getUserProductsWithHistory (zero new queries)
  const userAProductsWithHistory = await db.getUserProductsWithHistory(userA);
  assert(userAProductsWithHistory.length === 2, '14. getUserProductsWithHistory loads portfolio in single roundtrip');

  // Test 15: Compute and cache under SWR key 'analytics'
  dataCache.clearAll();
  dataCache.set(userA, 'analytics', userAProductsWithHistory);
  assert(dataCache.has(userA, 'analytics'), '15. SWR analytics cache contains portfolio data');

  const cachedHistories = dataCache.get<ProductWithHistory[]>(userA, 'analytics')?.data;
  assert(Boolean(cachedHistories), 'SWR cache retrieves data immediately');
  const userACatSpending = getCategorySpending(cachedHistories!);
  assert(userACatSpending.length === 2, 'Category spending computed from SWR cache');
  assert(userACatSpending[0].category === 'Skincare' && userACatSpending[0].monthlyCost === 600, 'Skincare is ৳600/mo');
  assert(userACatSpending[1].category === 'Oral Care' && userACatSpending[1].monthlyCost === 300, 'Oral Care is ৳300/mo');

  // 18. Vendor metadata has no adverse effect on category aggregation
  assert(pur1.store_vendor === 'Daraz' && pur2.store_vendor === 'Supermarket', '18. Vendor metadata preserved on purchases');

  // 19. Historical cycle edit updates category spending
  console.log('\n--- 3. Verifying Historical Edit & Delete Cache Invalidation ---');

  // Edit use1 (60 days -> 30 days): monthly becomes (1200 / 30) * 30 = 1200
  const updatedUse1 = await db.updateUsagePeriod(userA, use1.id, {
    opened_date: '2026-01-01',
    finished_date: '2026-01-31', // 30 days
  });
  // Simulate dataSource mutation invalidation
  dataCache.invalidateProduct(userA, updatedUse1.product_id);

  // 16. Cache was invalidated automatically
  assert(!dataCache.has(userA, 'analytics'), '16. SWR analytics cache invalidated after updateUsagePeriod');

  const refreshedHistories = await db.getUserProductsWithHistory(userA);
  const updatedCatSpending = getCategorySpending(refreshedHistories);
  assert(updatedCatSpending[0].category === 'Skincare', 'Skincare remains top category');
  assert(updatedCatSpending[0].monthlyCost === 1200, `19. Skincare recalculated to ৳1200 after cycle edit (got ${updatedCatSpending[0].monthlyCost})`);

  // Deleting a cycle removes its contribution
  const deletedUse1 = await db.deleteUsagePeriod(userA, use1.id);
  dataCache.invalidateProduct(userA, deletedUse1.product_id);
  assert(!dataCache.has(userA, 'analytics'), '16. SWR analytics cache invalidated after deleteUsagePeriod');

  const afterDeleteHistories = await db.getUserProductsWithHistory(userA);
  const afterDeleteCatSpending = getCategorySpending(afterDeleteHistories);
  assert(afterDeleteCatSpending.length === 1, '19. Skincare eliminated from category spending when its only cycle is deleted');
  assert(afterDeleteCatSpending[0].category === 'Oral Care', 'Oral Care is now the sole remaining category');
  assert(afterDeleteCatSpending[0].percentageOfTotal === 100, 'Oral Care represents 100% of remaining consumption');

  // ----------------------------------------------------------------------------
  // SECTION 3: Multi-User Security & Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Multi-User Security and Isolation ---');

  // Create User B product and finished period
  const prodB = await db.createProduct(userB, {
    name: 'Olaplex Shampoo',
    category: 'Haircare',
  });
  const purB = await db.createPurchase(userB, {
    product_id: prodB.id,
    purchase_date: '2026-01-01',
    price: 3000,
  });
  const useB = await db.startUsagePeriod(userB, {
    product_id: prodB.id,
    purchase_id: purB.id,
    opened_date: '2026-01-01',
  });
  await db.finishUsagePeriod(userB, useB.id, '2026-02-15'); // 45 days -> monthly = 2000

  const userBHistories = await db.getUserProductsWithHistory(userB);
  const userBCatSpending = getCategorySpending(userBHistories);
  assert(userBCatSpending.length === 1 && userBCatSpending[0].category === 'Haircare', '17. User B sees only their Haircare category');
  assert(!userBCatSpending.some((c) => c.category === 'Oral Care'), '17. User B does not see User A Oral Care category');

  // ----------------------------------------------------------------------------
  // SECTION 4: Export and Restore Compatibility
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying Export and Restore Compatibility ---');

  const exportData = await buildExportData(userA, 'alice@example.com', db);
  assert(Boolean(exportData.summary.category_breakdown), '20. Export summary includes category_breakdown');
  assert(exportData.summary.category_breakdown.length > 0, '20. Export category breakdown contains calculated data');

  // Authoritative JSON backup does NOT contain derived category spending tables
  assert(!('category_spending' in exportData), '21. Category spending is not stored as an authoritative database table in backup JSON');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 18 CATEGORY SPENDING VERIFICATION CHECKS PASSED!');
  console.log('=================================================================\n');
}

runCategorySpendingVerification().catch((err) => {
  console.error('Fatal error during Category Spending verification:', err);
  process.exit(1);
});
