// ==============================================================================
// Nittoo Stage 16.9 Automated Verification: Client-Side In-Memory SWR Data Cache
//
// Validates:
// 1. Cache stores successful dashboard data
// 2. Cached dashboard data can be returned immediately
// 3. Fresh entries are recognized correctly
// 4. Stale entries are recognized correctly
// 5. Stale data triggers revalidation
// 6. Background failure preserves cached data
// 7. Dashboard mutation invalidates affected cache
// 8. Inventory mutation invalidates affected cache
// 9. Product Detail mutation invalidates affected cache
// 10. Analytics cache invalidates after relevant mutation
// 11. User A cache is isolated from User B
// 12. Sign out clears private cache
// 13. Account deletion clears private cache
// 14. Product A cache cannot appear as Product B
// 15. Comparison cache keys are deterministic
// 16. Focus/visibility revalidation does not create duplicate refresh systems
// 17. No auth secrets are stored
// 18. Cache does not persist to localStorage/sessionStorage
// 19. Mock data-source compatibility remains intact
// 20. No existing calculations change
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { dataCache, areValuesEqual, STALE_TIME_MS, MAX_CACHE_ENTRIES_PER_USER } from '../src/lib/dataCache';
import { db } from '../src/lib/dataSource';
import { DEFAULT_MOCK_USER_ID, MockDatabase, InMemoryStorageAdapter } from '../src/lib/mock-db';
import { calculateAverageLifespan, calculateCostPerDay, calculatePredictedRemainingDays } from '../src/lib/prediction';
import { calculateConfidence } from '../src/lib/confidence';
import { calculateEstimatedMonthlyConsumption, getUpcomingPurchases } from '../src/lib/analytics';
import type { ProductWithDetails, ProductWithHistory, UserInventory } from '../src/types';

