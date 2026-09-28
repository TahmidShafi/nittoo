// ==============================================================================
// Nittoo Stage 17 Automated Verification:
// Historical Finished Usage-Cycle Editing, Deletion, and Mathematical Invariance
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
} from '../src/lib/mock-db';
import {
  calculateAverageLifespan,
  calculateUsageDuration,
  calculateCostPerDay,
  calculatePredictedRemainingDays,
  calculateCurrentDaysUsed,
} from '../src/lib/prediction';
import { calculateConfidence } from '../src/lib/confidence';
import { dataCache } from '../src/lib/dataCache';
import { buildExportData } from '../src/lib/export/normalizer';
import { addDays, getTodayUTC } from '../src/lib/dateUtils';
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

async function runStage17Verification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 17: HISTORICAL FINISHED CYCLE EDITING & DELETION AUDIT');
  console.log('=================================================================\n');

  const storageAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(storageAdapter);

  const userA = 'user-history-alice-101';
  const userB = 'user-history-bob-202';
  const today = getTodayUTC();

  // ----------------------------------------------------------------------------
  // SECTION 1: Product Setup with Multiple Historical Cycles and Vendor Metadata
  // ----------------------------------------------------------------------------
  console.log('--- 1. Setting up Product with Purchases and Completed Cycles ---');

  const product = await db.createProduct(userA, {
    name: 'CeraVe Hydrating Cleanser',
    category: 'Skincare',
    brand: 'CeraVe',
    size_value: 236,
    size_unit: 'ml',
  });
  assert(Boolean(product.id), 'Product created for User A');

  // Purchase 1: 60 days cycle with Daraz vendor
  const pur1 = await db.createPurchase(userA, {
    product_id: product.id,
    purchase_date: '2026-01-01',
    price: 1200,
    currency: 'BDT',
    store_vendor: 'Daraz',
  });
  const use1 = await db.startUsagePeriod(userA, {
    product_id: product.id,
    purchase_id: pur1.id,
    opened_date: '2026-01-01',
  });
  const fin1 = await db.finishUsagePeriod(userA, use1.id, '2026-03-02'); // 60 days

  // Purchase 2: 62 days cycle with Shajgoj vendor
  const pur2 = await db.createPurchase(userA, {
    product_id: product.id,
    purchase_date: '2026-03-03',
    price: 1240,
    currency: 'BDT',
    store_vendor: 'Shajgoj',
  });
  const use2 = await db.startUsagePeriod(userA, {
    product_id: product.id,
    purchase_id: pur2.id,
    opened_date: '2026-03-03',
  });
  const fin2 = await db.finishUsagePeriod(userA, use2.id, '2026-05-04'); // 62 days

  // Purchase 3: 58 days cycle with Aster Pharmacy vendor
  const pur3 = await db.createPurchase(userA, {
    product_id: product.id,
    purchase_date: '2026-05-05',
    price: 1160,
    currency: 'BDT',
    store_vendor: 'Aster Pharmacy',
  });
  const use3 = await db.startUsagePeriod(userA, {
    product_id: product.id,
    purchase_id: pur3.id,
    opened_date: '2026-05-05',
  });
  const fin3 = await db.finishUsagePeriod(userA, use3.id, '2026-07-02'); // 58 days

  // Purchase 4: Currently active bottle
  const pur4 = await db.createPurchase(userA, {
    product_id: product.id,
    purchase_date: '2026-07-03',
    price: 1300,
    currency: 'BDT',
    store_vendor: 'Local Superstore',
  });
  const use4 = await db.startUsagePeriod(userA, {
    product_id: product.id,
    purchase_id: pur4.id,
    opened_date: '2026-07-03',
  });
  assert(use4.status === 'active', 'Cycle 4 is actively in use');

  // Verify initial state
  const initialHistory = await db.getProductHistory(product.id, userA);
  assert(initialHistory !== null, 'Product history retrieved');
  assert(initialHistory!.finished_periods.length === 3, 'Initial finished cycle count is 3');
  assert(initialHistory!.active_usage !== null, 'Active usage period exists');

  // Verify baseline math (Phase 19 fixture: 60, 62, 58 -> Average = 60.0)
  const d1 = calculateUsageDuration(fin1);
  const d2 = calculateUsageDuration(fin2);
  const d3 = calculateUsageDuration(fin3);
  assert(d1 === 60, `Cycle 1 duration is 60 days (got ${d1})`);
  assert(d2 === 62, `Cycle 2 duration is 62 days (got ${d2})`);
  assert(d3 === 58, `Cycle 3 duration is 58 days (got ${d3})`);

  const initialAvg = calculateAverageLifespan(initialHistory!.finished_periods);
  assert(initialAvg === 60, `Initial average lifespan is exactly 60 days (got ${initialAvg})`);

  const initialConfidence = calculateConfidence(initialHistory!.finished_periods.length);
  assert(initialConfidence.state === 'developing', `Initial confidence is developing (got ${initialConfidence.state})`);

  // ----------------------------------------------------------------------------
  // SECTION 2: Safe Historical Edit Validation Guards
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Validating Historical Edit Date Rules ---');

  // 4. Invalid date range rejected (finished < opened)
  await assertRejects(
    db.updateUsagePeriod(userA, fin3.id, {
      opened_date: '2026-05-10',
      finished_date: '2026-05-01',
    }),
    'earlier than opened date',
    'Reject finished date earlier than opened date'
  );

  // 5. Future opened date rejected
  const futureDate = addDays(today, 5);
  await assertRejects(
    db.updateUsagePeriod(userA, fin3.id, {
      opened_date: futureDate,
      finished_date: futureDate,
    }),
    'cannot be in the future',
    'Reject future opened date'
  );

  // 6. Future finished date rejected
  await assertRejects(
    db.updateUsagePeriod(userA, fin3.id, {
      opened_date: '2026-05-05',
      finished_date: futureDate,
    }),
    'cannot be in the future',
    'Reject future finished date'
  );

  // 7. Active cycle cannot be deleted through deleteUsagePeriod
  await assertRejects(
    db.deleteUsagePeriod(userA, use4.id),
    'only completed cycles can be deleted',
    'Reject deleting active usage period'
  );

  // ----------------------------------------------------------------------------
  // SECTION 3: Phase 19 Mathematical Invariance — Edit Cycle 3 (58 -> 70 days)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Testing Historical Edit & Mathematical Recalculation ---');

  // 1, 2, 3. Finished cycle can be edited; opened and finished dates update
  // Change fin3 from 2026-05-05 -> 2026-07-02 (58d) to 2026-05-05 -> 2026-07-14 (70d)
  const updatedCycle3 = await db.updateUsagePeriod(userA, fin3.id, {
    opened_date: '2026-05-05',
    finished_date: '2026-07-14',
  });

  assert(updatedCycle3.opened_date === '2026-05-05', 'Opened date preserved / updated correctly');
  assert(updatedCycle3.finished_date === '2026-07-14', 'Finished date updated to 2026-07-14');
  assert(updatedCycle3.status === 'finished', 'Status strictly preserved as finished');

  const historyAfterEdit = await db.getProductHistory(product.id, userA);
  const newAvgAfterEdit = calculateAverageLifespan(historyAfterEdit!.finished_periods);
  // (60 + 62 + 70) / 3 = 192 / 3 = 64.0
  assert(newAvgAfterEdit === 64, `Recalculated average lifespan after edit is 64.0 days (got ${newAvgAfterEdit})`);

  // Verify active product prediction recalculates with new average
  const daysUsed = calculateCurrentDaysUsed(use4.opened_date, '2026-08-01'); // 29 days
  const predictedRemaining = calculatePredictedRemainingDays(newAvgAfterEdit, daysUsed);
  assert(predictedRemaining === 35, `Predicted remaining days recalculates to 35 (64 - 29 = 35, got ${predictedRemaining})`);

  // ----------------------------------------------------------------------------
  // SECTION 4: Phase 19 Mathematical Invariance — Delete Cycle 2 (62 days)
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Testing Historical Delete & Purchase Preservation ---');

  // 8. Finished cycle can be deleted
  const deletedCycle2 = await db.deleteUsagePeriod(userA, fin2.id);
  assert(deletedCycle2.id === fin2.id, 'Cycle 2 returned as deleted');

  // 9. Associated purchase pur2 is preserved in purchases table
  const historyAfterDel = await db.getProductHistory(product.id, userA);
  assert(historyAfterDel !== null, 'History retrievable after deletion');
  const foundPur2 = historyAfterDel!.purchases.find((p) => p.id === pur2.id);
  assert(Boolean(foundPur2), 'Associated purchase pur2 is strictly preserved after usage deletion');

  // 22. Vendor metadata remains associated with the purchase
  assert(foundPur2!.store_vendor === 'Shajgoj', `Purchase store_vendor is preserved as Shajgoj (got ${foundPur2?.store_vendor})`);

  // 10. Product record is preserved
  assert(historyAfterDel!.product.id === product.id, 'Product record is strictly preserved');

  // 24. Deleting one cycle does not delete another
  assert(historyAfterDel!.finished_periods.length === 2, `Finished period count decreased from 3 to 2 (got ${historyAfterDel!.finished_periods.length})`);
  assert(historyAfterDel!.finished_periods.some((p) => p.id === fin1.id), 'Cycle 1 remains intact');
  assert(historyAfterDel!.finished_periods.some((p) => p.id === fin3.id), 'Cycle 3 remains intact');

  // Mathematical invariance: (60 + 70) / 2 = 65.0
  const avgAfterDel = calculateAverageLifespan(historyAfterDel!.finished_periods);
  assert(avgAfterDel === 65, `Recalculated average lifespan after deleting Cycle 2 is 65.0 days (got ${avgAfterDel})`);

  // 12. Cost per day recalculates
  const costPerDay1 = calculateCostPerDay(pur1.price, 60);
  assert(costPerDay1 === 20, `Cycle 1 cost per day is 20 BDT/day (1200 / 60, got ${costPerDay1})`);

  // 13. Confidence recalculates
  const confidenceAfterDel = calculateConfidence(historyAfterDel!.finished_periods.length);
  assert(confidenceAfterDel.completedCycles === 2, 'Confidence report reflects 2 completed cycles');
  assert(confidenceAfterDel.state === 'developing', 'Confidence state is developing for 2 cycles');

  // ----------------------------------------------------------------------------
  // SECTION 5: Deleting All Completed Cycles -> Zero-Cycle State
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Testing Zero-Cycle State After Deleting All Completed Cycles ---');

  // Delete Cycle 1 and Cycle 3
  await db.deleteUsagePeriod(userA, fin1.id);
  await db.deleteUsagePeriod(userA, fin3.id);

  const historyZeroCycles = await db.getProductHistory(product.id, userA);
  assert(historyZeroCycles!.finished_periods.length === 0, 'Zero completed cycles remain');

  // 15. Zero-cycle state returns null prediction and no_data confidence
  const zeroAvg = calculateAverageLifespan(historyZeroCycles!.finished_periods);
  assert(zeroAvg === null, 'Average lifespan returns null ("Not enough data") when 0 completed cycles');

  const zeroPrediction = calculatePredictedRemainingDays(zeroAvg, 10);
  assert(zeroPrediction === null, 'Predicted remaining days returns null when average lifespan is null');

  const zeroConfidence = calculateConfidence(historyZeroCycles!.finished_periods.length);
  assert(zeroConfidence.state === 'no_data', `Confidence state returns 'no_data' (got ${zeroConfidence.state})`);
  assert(zeroConfidence.label === 'Not enough data', `Confidence label is 'Not enough data' (got ${zeroConfidence.label})`);

  // All 4 purchases are still preserved!
  assert(historyZeroCycles!.purchases.length === 4, `All 4 purchases remain preserved (got ${historyZeroCycles!.purchases.length})`);

  // Pur 1, 2, 3 now appear in unopened purchases because they have no linked usage period!
  assert(historyZeroCycles!.unopened_purchases.length === 3, `3 purchases now returned to unopened state (got ${historyZeroCycles!.unopened_purchases.length})`);
  assert(historyZeroCycles!.active_usage !== null, 'Active usage period remains active and protected');

  // ----------------------------------------------------------------------------
  // SECTION 6: SWR Cache Invalidation Verification
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Verifying SWR In-Memory Cache Invalidation ---');

  // Populate cache entries for userA
  dataCache.clearAll();
  dataCache.set(userA, 'dashboard', { dummy: 'dashboard-data' });
  dataCache.set(userA, 'inventory', { dummy: 'inventory-data' });
  dataCache.set(userA, 'analytics', { dummy: 'analytics-data' });
  dataCache.set(userA, `product:${product.id}`, { dummy: 'product-data' });
  dataCache.set(userA, dataCache.getComparisonKey(product.id, 'other-product-id'), { dummy: 'comparison-data' });
  dataCache.set(userA, 'all-products', { dummy: 'all-products-data' });

  assert(dataCache.has(userA, 'dashboard'), 'Dashboard is cached');
  assert(dataCache.has(userA, `product:${product.id}`), 'Product detail is cached');
  assert(dataCache.has(userA, dataCache.getComparisonKey(product.id, 'other-product-id')), 'Comparison is cached');

  // Invalidate product
  dataCache.invalidateProduct(userA, product.id);

  assert(!dataCache.has(userA, 'dashboard'), 'Dashboard cache invalidated');
  assert(!dataCache.has(userA, 'inventory'), 'Inventory cache invalidated');
  assert(!dataCache.has(userA, 'analytics'), 'Analytics cache invalidated');
  assert(!dataCache.has(userA, 'all-products'), 'All-products cache invalidated');
  assert(!dataCache.has(userA, `product:${product.id}`), 'Product detail cache invalidated');
  assert(!dataCache.has(userA, dataCache.getComparisonKey(product.id, 'other-product-id')), 'Comparison cache invalidated');

  // ----------------------------------------------------------------------------
  // SECTION 7: Multi-User Security & Isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Verifying Multi-User Security and Ownership Enforcement ---');

  // Create product and completed cycle for User B
  const productB = await db.createProduct(userB, {
    name: 'Kérastase Shampoo',
    category: 'Haircare',
  });
  const purB = await db.createPurchase(userB, {
    product_id: productB.id,
    purchase_date: '2026-06-01',
    price: 3000,
  });
  const useB = await db.startUsagePeriod(userB, {
    product_id: productB.id,
    purchase_id: purB.id,
    opened_date: '2026-06-01',
  });
  const finB = await db.finishUsagePeriod(userB, useB.id, '2026-07-15');

  // User A attempts to edit User B's completed cycle
  await assertRejects(
    db.updateUsagePeriod(userA, finB.id, {
      opened_date: '2026-06-01',
      finished_date: '2026-07-20',
    }),
    'unauthorized',
    'User A cannot edit User B historical cycle'
  );

  // User A attempts to delete User B's completed cycle
  await assertRejects(
    db.deleteUsagePeriod(userA, finB.id),
    'unauthorized',
    'User A cannot delete User B historical cycle'
  );

  // User B can edit their own cycle
  const userBEdited = await db.updateUsagePeriod(userB, finB.id, {
    opened_date: '2026-06-05',
    finished_date: '2026-07-20',
  });
  assert(userBEdited.opened_date === '2026-06-05', 'User B successfully edited own historical cycle');

  // User B can delete their own cycle
  const userBDeleted = await db.deleteUsagePeriod(userB, finB.id);
  assert(userBDeleted.id === finB.id, 'User B successfully deleted own historical cycle');

  // ----------------------------------------------------------------------------
  // SECTION 8: Export and Restore Compatibility
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Verifying Export and Restore Compatibility ---');

  // Create a dedicated product for export verification
  const exportProd = await db.createProduct(userA, {
    name: 'Bioderma Micellar Water',
    category: 'Skincare',
  });

  const newUsePur = await db.createPurchase(userA, {
    product_id: exportProd.id,
    purchase_date: '2026-08-01',
    price: 1500,
    store_vendor: 'TestVendor1',
  });
  const newUse = await db.startUsagePeriod(userA, {
    product_id: exportProd.id,
    purchase_id: newUsePur.id,
    opened_date: '2026-08-01',
  });
  const newFin = await db.finishUsagePeriod(userA, newUse.id, '2026-08-25');

  const exportBefore = await buildExportData(userA, 'alice@example.com', db);
  const foundExportCycle = exportBefore.usage_history.find((u) => u.id === newFin.id);
  assert(Boolean(foundExportCycle), 'Export includes newly created completed cycle');
  assert(foundExportCycle?.days_used === 24, `Export shows correct duration of 24 days (got ${foundExportCycle?.days_used})`);

  // Edit the cycle to 30 days
  await db.updateUsagePeriod(userA, newFin.id, {
    opened_date: '2026-08-01',
    finished_date: '2026-08-31',
  });

  const exportAfterEdit = await buildExportData(userA, 'alice@example.com', db);
  const foundExportCycleEdited = exportAfterEdit.usage_history.find((u) => u.id === newFin.id);
  assert(foundExportCycleEdited?.finished_date === '2026-08-31', 'Export reflects edited finished date');
  assert(foundExportCycleEdited?.days_used === 30, `Export reflects edited duration of 30 days (got ${foundExportCycleEdited?.days_used})`);

  // Delete the cycle
  await db.deleteUsagePeriod(userA, newFin.id);

  const exportAfterDelete = await buildExportData(userA, 'alice@example.com', db);
  const foundExportCycleDeleted = exportAfterDelete.usage_history.find((u) => u.id === newFin.id);
  assert(!foundExportCycleDeleted, 'Export no longer contains the deleted historical cycle');
  // Purchase is preserved and now in export purchases
  const exportPurPreserved = exportAfterDelete.purchases.find((p) => p.id === newUsePur.id);
  assert(Boolean(exportPurPreserved), 'Purchase remains present in export after cycle deletion');
  assert(exportPurPreserved?.store_vendor === 'TestVendor1', 'Vendor remains attached to purchase in export');

  // ----------------------------------------------------------------------------
  // SECTION 9: Schema & RLS Policy Verification
  // ----------------------------------------------------------------------------
  console.log('\n--- 9. Verifying Database Schema and RLS Policies ---');

  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert(
    schemaContent.includes('CREATE POLICY "Users can update usage periods of own products"'),
    'Schema includes UPDATE RLS policy for usage_periods'
  );
  assert(
    schemaContent.includes('CREATE POLICY "Users can delete usage periods of own products"'),
    'Schema includes DELETE RLS policy for usage_periods'
  );
  assert(
    schemaContent.includes('chk_finished_date_valid CHECK (finished_date IS NULL OR finished_date >= opened_date)'),
    'Schema enforces finished_date >= opened_date check constraint'
  );
  assert(
    schemaContent.includes('idx_usage_periods_single_active'),
    'Schema enforces single active bottle constraint'
  );

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 17 HISTORICAL CYCLE EDIT & DELETE CHECKS PASSED!');
  console.log('=================================================================\n');
}

runStage17Verification().catch((err) => {
  console.error('Fatal error during Stage 17 verification:', err);
  process.exit(1);
});
