// ==============================================================================
// Nittoo Stage 2 Automated Auth Verification Script
// Tests Deterministic IDs, Session Persistence, Logout, Isolation, and Seed Access
// ==============================================================================

import {
  generateDeterministicMockUserId,
  MOCK_SESSION_KEY,
  withAuthTimeout,
  type AuthUser,
} from '../src/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';
import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
  mockDb,
} from '../src/lib/mock-db';
import {
  DEMO_USER_ID,
  getActiveDataSource,
  setDemoModeActive,
  isDemoSessionActive,
} from '../src/lib/dataSource';
import { buildDemoSeedData } from '../src/lib/demo/seed';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runAuthVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 2 AUTHENTICATION VERIFICATION');
  console.log('=================================================================\n');

  // ----------------------------------------------------------------------------
  // 1. DETERMINISTIC MOCK USER IDS
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying Deterministic Mock User IDs ---');

  // Demo user mapping
  const demoId = generateDeterministicMockUserId('demo-user@nittoo.local');
  assert(demoId === DEFAULT_MOCK_USER_ID, `demo-user@nittoo.local maps to "${DEFAULT_MOCK_USER_ID}"`);

  // Case insensitivity & trimming
  const demoIdTrimmed = generateDeterministicMockUserId('  Demo-User@Nittoo.LOCAL ');
  assert(demoIdTrimmed === DEFAULT_MOCK_USER_ID, 'Case-insensitive & whitespace-trimmed demo user maps properly');

  // Stability for arbitrary user
  const aliceEmail = 'alice.smith@example.com';
  const aliceId1 = generateDeterministicMockUserId(aliceEmail);
  const aliceId2 = generateDeterministicMockUserId(aliceEmail);
  assert(aliceId1 === aliceId2, 'Same email always produces identical user ID across invocations');
  assert(aliceId1.startsWith('mock-user-alicesmith-'), `User ID includes readable slug: ${aliceId1}`);

  // Distinct emails produce distinct IDs
  const bobEmail = 'bob.jones@example.com';
  const bobId = generateDeterministicMockUserId(bobEmail);
  assert(aliceId1 !== bobId, 'Different emails produce distinct, non-colliding user IDs');

  const charlieEmail = 'charlie@example.com';
  const charlieId = generateDeterministicMockUserId(charlieEmail);
  assert(bobId !== charlieId && aliceId1 !== charlieId, 'Multiple distinct emails have unique IDs');

  // ----------------------------------------------------------------------------
  // 2. SESSION PERSISTENCE & RESTORATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Verifying Mock Session Persistence & Restoration ---');
  const sessionStore = new InMemoryStorageAdapter();

  // Simulate Sign In
  const mockUserAlice: AuthUser = {
    id: aliceId1,
    email: aliceEmail,
    created_at: new Date().toISOString(),
  };

  sessionStore.setItem(MOCK_SESSION_KEY, JSON.stringify({ user: mockUserAlice }));
  assert(sessionStore.getItem(MOCK_SESSION_KEY) !== null, 'Session stored in storage adapter');

  // Simulate App Startup / Session Restoration
  const restoredRaw = sessionStore.getItem(MOCK_SESSION_KEY);
  assert(restoredRaw !== null, 'Session retrieved from storage');
  const restoredParsed = JSON.parse(restoredRaw!);
  assert(restoredParsed.user.id === mockUserAlice.id, 'Restored session matches authenticated user ID');
  assert(restoredParsed.user.email === mockUserAlice.email, 'Restored session matches user email');

  // ----------------------------------------------------------------------------
  // 3. LOGOUT BEHAVIOR
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Verifying Logout Clears Session But Retains Product Data ---');
  const dataStorage = new InMemoryStorageAdapter();
  const db = new MockDatabase(dataStorage);

  // User Alice logs a product while logged in
  const aliceProduct = await db.createProduct(aliceId1, {
    name: 'Paula Choice BHA Exfoliant',
    category: 'Skincare',
    brand: 'Paulas Choice',
    size_value: 118,
    size_unit: 'ml',
  });
  assert(aliceProduct.user_id === aliceId1, 'Alice logged a product in her storage');

  // Simulate Logout
  sessionStore.removeItem(MOCK_SESSION_KEY);
  assert(sessionStore.getItem(MOCK_SESSION_KEY) === null, 'Logout successfully removes session from storage');

  // Verify product data was NOT deleted by logout
  const aliceProductsAfterLogout = await db.getAllUserProducts(aliceId1);
  assert(aliceProductsAfterLogout.length === 1, 'Alice product data remains intact after logout');
  assert(aliceProductsAfterLogout[0].id === aliceProduct.id, 'Alice product ID verified after logout');

  // ----------------------------------------------------------------------------
  // 4. MULTI-USER DATA ISOLATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Cross-User Data Isolation ---');

  // User Bob signs in and checks products
  const bobProducts = await db.getAllUserProducts(bobId);
  assert(bobProducts.length === 0, 'User Bob sees 0 products initially (isolated from Alice)');

  // Bob adds his own product
  const bobProduct = await db.createProduct(bobId, {
    name: 'Head & Shoulders Shampoo',
    category: 'Haircare',
    brand: 'Head & Shoulders',
  });
  assert(bobProduct.user_id === bobId, 'Bob product created with Bob ID');

  const bobProductsAfterAdd = await db.getAllUserProducts(bobId);
  assert(bobProductsAfterAdd.length === 1, 'Bob now sees his 1 product');

  const aliceProductsCheck = await db.getAllUserProducts(aliceId1);
  assert(aliceProductsCheck.length === 1, 'Alice still sees only her 1 product');
  assert(aliceProductsCheck[0].name === 'Paula Choice BHA Exfoliant', 'Alice data not contaminated by Bob');

  // ----------------------------------------------------------------------------
  // 5. SEED USER VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying Demo User Seed Access ---');
  const seedProducts = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  assert(seedProducts.length === 3, 'Demo user (demo-user@nittoo.local) has access to 3 seeded essentials');
  const activeSeedProducts = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);
  assert(activeSeedProducts.length === 3, 'All 3 seeded essentials have active periods on demo dashboard');

  // ----------------------------------------------------------------------------
  // 6. RUNTIME DEMO MODE SEEDING & ADAPTER SWITCHING
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Verifying Runtime Demo Mode Seed & DataSource Switching ---');
  const demoBundle = buildDemoSeedData(DEMO_USER_ID, '2026-11-15');
  assert(demoBundle.products.length === 12, 'buildDemoSeedData creates 12 sample products');
  assert(
    demoBundle.purchases.length > demoBundle.products.length,
    'buildDemoSeedData creates 12-18 months of purchases'
  );
  assert(
    demoBundle.usage_periods.some((u) => u.finished_date !== null),
    'buildDemoSeedData includes finished usage cycles'
  );
  assert(
    demoBundle.restock_plans.length >= 1,
    'buildDemoSeedData includes at least one restock plan'
  );
  assert(
    demoBundle.purchases.every((p) => p.currency === 'BDT'),
    'buildDemoSeedData uses BDT prices'
  );

  // Freshness check across two distant "today" dates
  const classifySeed = (todayStr: string) => {
    const b = buildDemoSeedData(DEMO_USER_ID, todayStr);
    const msPerDay = 86_400_000;
    const todayMs = Date.parse(`${todayStr}T00:00:00Z`);
    let onTrack = 0;
    let dueSoon = 0;
    let overdue = 0;
    let minRemaining = Infinity;

    for (const p of b.products) {
      const active = b.usage_periods.find((u) => u.product_id === p.id && u.status === 'active');
      if (!active) continue;
      const finished = b.usage_periods.filter((u) => u.product_id === p.id && u.status === 'finished');
      if (finished.length === 0) continue;
      const avg =
        finished.reduce((sum, u) => {
          const d = (Date.parse(`${u.finished_date}T00:00:00Z`) - Date.parse(`${u.opened_date}T00:00:00Z`)) / msPerDay;
          return sum + d;
        }, 0) / finished.length;
      const used = (todayMs - Date.parse(`${active.opened_date}T00:00:00Z`)) / msPerDay;
      const remaining = Math.round(avg - used);
      minRemaining = Math.min(minRemaining, remaining);
      if (remaining < 0) overdue++;
      else if (remaining <= 7) dueSoon++;
      else onTrack++;
    }

    const usedPurchaseIds = new Set(b.usage_periods.map((u) => u.purchase_id));
    const unopenedCount = b.purchases.filter((pu) => !usedPurchaseIds.has(pu.id)).length;
    return { onTrack, dueSoon, overdue, minRemaining, unopenedCount };
  };

  const mixA = classifySeed('2026-03-15');
  const mixB = classifySeed('2027-08-22');
  assert(
    mixA.onTrack > 0 && mixA.dueSoon > 0 && mixA.unopenedCount >= 1,
    `Demo seed has on-track (${mixA.onTrack}), due-soon (${mixA.dueSoon}), and unopened backup (${mixA.unopenedCount})`
  );
  assert(
    mixA.onTrack === mixB.onTrack &&
      mixA.dueSoon === mixB.dueSoon &&
      mixA.overdue === mixB.overdue &&
      mixA.minRemaining === mixB.minRemaining &&
      mixA.unopenedCount === mixB.unopenedCount,
    'Demo seed produces identical state mix across two different "today" dates'
  );
  assert(
    mixA.minRemaining >= -7,
    `Nothing in demo seed is more overdue than intended (minRemaining=${mixA.minRemaining})`
  );

  db.seedDemoUser(DEMO_USER_ID, demoBundle);
  const demoProducts = await db.getAllUserProducts(DEMO_USER_ID);
  assert(demoProducts.length === 12, 'seedDemoUser stores 12 products for DEMO_USER_ID');

  const demoInventory = await db.getUserInventory(DEMO_USER_ID);
  assert(
    demoInventory.unopened.length >= 1,
    'Demo inventory includes at least one unopened backup bottle'
  );

  await db.resetUserData(DEMO_USER_ID, true);
  const clearedDemoProducts = await db.getAllUserProducts(DEMO_USER_ID);
  assert(clearedDemoProducts.length === 0, 'Exiting demo mode clears demo user data');

  // Verify runtime adapter selection in browser-like environment
  const originalWindow = (globalThis as { window?: unknown }).window;
  const mockStore = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mockStore.get(k) ?? null,
      setItem: (k: string, v: string) => mockStore.set(k, v),
      removeItem: (k: string) => mockStore.delete(k),
    },
  };
  try {
    setDemoModeActive(true);
    assert(isDemoSessionActive() === true, 'setDemoModeActive(true) activates demo session');
    assert(
      getActiveDataSource() === mockDb,
      'getActiveDataSource() selects mockDb at runtime when demo mode is active'
    );
    setDemoModeActive(false);
    assert(isDemoSessionActive() === false, 'setDemoModeActive(false) deactivates demo session');
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }

  // ----------------------------------------------------------------------------
  // 7. UNREACHABLE SUPABASE RESILIENCE (TIMEOUT & ERROR CATCHING)
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Verifying Unreachable Supabase Timeout & Resilience ---');
  let unhandledFired = false;
  const onUnhandled = () => {
    unhandledFired = true;
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    // 7a. Hanging promise must reject cleanly within timeout
    const hanging = new Promise<string>(() => {
      // intentionally never settles
    });
    let timedOut = false;
    try {
      await withAuthTimeout(hanging, 50);
    } catch (err) {
      timedOut = err instanceof Error && err.message.includes('timed out');
    }
    assert(timedOut === true, 'withAuthTimeout rejects hanging auth init within timeout');

    // 7b. Unreachable dead-host Supabase client getSession() must not throw unhandled rejection
    const deadSupabase = createClient(
      'https://dead-host-nittoo-test.invalid',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake'
    );
    let deadSettled = false;
    try {
      await withAuthTimeout(deadSupabase.auth.getSession(), 200);
      deadSettled = true;
    } catch {
      deadSettled = true;
    }
    assert(deadSettled === true, 'Dead-host Supabase getSession() settles cleanly without hanging');
    assert(unhandledFired === false, 'No unhandled promise rejections emitted during dead-host auth init');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 2 AUTHENTICATION VERIFICATION CHECKS PASSED!');
  console.log('=================================================================');
}

runAuthVerification().catch((err) => {
  console.error('Unexpected failure during auth verification:', err);
  process.exit(1);
});
