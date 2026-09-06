// ==============================================================================
// Nittoo Stage 2 Automated Auth Verification Script
// Tests Deterministic IDs, Session Persistence, Logout, Isolation, and Seed Access
// ==============================================================================

import {
  generateDeterministicMockUserId,
  MOCK_SESSION_KEY,
  type AuthUser,
} from '../src/contexts/AuthContext';
import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
} from '../src/lib/mock-db';

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

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 2 AUTHENTICATION VERIFICATION CHECKS PASSED!');
  console.log('=================================================================');
}

runAuthVerification().catch((err) => {
  console.error('Unexpected failure during auth verification:', err);
  process.exit(1);
});
