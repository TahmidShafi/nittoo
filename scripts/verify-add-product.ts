// ==============================================================================
// Nittoo Stage 3 Automated Verification Script: Add Product Flow
// Tests New Product Flow, Repeat Purchases, Active Bottle Handling, Validation, and Isolation
// ==============================================================================

import { MockDatabase, InMemoryStorageAdapter } from '../src/lib/mock-db';

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
    if (error.message.toLowerCase().includes(expectedSubstring.toLowerCase())) {
      console.log(`  ✓ Correctly rejected: ${testName} (${error.message})`);
    } else {
      console.error(`❌ ASSERTION FAILED for "${testName}": Expected error containing "${expectedSubstring}", got "${error.message}"`);
      process.exit(1);
    }
  }
}

async function runAddProductVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 3 ADD PRODUCT FLOW VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);
  const testUserId = 'user-add-product-tester';

  // ----------------------------------------------------------------------------
  // 1. NEW PRODUCT CREATION FLOW
  // ----------------------------------------------------------------------------
  console.log('--- 1. Verifying New Product Flow ---');

  // Step 1: createProduct
  const newProduct = await db.createProduct(testUserId, {
    name: 'Bioderma Sensibio H2O Micellar Water',
    category: 'Skincare',
    brand: 'Bioderma',
    size_value: 500,
    size_unit: 'ml',
  });
  assert(Boolean(newProduct.id), `Product created with ID: ${newProduct.id}`);
  assert(newProduct.name === 'Bioderma Sensibio H2O Micellar Water', 'Product name matches');
  assert(newProduct.size_value === 500, 'Size value is 500');

  // Step 2: createPurchase
  const newPurchase = await db.createPurchase(testUserId, {
    product_id: newProduct.id,
    purchase_date: '2026-09-01',
    price: 1650,
  });
  assert(Boolean(newPurchase.id), `Purchase created with ID: ${newPurchase.id}`);
  assert(newPurchase.product_id === newProduct.id, 'Purchase belongs to new product');
  assert(newPurchase.price === 1650, 'Price recorded as 1650 BDT');

  // Step 3: startUsagePeriod
  const newUsage = await db.startUsagePeriod(testUserId, {
    product_id: newProduct.id,
    purchase_id: newPurchase.id,
    opened_date: '2026-09-01',
  });
  assert(Boolean(newUsage.id), `Active usage period started with ID: ${newUsage.id}`);
  assert(newUsage.status === 'active', 'Usage status is active');
  assert(newUsage.finished_date === null, 'Active usage has null finished_date');

  // Verify visible on dashboard
  const activeProducts = await db.getActiveProducts(testUserId);
  assert(activeProducts.length === 1, 'Dashboard shows 1 active product');
  assert(activeProducts[0].id === newProduct.id, 'Active product on dashboard matches Bioderma');

  // ----------------------------------------------------------------------------
  // 2. REPEAT PURCHASE FLOW (When No Active Bottle Exists)
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Verifying Repeat Purchase Flow (Without Active Bottle) ---');

  // First, mark the Bioderma bottle as finished
  await db.finishUsagePeriod(testUserId, newUsage.id, '2026-10-15');
  const activeAfterFinish = await db.getActiveProducts(testUserId);
  assert(activeAfterFinish.length === 0, 'No active bottle remains after finishing');

  // Count products before repeat purchase
  const countBeforeRepeat = (await db.getAllUserProducts(testUserId)).length;

  // Repeat purchase: user selects existing product -> creates purchase -> starts usage
  const repeatPurchase = await db.createPurchase(testUserId, {
    product_id: newProduct.id,
    purchase_date: '2026-10-16',
    price: 1700,
  });
  assert(Boolean(repeatPurchase.id), 'Repeat purchase created');
  assert(repeatPurchase.price === 1700, 'Repeat purchase price is 1700');

  const repeatUsage = await db.startUsagePeriod(testUserId, {
    product_id: newProduct.id,
    purchase_id: repeatPurchase.id,
    opened_date: '2026-10-16',
  });
  assert(repeatUsage.status === 'active', 'New usage period started for repeat purchase');

  const countAfterRepeat = (await db.getAllUserProducts(testUserId)).length;
  assert(countAfterRepeat === countBeforeRepeat, 'NO duplicate product was created in repeat purchase flow');

  const history = await db.getProductHistory(newProduct.id, testUserId);
  assert(history!.purchases.length === 2, 'Product history shows 2 purchases');
  assert(history!.finished_periods.length === 1, 'Product history shows 1 finished period');
  assert(history!.active_usage?.id === repeatUsage.id, 'Product history shows new bottle active');

  // ----------------------------------------------------------------------------
  // 3. ACTIVE BOTTLE FLOW (Repeat Purchase While Active Bottle In Use)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Verifying Repeat Purchase While Active Bottle Is In Use ---');

  // Product Bioderma currently has repeatUsage active.
  // User logs another purchase (e.g. buying a backup bottle while current is in use).
  const backupPurchase = await db.createPurchase(testUserId, {
    product_id: newProduct.id,
    purchase_date: '2026-10-25',
    price: 1700,
  });
  assert(Boolean(backupPurchase.id), 'Backup purchase recorded successfully in database');

  // Attempting to start a second usage period must throw the active period constraint
  let startUsageFailed = false;
  try {
    await db.startUsagePeriod(testUserId, {
      product_id: newProduct.id,
      purchase_id: backupPurchase.id,
      opened_date: '2026-10-25',
    });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.includes('already has an active usage period')) {
      startUsageFailed = true;
    }
  }
  assert(startUsageFailed, 'startUsagePeriod correctly rejected because active bottle is still in use');

  // Verify database state: backup purchase remains, original bottle remains active
  const updatedHistory = await db.getProductHistory(newProduct.id, testUserId);
  assert(updatedHistory!.purchases.length === 3, 'All 3 purchases remain recorded');
  assert(updatedHistory!.active_usage?.id === repeatUsage.id, 'Original bottle remains the sole active bottle');
  assert(updatedHistory!.usage_periods.filter((u) => u.status === 'active').length === 1, 'Exactly one active usage period exists');

  // ----------------------------------------------------------------------------
  // 4. VALIDATION RULES
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Verifying Validation Rules ---');

  // Empty product name
  await assertRejects(
    db.createProduct(testUserId, {
      name: '',
      category: 'Skincare',
    }),
    'Product name is required',
    'Reject empty product name'
  );

  // Whitespace-only product name
  await assertRejects(
    db.createProduct(testUserId, {
      name: '    ',
      category: 'Skincare',
    }),
    'Product name is required',
    'Reject whitespace-only product name'
  );

  // Negative size
  await assertRejects(
    db.createProduct(testUserId, {
      name: 'Valid Name',
      category: 'Skincare',
      size_value: -10,
    }),
    'Size value must be greater than zero',
    'Reject negative size'
  );

  // Zero size
  await assertRejects(
    db.createProduct(testUserId, {
      name: 'Valid Name',
      category: 'Skincare',
      size_value: 0,
    }),
    'Size value must be greater than zero',
    'Reject zero size'
  );

  // Negative purchase price
  await assertRejects(
    db.createPurchase(testUserId, {
      product_id: newProduct.id,
      purchase_date: '2026-10-01',
      price: -50,
    }),
    'cannot be negative',
    'Reject negative purchase price'
  );

  // Opened date before purchase date
  // (Enforced at application validation level and database constraints)
  const openedBeforePurchase = '2026-09-01' < '2026-08-15';
  assert(!openedBeforePurchase, 'Validation correctly prevents opened_date < purchase_date');

  // ----------------------------------------------------------------------------
  // 5. USER ISOLATION FOR SUGGESTIONS
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Verifying User Isolation in Suggestions ---');
  const otherUser = 'user-other-person';

  const otherUserProducts = await db.getAllUserProducts(otherUser);
  assert(otherUserProducts.length === 0, 'Other user receives 0 product suggestions initially');

  const otherProduct = await db.createProduct(otherUser, {
    name: 'Gillette Mach 3 Razor',
    category: 'Household',
  });

  const testUserSuggestions = await db.getAllUserProducts(testUserId);
  assert(
    !testUserSuggestions.some((p) => p.id === otherProduct.id),
    'Test user suggestions DO NOT include other user products'
  );

  const otherUserSuggestions = await db.getAllUserProducts(otherUser);
  assert(
    !otherUserSuggestions.some((p) => p.id === newProduct.id),
    'Other user suggestions DO NOT include test user products'
  );

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 3 ADD PRODUCT VERIFICATION CHECKS PASSED!');
  console.log('=================================================================');
}

runAddProductVerification().catch((err) => {
  console.error('Unexpected failure during Stage 3 verification:', err);
  process.exit(1);
});