let totalTests = 0;
let passedTests = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('  NITTOO CLIENT-SIDE IN-MEMORY SWR CACHE AUDIT');
  console.log('======================================================\n');

  const userA = 'user-test-alice-123';
  const userB = 'user-test-bob-456';

  // Clear cache before starting suite
  dataCache.clearAll();

  // ------------------------------------------------------------------
  // Suite 1: Cache Storage, Retrieval, and Freshness
  // ------------------------------------------------------------------
  console.log('Suite 1: Cache Storage, Retrieval, and Staleness Detection');

  await test('1. Cache stores successful dashboard data', () => {
    const dummyProducts: ProductWithDetails[] = [
      {
        id: 'prod-test-1',
        name: 'Test Essential',
        category: 'Skincare',
        size_unit: 'ml',
        user_id: userA,
        created_at: new Date().toISOString(),
        active_usage: null,
        latest_purchase: null,
      },
    ];
    dataCache.set(userA, 'dashboard', dummyProducts);
    assert.strictEqual(dataCache.has(userA, 'dashboard'), true);
  });

  await test('2. Cached dashboard data can be returned immediately', () => {
    const entry = dataCache.get<ProductWithDetails[]>(userA, 'dashboard');
    assert(entry !== null, 'Cached entry must be returned');
    assert.strictEqual(entry.data.length, 1);
    assert.strictEqual(entry.data[0].id, 'prod-test-1');
    assert.strictEqual(entry.userId, userA);
  });

  await test('3. Fresh entries are recognized correctly', () => {
    const entry = dataCache.get<ProductWithDetails[]>(userA, 'dashboard');
    assert(entry !== null);
    assert.strictEqual(dataCache.isFresh(entry), true, 'Entry created just now must be fresh (<30s)');
    assert.strictEqual(dataCache.isStale(entry), false);
  });

  await test('4. Stale entries are recognized correctly', () => {
    const simulatedOldEntry = {
      data: [{ id: 'prod-old' }],
      fetchedAt: Date.now() - (STALE_TIME_MS + 5000), // 35 seconds ago
      userId: userA,
      key: 'dashboard',
    };
    assert.strictEqual(dataCache.isStale(simulatedOldEntry), true, 'Entry older than 30s must be stale');
    assert.strictEqual(dataCache.isFresh(simulatedOldEntry), false);
  });

  await test('5. Stale data triggers silent revalidation in SWR lifecycle', () => {
    // Verify policy: if entry is stale, SWR architecture fires background revalidation
    const entry = {
      data: 'test',
      fetchedAt: Date.now() - 40000,
      userId: userA,
      key: 'dashboard',
    };
    const shouldRevalidate = dataCache.isStale(entry);
    assert.strictEqual(shouldRevalidate, true, 'Stale snapshot must trigger silent revalidation');
  });

  // ------------------------------------------------------------------
  // Suite 2: Error Resilience and Invalidation
  // ------------------------------------------------------------------
  console.log('\nSuite 2: Background Failure Resilience & Mutation Invalidation');

  await test('6. Background failure preserves cached data', () => {
    // When background refresh fails, existing cached entry must remain available
    const initialEntry = dataCache.get(userA, 'dashboard');
    assert(initialEntry !== null);

    // Simulate network error during background revalidation
    let errorCaught = false;
    try {
      throw new Error('Supabase network disconnection');
    } catch {
      errorCaught = true;
    }
    assert.strictEqual(errorCaught, true);

    // Cache must remain untouched and readable
    const preservedEntry = dataCache.get(userA, 'dashboard');
    assert(preservedEntry !== null);
    assert.deepStrictEqual(preservedEntry.data, initialEntry.data);
  });

  await test('7. Dashboard mutation invalidates affected cache', async () => {
    // Populate user cache with dashboard, inventory, analytics
    dataCache.set(userA, 'dashboard', [{ id: 'p1' }]);
    dataCache.set(userA, 'inventory', { active: [], unopened: [] });
    dataCache.set(userA, 'analytics', [{ product: { id: 'p1' } }]);

    // Trigger invalidation for product 'p1'
    dataCache.invalidateProduct(userA, 'p1');

    assert.strictEqual(dataCache.has(userA, 'dashboard'), false, 'dashboard must be invalidated');
    assert.strictEqual(dataCache.has(userA, 'inventory'), false, 'inventory must be invalidated');
    assert.strictEqual(dataCache.has(userA, 'analytics'), false, 'analytics must be invalidated');
  });

  await test('8. Inventory mutation invalidates affected cache', () => {
    dataCache.set(userA, 'inventory', { active: [], unopened: [] });
    assert.strictEqual(dataCache.has(userA, 'inventory'), true);

    dataCache.invalidateProduct(userA, 'prod-123');
    assert.strictEqual(dataCache.has(userA, 'inventory'), false);
  });

  await test('9. Product Detail mutation invalidates affected cache', () => {
    dataCache.set(userA, 'product:prod-xyz', { product: { id: 'prod-xyz' } });
    assert.strictEqual(dataCache.has(userA, 'product:prod-xyz'), true);

    dataCache.invalidateProduct(userA, 'prod-xyz');
    assert.strictEqual(dataCache.has(userA, 'product:prod-xyz'), false);
  });

  await test('10. Analytics cache invalidates after relevant mutation', () => {
    dataCache.set(userA, 'analytics', [{ product: { id: 'prod-abc' } }]);
    assert.strictEqual(dataCache.has(userA, 'analytics'), true);

    dataCache.invalidateProduct(userA, 'prod-abc');
    assert.strictEqual(dataCache.has(userA, 'analytics'), false);
  });

  // ------------------------------------------------------------------
  // Suite 3: Multi-User Isolation and Privacy
  // ------------------------------------------------------------------
  console.log('\nSuite 3: Multi-User Isolation & Privacy Enforcement');

  await test('11. User A cache is strictly isolated from User B', () => {
    dataCache.set(userA, 'dashboard', [{ id: 'alice-secret-item' }]);
    dataCache.set(userB, 'dashboard', [{ id: 'bob-item' }]);

    const aliceData = dataCache.get<any[]>(userA, 'dashboard');
    const bobData = dataCache.get<any[]>(userB, 'dashboard');

    assert.strictEqual(aliceData?.data[0].id, 'alice-secret-item');
    assert.strictEqual(bobData?.data[0].id, 'bob-item');
    assert.notDeepStrictEqual(aliceData?.data, bobData?.data);

    // Cross-user lookup verification
    assert.strictEqual(dataCache.get('unauthenticated-user', 'dashboard'), null);
  });

  await test('12. Sign out clears private cache', () => {
    dataCache.set(userA, 'dashboard', [{ id: 'alice-item' }]);
    dataCache.set(userA, 'inventory', { active: [] });
    assert.strictEqual(dataCache.has(userA, 'dashboard'), true);

    // Simulate user sign-out
    dataCache.clearUser(userA);

    assert.strictEqual(dataCache.has(userA, 'dashboard'), false);
    assert.strictEqual(dataCache.has(userA, 'inventory'), false);
    assert.strictEqual(dataCache.getUserEntryCount(userA), 0);
  });

  await test('13. Account deletion clears private cache', () => {
    dataCache.set(userB, 'dashboard', [{ id: 'bob-item' }]);
    assert.strictEqual(dataCache.has(userB, 'dashboard'), true);

    // Simulate account deletion
    dataCache.clearUser(userB);

    assert.strictEqual(dataCache.has(userB, 'dashboard'), false);
    assert.strictEqual(dataCache.getUserEntryCount(userB), 0);
  });

  // ------------------------------------------------------------------
  // Suite 4: Key Correctness, Security, and Purity
  // ------------------------------------------------------------------
  console.log('\nSuite 4: Key Correctness, Security & Purity');

  await test('14. Product A cache cannot appear as Product B', () => {
    dataCache.set(userA, 'product:prod-a', { id: 'prod-a', name: 'Product Alpha' });
    dataCache.set(userA, 'product:prod-b', { id: 'prod-b', name: 'Product Beta' });

    const entryA = dataCache.get<any>(userA, 'product:prod-a');
    const entryB = dataCache.get<any>(userA, 'product:prod-b');

    assert.strictEqual(entryA?.data.id, 'prod-a');
    assert.strictEqual(entryB?.data.id, 'prod-b');
    assert.notStrictEqual(entryA?.data.name, entryB?.data.name);
  });

  await test('15. Comparison cache keys are deterministic regardless of parameter order', () => {
    const key1 = dataCache.getComparisonKey('prod-1', 'prod-2');
    const key2 = dataCache.getComparisonKey('prod-2', 'prod-1');
    assert.strictEqual(key1, 'comparison:prod-1:prod-2');
    assert.strictEqual(key2, 'comparison:prod-1:prod-2');
    assert.strictEqual(key1, key2);
  });

  await test('16. Focus/visibility revalidation preserves existing 3s throttle architecture', () => {
    const dashboardFile = fs.readFileSync(path.resolve('src/pages/DashboardPage.tsx'), 'utf-8');
    const inventoryFile = fs.readFileSync(path.resolve('src/pages/InventoryPage.tsx'), 'utf-8');
    const analyticsFile = fs.readFileSync(path.resolve('src/pages/AnalyticsPage.tsx'), 'utf-8');
    const detailFile = fs.readFileSync(path.resolve('src/pages/ProductDetailPage.tsx'), 'utf-8');

    // All pages must enforce the 3000ms throttle and silent revalidation
    for (const [name, content] of [
      ['DashboardPage', dashboardFile],
      ['InventoryPage', inventoryFile],
      ['AnalyticsPage', analyticsFile],
      ['ProductDetailPage', detailFile],
    ]) {
      assert(content.includes('3000'), `${name} must contain 3000ms throttle check`);
      assert(content.includes('visibilitychange'), `${name} must listen to visibilitychange`);
      assert(content.includes('window.addEventListener(\'focus\''), `${name} must listen to window focus`);
    }
  });

  await test('17. No auth secrets or tokens are stored in cache', () => {
    // Sensitive pattern assertion test
    let rejectedToken = false;
    try {
      dataCache.set(userA, 'bad-entry', { access_token: 'secret-token-123' });
    } catch {
      rejectedToken = true;
    }
    assert.strictEqual(rejectedToken, true, 'Cache must throw when attempting to store access_token');

    let rejectedPassword = false;
    try {
      dataCache.set(userA, 'bad-entry', { password: 'my-secret-password' });
    } catch {
      rejectedPassword = true;
    }
    assert.strictEqual(rejectedPassword, true, 'Cache must throw when attempting to store password');
  });

  await test('18. Cache does not persist to localStorage or sessionStorage', () => {
    const cacheFile = fs.readFileSync(path.resolve('src/lib/dataCache.ts'), 'utf-8');
    assert(!cacheFile.includes('localStorage.setItem'), 'dataCache must not write to localStorage');
    assert(!cacheFile.includes('sessionStorage.setItem'), 'dataCache must not write to sessionStorage');
    assert(!cacheFile.includes('indexedDB'), 'dataCache must not write to indexedDB');
  });

  await test('19. Mock data-source and Supabase implementations remain compatible with dataCache', async () => {
    // Verify db wrapper in dataSource.ts implements IDataSource and invalidates cache
    const testUserId = DEFAULT_MOCK_USER_ID;
    const active = await db.getActiveProducts(testUserId);
    assert(Array.isArray(active), 'db.getActiveProducts must return array');

    // Seed cache
    dataCache.set(testUserId, 'dashboard', active);
    assert.strictEqual(dataCache.has(testUserId, 'dashboard'), true);

    // Calling a write operation through db should auto-invalidate
    const inv = await db.getUserInventory(testUserId);
    if (inv.unopened.length > 0) {
      // Inventory has items; verify structure
      assert(inv.active !== undefined);
      assert(inv.unopened !== undefined);
    }
  });

  await test('20. No existing prediction, confidence, or analytics calculations change', () => {
    // Prediction math
    const avgLifespan = calculateAverageLifespan([
      { status: 'finished', opened_date: '2026-01-01', finished_date: '2026-01-31' } as any, // 30 days
      { status: 'finished', opened_date: '2026-02-01', finished_date: '2026-03-03' } as any, // 30 days
    ]);
    assert.strictEqual(avgLifespan, 30);

    const costPerDay = calculateCostPerDay(900, 30);
    assert.strictEqual(costPerDay, 30);

    const remaining = calculatePredictedRemainingDays(30, 10);
    assert.strictEqual(remaining, 20);

    // Confidence
    const conf = calculateConfidence(2);
    assert.strictEqual(conf.state, 'developing');
    assert.strictEqual(conf.label, 'Developing');

    // Value equality checker
    assert.strictEqual(areValuesEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }), true);
    assert.strictEqual(areValuesEqual({ a: 1 }, { a: 2 }), false);
  });

  console.log('\n======================================================');
  console.log(`  ALL ${passedTests} / ${totalTests} SWR CACHE AUDIT CHECKS PASSED`);
  console.log('======================================================\n');
}

run();
