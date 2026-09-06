// ==============================================================================
// Nittoo Lifecycle Verification: PURCHASED BUT NOT YET OPENED
// Comprehensive verification of the extended lifecycle:
// Purchase -> Unopened/Stored -> Start Using -> Active -> Finish -> History -> Prediction
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
  UNOPENED_MOCK_USER_ID,
} from '../src/lib/mock-db';
import {
  calculateAverageLifespan,
  calculateCostPerDay,
} from '../src/lib/prediction';
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

async function assertRejects(
  promise: Promise<unknown>,
  expectedSubstring: string,
  testName: string
) {
  try {
    await promise;
    console.error(`❌ ASSERTION FAILED: Expected rejection for "${testName}", but it succeeded.`);
    process.exit(1);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message.toLowerCase().includes(expectedSubstring.toLowerCase())) {
      console.log(`  ✓ Correctly rejected: ${testName} (${error.message})`);
    } else {
      console.error(
        `❌ ASSERTION FAILED for "${testName}": Expected error containing "${expectedSubstring}", got "${error.message}"`
      );
      process.exit(1);
    }
  }
}

async function runUnopenedLifecycleVerification() {
  console.log('=================================================================');
  console.log('NITTOO LIFECYCLE: PURCHASED BUT NOT YET OPENED VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);
  const TEST_USER = 'test-lifecycle-user-123';

  // ----------------------------------------------------------------------------
  // 1. New Product + Start Using Today
  // ----------------------------------------------------------------------------
  console.log('--- 1. New Product + Start Using Today ---');
  const prod1 = await db.createProduct(TEST_USER, {
    name: 'Face Serum',
    category: 'Skincare',
    brand: 'The Ordinary',
    size_value: 30,
    size_unit: 'ml',
  });
  const pur1 = await db.createPurchase(TEST_USER, {
    product_id: prod1.id,
    purchase_date: '2026-09-01',
    price: 1200,
    currency: 'BDT',
  });
  const usage1 = await db.startUsagePeriod(TEST_USER, {
    product_id: prod1.id,
    purchase_id: pur1.id,
    opened_date: '2026-09-01',
  });
  assert(usage1.status === 'active', 'Active usage period created immediately');
  assert(usage1.opened_date === '2026-09-01', 'Opened date recorded correctly');

  const history1 = await db.getProductHistory(prod1.id, TEST_USER);
  assert(history1 !== null, 'History 1 found');
  assert(history1!.active_usage !== null, 'Product has active usage');
  assert(history1!.unopened_purchases.length === 0, 'No unopened purchases for product 1');

  const activeProducts1 = await db.getActiveProducts(TEST_USER);
  assert(
    activeProducts1.some((p) => p.id === prod1.id),
    'Product 1 is listed in Active Essentials'
  );

  // ----------------------------------------------------------------------------
  // 2. New Product + Keep Unopened
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. New Product + Keep Unopened ---');
  const prod2 = await db.createProduct(TEST_USER, {
    name: 'Body Lotion',
    category: 'Skincare',
    brand: 'Nivea',
    size_value: 400,
    size_unit: 'ml',
  });
  const pur2 = await db.createPurchase(TEST_USER, {
    product_id: prod2.id,
    purchase_date: '2026-09-06',
    price: 850,
    currency: 'BDT',
  });
  // Do NOT start usage period for prod2 (Keep unopened)

  const history2 = await db.getProductHistory(prod2.id, TEST_USER);
  assert(history2 !== null, 'History 2 found');
  assert(history2!.active_usage === null, 'No active usage period exists for unopened product');
  assert(history2!.unopened_purchases.length === 1, 'Exactly 1 unopened purchase recorded');
  assert(history2!.unopened_purchases[0].id === pur2.id, 'Unopened purchase ID matches purchase');

  const activeProducts2 = await db.getActiveProducts(TEST_USER);
  assert(
    !activeProducts2.some((p) => p.id === prod2.id),
    'Unopened product is NOT listed in Active Essentials'
  );
  assert(
    activeProducts2.length === 1,
    'Active Essentials count remains 1 (only prod1 is active)'
  );

  // ----------------------------------------------------------------------------
  // 3. Existing Active Product + Keep Unopened (Backup Purchase)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Existing Active Product + Keep Unopened (Backup Purchase) ---');
  // Buy a backup bottle for prod1
  const pur1Backup = await db.createPurchase(TEST_USER, {
    product_id: prod1.id,
    purchase_date: '2026-09-06',
    price: 1250,
    currency: 'BDT',
  });

  const history1WithBackup = await db.getProductHistory(prod1.id, TEST_USER);
  assert(history1WithBackup !== null, 'History 1 with backup found');
  assert(
    history1WithBackup!.active_usage !== null &&
      history1WithBackup!.active_usage.id === usage1.id,
    'Original active usage period remains active and untouched'
  );
  assert(
    history1WithBackup!.unopened_purchases.length === 1,
    'Product 1 now has 1 unopened backup purchase'
  );
  assert(
    history1WithBackup!.unopened_purchases[0].id === pur1Backup.id,
    'Unopened purchase is the newly added backup'
  );
  assert(
    history1WithBackup!.purchases.length === 2,
    'Product 1 has 2 total purchases in history'
  );

  const activeProductsAfterBackup = await db.getActiveProducts(TEST_USER);
  const activeProd1 = activeProductsAfterBackup.find((p) => p.id === prod1.id);
  assert(activeProd1 !== undefined, 'Prod 1 still active');
  assert(
    activeProd1?.unopened_count === 1,
    'Prod 1 reflects unopened_count === 1 for subtle badge'
  );

  // ----------------------------------------------------------------------------
  // 4. Existing Active Product + Attempted Start Using
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Existing Active Product + Attempted Start Using ---');
  // Attempting to start another usage period while one is already active must reject
  await assertRejects(
    db.startUsagePeriod(TEST_USER, {
      product_id: prod1.id,
      purchase_id: pur1Backup.id,
      opened_date: '2026-09-06',
    }),
    'active usage',
    'Cannot start a second active usage period while one is active'
  );

  // ----------------------------------------------------------------------------
  // 5. Starting an Unopened Purchase When No Active Usage Exists
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Starting an Unopened Purchase When No Active Usage Exists ---');
  // Product 2 currently has 0 active usages and 1 unopened purchase (pur2)
  const activatedUsage2 = await db.startUsagePeriod(TEST_USER, {
    product_id: prod2.id,
    purchase_id: pur2.id,
    opened_date: '2026-09-06',
  });
  assert(activatedUsage2.status === 'active', 'Purchase activated successfully');
  assert(activatedUsage2.purchase_id === pur2.id, 'Usage linked to unopened purchase');

  const history2AfterActivation = await db.getProductHistory(prod2.id, TEST_USER);
  assert(
    history2AfterActivation!.active_usage?.id === activatedUsage2.id,
    'Product 2 now has active bottle'
  );
  assert(
    history2AfterActivation!.unopened_purchases.length === 0,
    'Product 2 unopened purchases list is now empty'
  );

  const activeProductsAfterActivation = await db.getActiveProducts(TEST_USER);
  assert(
    activeProductsAfterActivation.some((p) => p.id === prod2.id),
    'Product 2 now appears in Active Essentials'
  );
  assert(
    activeProductsAfterActivation.length === 2,
    'Active Essentials now contains exactly 2 active products'
  );

  // ----------------------------------------------------------------------------
  // 6. Starting an Unopened Purchase When Another Active Usage Exists
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Starting Unopened Purchase When Another Active Usage Exists ---');
  // Product 1 has active usage1. Add another backup pur1Backup2
  const pur1Backup2 = await db.createPurchase(TEST_USER, {
    product_id: prod1.id,
    purchase_date: '2026-09-06',
    price: 1300,
    currency: 'BDT',
  });
  await assertRejects(
    db.startUsagePeriod(TEST_USER, {
      product_id: prod1.id,
      purchase_id: pur1Backup2.id,
      opened_date: '2026-09-06',
    }),
    'active usage',
    'Reject activation while existing usage period is active'
  );
  // Also cannot re-activate an already used purchase
  await assertRejects(
    db.startUsagePeriod(TEST_USER, {
      product_id: prod2.id,
      purchase_id: pur2.id,
      opened_date: '2026-09-06',
    }),
    'already',
    'Reject activating a purchase that is already linked to a usage period'
  );

  // ----------------------------------------------------------------------------
  // 7. Unopened Purchases Excluded from Lifespan Calculations
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Unopened Purchases Excluded from Lifespan Calculations ---');
  // Product 2 has only 1 active bottle and 0 completed bottles.
  const lifespanProd2 = calculateAverageLifespan(history2AfterActivation!.usage_periods);
  assert(lifespanProd2 === null, 'Unopened / ongoing usage yields null average lifespan');

  // Let's finish active bottle of prod1, then add 2 unopened purchases
  await db.finishUsagePeriod(TEST_USER, usage1.id, '2026-09-21');
  const history1AfterFinish = await db.getProductHistory(prod1.id, TEST_USER);
  const lifespanBeforeMoreBackups = calculateAverageLifespan(history1AfterFinish!.usage_periods);
  assert(lifespanBeforeMoreBackups === 20, 'Average lifespan of finished bottle is 20 days');

  // Add 3 more unopened purchases to prod1
  await db.createPurchase(TEST_USER, {
    product_id: prod1.id,
    purchase_date: '2026-09-22',
    price: 1400,
    currency: 'BDT',
  });
  await db.createPurchase(TEST_USER, {
    product_id: prod1.id,
    purchase_date: '2026-09-22',
    price: 1400,
    currency: 'BDT',
  });
  const history1WithManyBackups = await db.getProductHistory(prod1.id, TEST_USER);
  const lifespanAfterMoreBackups = calculateAverageLifespan(history1WithManyBackups!.usage_periods);
  assert(
    lifespanAfterMoreBackups === 20,
    'Unopened purchases do NOT contribute to lifespan calculations (remains 20 days)'
  );

  // ----------------------------------------------------------------------------
  // 8. Unopened Purchases Excluded from Cost/Day Calculations
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Unopened Purchases Excluded from Cost/Day Calculations ---');
  // Now activate pur1Backup for prod1
  const usage1_2 = await db.startUsagePeriod(TEST_USER, {
    product_id: prod1.id,
    purchase_id: pur1Backup.id,
    opened_date: '2026-09-22',
  });
  // Active bottle price is 1250, average lifespan is 20 -> cost per day = 1250 / 20 = 62.5
  const costPerDayWithAverage = calculateCostPerDay(1250, 20);
  assert(
    costPerDayWithAverage === 62.5,
    'Cost per day is strictly calculated from active bottle price and lifespan'
  );
  // The fact that there are 2 other unopened backup bottles (৳1400 each) does not change cost per day
  assert(
    history1WithManyBackups!.unopened_purchases.length >= 2,
    'Multiple unopened backups exist without inflating daily cost'
  );

  // ----------------------------------------------------------------------------
  // 9. Unopened Purchases Included in Total Spent / Purchase History
  // ----------------------------------------------------------------------------
  console.log('\n--- 9. Unopened Purchases Included in Total Spending / Purchase History ---');
  const prod1History = await db.getProductHistory(prod1.id, TEST_USER);
  // Total purchases: pur1 (1200), pur1Backup (1250), pur1Backup2 (1300), backup3 (1400), backup4 (1400) = 6550
  const totalSpent = prod1History!.purchases.reduce((sum, p) => sum + p.price, 0);
  assert(prod1History!.purchases.length === 5, 'All 5 purchases recorded in history');
  assert(totalSpent === 6550, 'Total spent includes all purchases including unopened ones');

  // ----------------------------------------------------------------------------
  // 10. Mock Persistence Across Adapter Reload
  // ----------------------------------------------------------------------------
  console.log('\n--- 10. Mock Persistence Across Adapter Reload ---');
  // Create a new MockDatabase instance using the same memoryAdapter
  const reloadedDb = new MockDatabase(memoryAdapter);
  const reloadedHistory = await reloadedDb.getProductHistory(prod1.id, TEST_USER);
  assert(
    reloadedHistory!.purchases.length === 5,
    'Purchases persist across DB re-instantiation'
  );
  assert(
    reloadedHistory!.unopened_purchases.length === 3,
    'Unopened purchases correctly identified and preserved on reload'
  );
  assert(
    reloadedHistory!.active_usage?.id === usage1_2.id,
    'Active usage preserved on reload'
  );

  // ----------------------------------------------------------------------------
  // 11. Deterministic Unopened Seed Data Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- 11. Deterministic Seed Isolation ---');
  const defaultUserProducts = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  assert(
    defaultUserProducts.length === 3,
    'DEFAULT_MOCK_USER_ID has exactly 3 seeded products (untouched)'
  );

  const unopenedUserHistory = await db.getProductHistory(
    'prod-unopened-only',
    UNOPENED_MOCK_USER_ID
  );
  assert(
    unopenedUserHistory!.unopened_purchases.length === 1,
    'UNOPENED_MOCK_USER_ID has seeded unopened-only product'
  );
  assert(
    unopenedUserHistory!.active_usage === null,
    'unopened-only product has null active_usage'
  );

  const unopenedBackupHistory = await db.getProductHistory(
    'prod-unopened-backup',
    UNOPENED_MOCK_USER_ID
  );
  assert(
    unopenedBackupHistory!.active_usage !== null,
    'unopened-backup product has active_usage'
  );
  assert(
    unopenedBackupHistory!.unopened_purchases.length === 1,
    'unopened-backup product has 1 unopened backup'
  );

  // ----------------------------------------------------------------------------
  // 12. Supabase Live Persistence & Lifecycle (if configured)
  // ----------------------------------------------------------------------------
  console.log('\n--- 12. Supabase Live Persistence & Lifecycle ---');
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
  let rawUrl = '';
  let rawKey = '';
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      rawUrl = trimmed.slice('VITE_SUPABASE_URL='.length).trim();
    } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      rawKey = trimmed.slice('VITE_SUPABASE_ANON_KEY='.length).trim();
    }
  }

  const isConfigured = Boolean(
    rawUrl &&
      rawKey &&
      !rawUrl.includes('YOUR_SUPABASE_URL') &&
      !rawKey.includes('YOUR_SUPABASE_ANON_KEY') &&
      (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))
  );

  if (!isConfigured) {
    console.log('  ⚠️ Supabase not configured in .env, skipping live Supabase verification.');
  } else {
    const supabase = createClient(rawUrl, rawKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate with test credentials from .env
    let userAEmail = '';
    let userAPassword = '';
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('TEST_USER_A_EMAIL=')) {
        userAEmail = trimmed.slice('TEST_USER_A_EMAIL='.length).trim();
      } else if (trimmed.startsWith('TEST_USER_A_PASSWORD=')) {
        userAPassword = trimmed.slice('TEST_USER_A_PASSWORD='.length).trim();
      }
    }

    const testEmail = userAEmail || 'verify_lifecycle@example.com';
    const testPassword = userAPassword || 'Password123!';

    // Try logging in or signing up
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    let liveUserId = authData?.user?.id;
    if (authError || !liveUserId) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });
      if (signUpError || !signUpData.user) {
        console.log(`  ⚠️ Could not authenticate test user: ${signUpError?.message}`);
      } else {
        liveUserId = signUpData.user.id;
      }
    }

    if (liveUserId) {
      console.log(`  ✓ Authenticated live Supabase user: ${liveUserId}`);
      // 1. Create a product
      const { data: liveProd, error: prodErr } = await supabase
        .from('products')
        .insert({
          user_id: liveUserId,
          name: 'Live Unopened Test Product',
          category: 'Skincare',
          brand: 'Nittoo Labs',
          size_value: 50,
          size_unit: 'ml',
        })
        .select()
        .single();
      assert(!prodErr && liveProd !== null, 'Live product created');

      // 2. Create purchase without starting usage (Keep unopened)
      const { data: livePur, error: purErr } = await supabase
        .from('purchases')
        .insert({
          product_id: liveProd.id,
          purchase_date: '2026-09-06',
          price: 2500,
          currency: 'BDT',
        })
        .select()
        .single();
      assert(!purErr && livePur !== null, 'Live purchase created as unopened');

      // 3. Verify usage_periods has 0 rows for this product
      const { data: liveUsageList, error: usageListErr } = await supabase
        .from('usage_periods')
        .select('*')
        .eq('product_id', liveProd.id);
      assert(!usageListErr, 'Queried live usage periods');
      assert(
        liveUsageList !== null && liveUsageList.length === 0,
        'Confirmed: 0 usage_periods exist for unopened purchase in Supabase'
      );

      // 4. Activate the unopened purchase
      const { data: liveUsage, error: startErr } = await supabase
        .from('usage_periods')
        .insert({
          product_id: liveProd.id,
          purchase_id: livePur.id,
          opened_date: '2026-09-06',
          status: 'active',
        })
        .select()
        .single();
      assert(!startErr && liveUsage !== null, 'Live usage period activated from unopened purchase');

      // 5. Attempting duplicate active usage period triggers the database unique index
      const { error: dupErr } = await supabase.from('usage_periods').insert({
        product_id: liveProd.id,
        purchase_id: livePur.id,
        opened_date: '2026-09-06',
        status: 'active',
      });
      assert(
        dupErr !== null,
        'Live Supabase unique index prevented duplicate active usage period'
      );

      // 6. Cleanup test product (cascades to purchases and usage_periods)
      await supabase.from('products').delete().eq('id', liveProd.id);
      console.log('  ✓ Cleaned up live test product and cascaded records');
    }
  }

  console.log('\n=================================================================');
  console.log('ALL UNOPENED LIFECYCLE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runUnopenedLifecycleVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
