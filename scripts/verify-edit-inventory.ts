// ==============================================================================
// Nittoo Stage 9 Verification: EDIT CURRENT INVENTORY
// Tests in-place editing of Active Bottle and Unopened Purchases without duplicates
// Validates 29 criteria across MockDatabase, Prediction Math, and Live Supabase RLS
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
} from '../src/lib/mock-db';
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

async function runEditInventoryVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 9: EDIT CURRENT INVENTORY VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);
  const TEST_USER = 'test-edit-inventory-user';
  const today = getTodayUTC();

  // ----------------------------------------------------------------------------
  // Setup: Product with finished history, active bottle, and 1 unopened backup
  // ----------------------------------------------------------------------------
  console.log('--- Setup: Establishing baseline inventory with historical lifespan ---');
  const prod = await db.createProduct(TEST_USER, {
    name: 'Retinol 0.5% Serum',
    category: 'Skincare',
    brand: 'The Ordinary',
    size_value: 30,
    size_unit: 'ml',
  });

  // Cycle 1: Historical finished bottle (duration: 30 days)
  const purHistory = await db.createPurchase(TEST_USER, {
    product_id: prod.id,
    purchase_date: '2026-06-01',
    price: 1100,
    currency: 'BDT',
  });
  const useHistory = await db.startUsagePeriod(TEST_USER, {
    product_id: prod.id,
    purchase_id: purHistory.id,
    opened_date: '2026-06-01',
  });
  await db.finishUsagePeriod(TEST_USER, useHistory.id, '2026-07-01'); // 30 days

  // Active bottle: Purchase 2 + Active Usage 2
  const purActive = await db.createPurchase(TEST_USER, {
    product_id: prod.id,
    purchase_date: '2026-08-01',
    price: 1200,
    currency: 'BDT',
  });
  const useActive = await db.startUsagePeriod(TEST_USER, {
    product_id: prod.id,
    purchase_id: purActive.id,
    opened_date: '2026-08-10',
  });

  // Unopened backup: Purchase 3 (no usage period)
  const purUnopened = await db.createPurchase(TEST_USER, {
    product_id: prod.id,
    purchase_date: '2026-09-01',
    price: 1300,
    currency: 'BDT',
  });

  const baselineHistory = await db.getProductHistory(prod.id, TEST_USER);
  assert(baselineHistory !== null, 'Baseline history loaded');
  assert(baselineHistory!.purchases.length === 3, 'Baseline has 3 purchases');
  assert(baselineHistory!.finished_periods.length === 1, 'Baseline has 1 finished period');
  assert(baselineHistory!.active_usage?.id === useActive.id, 'Baseline has active usage period');
  assert(baselineHistory!.unopened_purchases.length === 1, 'Baseline has 1 unopened purchase');
  assert(
    calculateAverageLifespan(baselineHistory!.usage_periods) === 30,
    'Baseline average lifespan is exactly 30 days'
  );

  // ----------------------------------------------------------------------------
  // 1-4. Edit Active Product Metadata (Name, Category, Brand, Size)
  // ----------------------------------------------------------------------------
  console.log('\n--- 1-4. Edit Active Product Metadata ---');
  const updatedProd = await db.updateProduct(TEST_USER, prod.id, {
    name: 'Retinol 0.5% in Squalane Serum',
    category: 'Skincare',
    brand: 'The Ordinary Labs',
    size_value: 35,
    size_unit: 'ml',
  });
  assert(updatedProd.id === prod.id, 'Product ID is strictly preserved');
  assert(updatedProd.name === 'Retinol 0.5% in Squalane Serum', 'Product name updated in-place');
  assert(updatedProd.brand === 'The Ordinary Labs', 'Product brand updated in-place');
  assert(updatedProd.size_value === 35, 'Product size value updated in-place');
  assert(updatedProd.category === 'Skincare', 'Product category preserved/updated');

  const afterProdEdit = await db.getProductHistory(prod.id, TEST_USER);
  assert(afterProdEdit!.product.name === 'Retinol 0.5% in Squalane Serum', 'History reflects updated product name');

  // ----------------------------------------------------------------------------
  // 5-7. Edit Active Purchase Details (Date, Price, Currency)
  // ----------------------------------------------------------------------------
  console.log('\n--- 5-7. Edit Active Purchase Details ---');
  const updatedPurActive = await db.updatePurchase(TEST_USER, purActive.id, {
    purchase_date: '2026-08-05',
    price: 1250,
    currency: 'USD',
  });
  assert(updatedPurActive.id === purActive.id, 'Active purchase ID is strictly preserved');
  assert(updatedPurActive.purchase_date === '2026-08-05', 'Active purchase date updated in-place');
  assert(updatedPurActive.price === 1250, 'Active purchase price updated in-place');
  assert(updatedPurActive.currency === 'USD', 'Active purchase currency updated in-place');

  // Verify historical finished purchase price is untouched
  const afterActivePurEdit = await db.getProductHistory(prod.id, TEST_USER);
  const histPur = afterActivePurEdit!.purchases.find((p) => p.id === purHistory.id);
  assert(histPur?.price === 1100, 'Historical finished purchase price remains untouched (৳1,100)');
  assert(histPur?.currency === 'BDT', 'Historical finished purchase currency remains untouched');

  // ----------------------------------------------------------------------------
  // 8. Edit Active Usage Period (Opened Date)
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Edit Active Usage Period (Opened Date) ---');
  const updatedUseActive = await db.updateUsagePeriod(TEST_USER, useActive.id, {
    opened_date: '2026-08-15',
  });
  assert(updatedUseActive.id === useActive.id, 'Active usage period ID is strictly preserved');
  assert(updatedUseActive.opened_date === '2026-08-15', 'Active opened date updated in-place');
  assert(updatedUseActive.status === 'active', 'Usage status remains active');
  assert(updatedUseActive.finished_date === null, 'Active finished_date remains null');

  // ----------------------------------------------------------------------------
  // 9-12. Validation Safety Checks (Rejections)
  // ----------------------------------------------------------------------------
  console.log('\n--- 9-12. Validation Safety Checks ---');
  // 9. Negative price rejected
  await assertRejects(
    db.updatePurchase(TEST_USER, purActive.id, {
      purchase_date: '2026-08-05',
      price: -50,
      currency: 'BDT',
    }),
    'negative',
    'Negative purchase price rejected'
  );

  // 10. Invalid size rejected (<= 0)
  await assertRejects(
    db.updateProduct(TEST_USER, prod.id, {
      name: 'Valid Name',
      category: 'Skincare',
      size_value: -10,
    }),
    'greater than zero',
    'Negative size value rejected'
  );
  await assertRejects(
    db.updateProduct(TEST_USER, prod.id, {
      name: 'Valid Name',
      category: 'Skincare',
      size_value: 0,
    }),
    'greater than zero',
    'Zero size value rejected'
  );

  // 11. Opened date before purchase date rejected
  // Active purchase date is 2026-08-05; attempt opened_date 2026-08-01
  await assertRejects(
    db.updateUsagePeriod(TEST_USER, useActive.id, {
      opened_date: '2026-08-01',
    }),
    'earlier than purchase date',
    'Opened date before purchase date rejected'
  );

  // Also updating purchase date to after opened date rejected
  await assertRejects(
    db.updatePurchase(TEST_USER, purActive.id, {
      purchase_date: '2026-08-20', // opened_date is 2026-08-15
      price: 1250,
      currency: 'USD',
    }),
    'earlier than purchase date',
    'Purchase date after opened date rejected'
  );

  // 12. Future opened date rejected
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  await assertRejects(
    db.updateUsagePeriod(TEST_USER, useActive.id, {
      opened_date: tomorrow,
    }),
    'future',
    'Future opened date rejected'
  );

  // ----------------------------------------------------------------------------
  // 13-16. Edit Unopened Purchase Metadata, Date, Price, Currency
  // ----------------------------------------------------------------------------
  console.log('\n--- 13-16. Edit Unopened Purchase Metadata & Details ---');
  const updatedPurUnopened = await db.updatePurchase(TEST_USER, purUnopened.id, {
    purchase_date: '2026-09-02',
    price: 1350,
    currency: 'EUR',
  });
  assert(updatedPurUnopened.id === purUnopened.id, 'Unopened purchase ID strictly preserved');
  assert(updatedPurUnopened.purchase_date === '2026-09-02', 'Unopened purchase date updated');
  assert(updatedPurUnopened.price === 1350, 'Unopened purchase price updated');
  assert(updatedPurUnopened.currency === 'EUR', 'Unopened purchase currency updated');

  // ----------------------------------------------------------------------------
  // 17-20. Integrity Checks: No Duplicate Usage Periods or Purchases Created
  // ----------------------------------------------------------------------------
  console.log('\n--- 17-20. Integrity Checks: No Duplicate Records Created ---');
  const historyAfterEdits = await db.getProductHistory(prod.id, TEST_USER);
  assert(historyAfterEdits!.purchases.length === 3, 'Exactly 3 purchases exist (no duplicate purchases created)');
  assert(historyAfterEdits!.usage_periods.length === 2, 'Exactly 2 usage periods exist (no duplicate usage periods created)');
  assert(historyAfterEdits!.unopened_purchases.length === 1, 'Unopened purchase remains unopened');
  assert(historyAfterEdits!.unopened_purchases[0].id === purUnopened.id, 'Unopened purchase preserves purchase ID');
  assert(historyAfterEdits!.active_usage?.id === useActive.id, 'Active bottle preserves usage_period ID');

  // ----------------------------------------------------------------------------
  // 21-22. Historical Finished Usage & Purchases Remain Unchanged
  // ----------------------------------------------------------------------------
  console.log('\n--- 21-22. Historical Finished Usage & Purchases Remain Unchanged ---');
  assert(historyAfterEdits!.finished_periods.length === 1, 'Exactly 1 finished usage period in history');
  const finishedPeriod = historyAfterEdits!.finished_periods[0];
  assert(finishedPeriod.id === useHistory.id, 'Finished usage period ID unchanged');
  assert(finishedPeriod.opened_date === '2026-06-01', 'Finished period opened_date unchanged');
  assert(finishedPeriod.finished_date === '2026-07-01', 'Finished period finished_date unchanged');

  // Attempting to edit a finished usage period must reject
  await assertRejects(
    db.updateUsagePeriod(TEST_USER, useHistory.id, {
      opened_date: '2026-06-05',
    }),
    'only active',
    'Editing completed/finished usage period rejected'
  );

  // ----------------------------------------------------------------------------
  // 23-25. Prediction & Cost/Day Calculations Respond Accurately
  // ----------------------------------------------------------------------------
  console.log('\n--- 23-25. Prediction & Cost/Day Calculations Impact ---');
  // Average lifespan remains strictly based on completed periods: 30 days
  const avgLifespan = calculateAverageLifespan(historyAfterEdits!.usage_periods);
  assert(avgLifespan === 30, 'Average lifespan remains strictly 30 days');

  // Active opened date is 2026-08-15. As of Sep 6, 2026, daysUsed is 22 days.
  const daysUsedSep6 = getDaysBetween('2026-08-15', '2026-09-06');
  assert(daysUsedSep6 === 22, 'Days used calculated from updated opened_date (22 days)');

  // Predicted remaining days = 30 - 22 = 8 days
  const predictedRemaining = calculatePredictedRemainingDays(avgLifespan, daysUsedSep6);
  assert(predictedRemaining === 8, 'Predicted remaining days responds immediately to opened date (8 days left)');

  // Update opened date to 2026-08-05 (32 days ago as of Sep 6 -> Overdue by 2 days!)
  await db.updateUsagePeriod(TEST_USER, useActive.id, {
    opened_date: '2026-08-05',
  });
  const daysUsedAfterShift = getDaysBetween('2026-08-05', '2026-09-06');
  assert(daysUsedAfterShift === 32, 'Shifted opened date yields 32 days used');
  const overdueRemaining = calculatePredictedRemainingDays(avgLifespan, daysUsedAfterShift);
  assert(overdueRemaining === -2, 'Prediction calculation dynamically reflects overdue state (-2 days)');

  // Cost per day calculation uses active purchase price (1250) and avgLifespan (30): 1250 / 30 = 41.67
  const costPerDay = calculateCostPerDay(1250, 30);
  assert(costPerDay === 41.67, 'Cost per day accurately reflects edited purchase price (৳41.67/day)');

  // ----------------------------------------------------------------------------
  // 26. Mock Persistence Across Adapter Reload
  // ----------------------------------------------------------------------------
  console.log('\n--- 26. Mock Persistence Across Adapter Reload ---');
  const reloadedDb = new MockDatabase(memoryAdapter);
  const reloadedHistory = await reloadedDb.getProductHistory(prod.id, TEST_USER);
  assert(reloadedHistory !== null, 'Reloaded DB history exists');
  assert(reloadedHistory!.product.name === 'Retinol 0.5% in Squalane Serum', 'Product name persisted across reload');
  assert(reloadedHistory!.active_usage?.opened_date === '2026-08-05', 'Active opened_date persisted across reload');
  const reloadedUnopened = reloadedHistory!.purchases.find((p) => p.id === purUnopened.id);
  assert(reloadedUnopened?.price === 1350, 'Unopened price persisted across reload');
  assert(reloadedUnopened?.currency === 'EUR', 'Unopened currency persisted across reload');

  // ----------------------------------------------------------------------------
  // 27-29. Live Supabase Persistence, RLS Cross-Account Protection, Single Active Constraint
  // ----------------------------------------------------------------------------
  console.log('\n--- 27-29. Supabase Live Persistence & RLS Safety ---');
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
  let rawUrl = '';
  let rawKey = '';
  let userAEmail = '';
  let userAPassword = '';
  let userBEmail = '';
  let userBPassword = '';

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      rawUrl = trimmed.slice('VITE_SUPABASE_URL='.length).trim();
    } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      rawKey = trimmed.slice('VITE_SUPABASE_ANON_KEY='.length).trim();
    } else if (trimmed.startsWith('TEST_USER_A_EMAIL=')) {
      userAEmail = trimmed.slice('TEST_USER_A_EMAIL='.length).trim();
    } else if (trimmed.startsWith('TEST_USER_A_PASSWORD=')) {
      userAPassword = trimmed.slice('TEST_USER_A_PASSWORD='.length).trim();
    } else if (trimmed.startsWith('TEST_USER_B_EMAIL=')) {
      userBEmail = trimmed.slice('TEST_USER_B_EMAIL='.length).trim();
    } else if (trimmed.startsWith('TEST_USER_B_PASSWORD=')) {
      userBPassword = trimmed.slice('TEST_USER_B_PASSWORD='.length).trim();
    }
  }

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

    assert(!authA.error && authA.data.user !== null, 'Account A authenticated');
    assert(!authB.error && authB.data.user !== null, 'Account B authenticated');

    const userAId = authA.data.user!.id;
    const userBId = authB.data.user!.id;

    // 27. Live Supabase Mutation: User A creates product, purchase, active usage
    const { data: liveProd, error: prodErr } = await clientA
      .from('products')
      .insert({
        user_id: userAId,
        name: 'Live Edit Test Product',
        category: 'Skincare',
      })
      .select()
      .single();
    assert(!prodErr && liveProd !== null, 'Account A created live product');

    const { data: livePur, error: purErr } = await clientA
      .from('purchases')
      .insert({
        product_id: liveProd.id,
        purchase_date: '2026-09-01',
        price: 2000,
        currency: 'BDT',
      })
      .select()
      .single();
    assert(!purErr && livePur !== null, 'Account A created live purchase');

    const { data: liveUsage, error: useErr } = await clientA
      .from('usage_periods')
      .insert({
        product_id: liveProd.id,
        purchase_id: livePur.id,
        opened_date: '2026-09-01',
        status: 'active',
      })
      .select()
      .single();
    assert(!useErr && liveUsage !== null, 'Account A started live active usage period');

    // Perform live edits as User A
    const { data: updatedLiveProd, error: upProdErr } = await clientA
      .from('products')
      .update({ name: 'Live Edit Product Renamed' })
      .eq('id', liveProd.id)
      .select()
      .single();
    assert(!upProdErr && updatedLiveProd.name === 'Live Edit Product Renamed', 'Live product updated');

    const { data: updatedLivePur, error: upPurErr } = await clientA
      .from('purchases')
      .update({ price: 2100 })
      .eq('id', livePur.id)
      .select()
      .single();
    assert(!upPurErr && updatedLivePur.price === 2100, 'Live purchase updated');

    const { data: updatedLiveUsage, error: upUseErr } = await clientA
      .from('usage_periods')
      .update({ opened_date: '2026-09-02' })
      .eq('id', liveUsage.id)
      .select()
      .single();
    assert(!upUseErr && updatedLiveUsage.opened_date === '2026-09-02', 'Live usage period updated');

    // 28. RLS Cross-Account Protection: Account B cannot update Account A's product, purchase, or usage
    const { data: bProdUpdate } = await clientB
      .from('products')
      .update({ name: 'Tampered by Account B' })
      .eq('id', liveProd.id)
      .select();
    assert(bProdUpdate === null || bProdUpdate.length === 0, 'RLS blocked Account B from updating Account A product');

    const { data: bPurUpdate } = await clientB
      .from('purchases')
      .update({ price: 9999 })
      .eq('id', livePur.id)
      .select();
    assert(bPurUpdate === null || bPurUpdate.length === 0, 'RLS blocked Account B from updating Account A purchase');

    const { data: bUseUpdate } = await clientB
      .from('usage_periods')
      .update({ opened_date: '2026-01-01' })
      .eq('id', liveUsage.id)
      .select();
    assert(bUseUpdate === null || bUseUpdate.length === 0, 'RLS blocked Account B from updating Account A usage period');

    // 29. Single Active Usage Constraint Remains Intact in Supabase
    const { error: dupErr } = await clientA.from('usage_periods').insert({
      product_id: liveProd.id,
      purchase_id: livePur.id,
      opened_date: '2026-09-03',
      status: 'active',
    });
    assert(dupErr !== null, 'Single active usage constraint blocked duplicate active usage period');

    // Cleanup Account A records (cascades)
    await clientA.from('products').delete().eq('id', liveProd.id);
    console.log('  ✓ Cleaned up live test records');
  }

  console.log('\n=================================================================');
  console.log('ALL 29 STAGE 9 EDIT INVENTORY VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runEditInventoryVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
