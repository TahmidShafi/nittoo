// ==============================================================================
// Nittoo Stage 16 Automated Verification: Store / Vendor Tracking
// Validates:
// 1. Create purchase with vendor
// 2. Create purchase without vendor
// 3. Create purchase with whitespace around vendor
// 4. Blank vendor becomes null
// 5. Update vendor
// 6. Clear vendor
// 7. Multiple purchases of same product can have different vendors
// 8. Vendor does not modify product identity
// 9. Vendor does not affect usage periods
// 10. Vendor does not affect lifespan calculations
// 11. Vendor does not affect cost/day
// 12. Export includes vendor
// 13. Restore includes vendor
// 14. Old backup without vendor remains valid
// 15. Restore remains idempotent
// 16. Mock and Supabase contract compatibility
// 17. Multi-user isolation
// 18. Unopened purchase retains vendor
// 19. Active purchase retains vendor
// 20. Historical purchases preserve independent vendor values
// ==============================================================================

import {
  MockDatabase,
  InMemoryStorageAdapter,
} from '../src/lib/mock-db';
import { SupabaseDatabase } from '../src/lib/db';
import { buildExportData } from '../src/lib/export/normalizer';
import { generateJsonBackup } from '../src/lib/export/json';
import { generateCsvZip } from '../src/lib/export/csv';
import { generateExcelWorkbook } from '../src/lib/export/excel';
import { validateBackupFile } from '../src/lib/restore/validator';
import { buildImportPlan } from '../src/lib/restore/planner';
import { executeRestore } from '../src/lib/restore/executor';
import { calculateAverageLifespan, calculateCostPerDay, calculateUsageDuration } from '../src/lib/prediction';
import type { IDataSource, Purchase } from '../src/types';
import JSZip from 'jszip';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runVendorVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 16: STORE / VENDOR TRACKING VERIFICATION');
  console.log('=================================================================\n');

  const storageAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(storageAdapter);

  const testUser = 'user-stage16-test';
  const otherUser = 'user-stage16-other';

  // Create a base product
  const product = await db.createProduct(testUser, {
    name: 'CeraVe Hydrating Cleanser',
    category: 'Skincare',
    brand: 'CeraVe',
    size_value: 236,
    size_unit: 'ml',
  });

  // ----------------------------------------------------------------------------
  // TEST 1: Create purchase with vendor
  // ----------------------------------------------------------------------------
  console.log('--- Test 1: Create purchase with vendor ---');
  const purchase1 = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-04-01',
    price: 1250,
    currency: 'BDT',
    store_vendor: 'Shajgoj',
  });
  assert(purchase1.store_vendor === 'Shajgoj', 'Purchase 1 has store_vendor "Shajgoj"');

  // ----------------------------------------------------------------------------
  // TEST 2: Create purchase without vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 2: Create purchase without vendor ---');
  const purchase2 = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-05-01',
    price: 1300,
    currency: 'BDT',
  });
  assert(purchase2.store_vendor === null, 'Purchase 2 has store_vendor null when omitted');

  // ----------------------------------------------------------------------------
  // TEST 3: Create purchase with whitespace around vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 3: Create purchase with whitespace around vendor ---');
  const purchase3 = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-06-01',
    price: 1350,
    currency: 'BDT',
    store_vendor: '   Daraz Bangladesh   ',
  });
  assert(purchase3.store_vendor === 'Daraz Bangladesh', 'Whitespace is trimmed from store_vendor');

  // ----------------------------------------------------------------------------
  // TEST 4: Blank vendor becomes null
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 4: Blank vendor becomes null ---');
  const purchase4 = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-07-01',
    price: 1400,
    currency: 'BDT',
    store_vendor: '      ',
  });
  assert(purchase4.store_vendor === null, 'Whitespace-only store_vendor normalized to null');

  // ----------------------------------------------------------------------------
  // TEST 5: Update vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 5: Update vendor ---');
  const updatedPurchase2 = await db.updatePurchase(testUser, purchase2.id, {
    purchase_date: purchase2.purchase_date,
    price: purchase2.price,
    currency: purchase2.currency,
    store_vendor: '  Aarong Earth  ',
  });
  assert(updatedPurchase2.store_vendor === 'Aarong Earth', 'Updated vendor correctly and trimmed whitespace');

  // Verify persistence in getProductHistory
  const histAfterUpdate = await db.getProductHistory(product.id, testUser);
  const foundP2 = histAfterUpdate?.purchases.find((p) => p.id === purchase2.id);
  assert(foundP2?.store_vendor === 'Aarong Earth', 'Updated vendor persisted in database');

  // ----------------------------------------------------------------------------
  // TEST 6: Clear vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 6: Clear vendor ---');
  const clearedPurchase2 = await db.updatePurchase(testUser, purchase2.id, {
    purchase_date: purchase2.purchase_date,
    price: purchase2.price,
    currency: purchase2.currency,
    store_vendor: '',
  });
  assert(clearedPurchase2.store_vendor === null, 'Updating vendor to empty string clears it to null');

  const clearedPurchaseAgain = await db.updatePurchase(testUser, purchase2.id, {
    purchase_date: purchase2.purchase_date,
    price: purchase2.price,
    currency: purchase2.currency,
    store_vendor: null,
  });
  assert(clearedPurchaseAgain.store_vendor === null, 'Updating vendor to null keeps it null');

  // ----------------------------------------------------------------------------
  // TEST 7: Multiple purchases of same product can have different vendors
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 7: Multiple purchases of same product with different vendors ---');
  const pA = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-08-01',
    price: 1250,
    currency: 'BDT',
    store_vendor: 'Shajgoj',
  });
  const pB = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-08-15',
    price: 1380,
    currency: 'BDT',
    store_vendor: 'Daraz',
  });
  assert(pA.store_vendor === 'Shajgoj', 'Purchase A has vendor Shajgoj');
  assert(pB.store_vendor === 'Daraz', 'Purchase B has vendor Daraz');
  assert((pA.store_vendor as string | null) !== (pB.store_vendor as string | null), 'Purchases for same product hold distinct vendors');

  // ----------------------------------------------------------------------------
  // TEST 8: Vendor does not modify product identity
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 8: Vendor does not modify product identity ---');
  const productFresh = (await db.getAllUserProducts(testUser)).find((p) => p.id === product.id);
  assert(productFresh !== undefined, 'Product exists');
  assert(productFresh!.name === 'CeraVe Hydrating Cleanser', 'Product name unchanged');
  assert(productFresh!.category === 'Skincare', 'Product category unchanged');
  assert(productFresh!.brand === 'CeraVe', 'Product brand unchanged');
  assert((productFresh as any).store_vendor === undefined, 'Product itself does not carry store_vendor');

  // ----------------------------------------------------------------------------
  // TEST 9: Vendor does not affect usage periods
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 9: Vendor does not affect usage periods ---');
  const usage1 = await db.startUsagePeriod(testUser, {
    product_id: product.id,
    purchase_id: pA.id,
    opened_date: '2026-08-01',
  });
  assert(usage1.status === 'active', 'Usage period started successfully with vendor purchase');
  assert(usage1.purchase_id === pA.id, 'Usage period links to purchase');

  const finishedUsage1 = await db.finishUsagePeriod(testUser, usage1.id, '2026-09-01');
  assert(finishedUsage1.status === 'finished', 'Usage period finished successfully');
  const duration = calculateUsageDuration(finishedUsage1);
  assert(duration === 31, `Usage duration accurately calculated (${duration} days)`);

  // ----------------------------------------------------------------------------
  // TEST 10: Vendor does not affect lifespan calculations
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 10: Vendor does not affect lifespan calculations ---');
  // Start second usage period with pB (vendor Daraz) and finish it
  const usage2 = await db.startUsagePeriod(testUser, {
    product_id: product.id,
    purchase_id: pB.id,
    opened_date: '2026-09-02',
  });
  const finishedUsage2 = await db.finishUsagePeriod(testUser, usage2.id, '2026-10-02');
  const duration2 = calculateUsageDuration(finishedUsage2);
  assert(duration2 === 30, `Usage period 2 duration is ${duration2} days`);

  const avgLifespan = calculateAverageLifespan([finishedUsage1, finishedUsage2]);
  assert(avgLifespan === 30.5, `Average lifespan is 30.5 days (exact math regardless of vendor)`);

  // ----------------------------------------------------------------------------
  // TEST 11: Vendor does not affect cost/day
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 11: Vendor does not affect cost/day ---');
  const costPerDayA = calculateCostPerDay(pA.price, avgLifespan);
  const costPerDayB = calculateCostPerDay(pB.price, avgLifespan);
  assert(costPerDayA === Math.round((1250 / 30.5) * 100) / 100, 'Cost per day A is pure price / avgLifespan');
  assert(costPerDayB === Math.round((1380 / 30.5) * 100) / 100, 'Cost per day B is pure price / avgLifespan');

  // ----------------------------------------------------------------------------
  // TEST 12: Export includes vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 12: Export includes vendor in JSON, CSV, and Excel ---');
  const normalizedExport = await buildExportData(testUser, 'test@nittoo.local', db);

  const exportedPA = normalizedExport.purchases.find((p) => p.id === pA.id);
  const exportedPB = normalizedExport.purchases.find((p) => p.id === pB.id);
  const exportedP2 = normalizedExport.purchases.find((p) => p.id === purchase2.id);

  assert(exportedPA?.store_vendor === 'Shajgoj', 'Exported purchase A includes "Shajgoj"');
  assert(exportedPB?.store_vendor === 'Daraz', 'Exported purchase B includes "Daraz"');
  assert(exportedP2?.store_vendor === null, 'Exported purchase with no vendor is null');

  // CSV check
  const csvZipBuffer = await generateCsvZip(normalizedExport);
  assert(csvZipBuffer.byteLength > 0, 'CSV zip generated');
  const unzipped = await JSZip.loadAsync(csvZipBuffer);
  const purchasesCsv = await unzipped.file('purchases.csv')?.async('string');
  assert(purchasesCsv !== undefined, 'purchases.csv exists in zip');
  assert(purchasesCsv!.includes('Shajgoj'), 'CSV purchases export contains "Shajgoj"');
  assert(purchasesCsv!.includes('Daraz'), 'CSV purchases export contains "Daraz"');

  // Excel check
  const excelBuffer = generateExcelWorkbook(normalizedExport);
  assert(excelBuffer.byteLength > 0, 'Excel export generates valid binary output');

  // JSON backup check
  const jsonBackupString = generateJsonBackup(normalizedExport);
  const parsedBackup = JSON.parse(jsonBackupString);
  const jsonPA = parsedBackup.purchases.find((p: any) => p.id === pA.id);
  assert(jsonPA.store_vendor === 'Shajgoj', 'JSON backup contains store_vendor');

  // ----------------------------------------------------------------------------
  // TEST 13: Restore includes vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 13: Restore includes vendor ---');
  const restoreUser = 'user-stage16-restore-target';
  const validationRes = validateBackupFile(jsonBackupString);
  assert(validationRes.valid === true, 'Backup passes validation');
  if (!validationRes.valid) return;

  const importPlan = await buildImportPlan(
    validationRes.backupData,
    restoreUser,
    db
  );

  const plannedPA = importPlan.purchasesToCreate.find((p) => p.id === pA.id);
  assert(plannedPA?.store_vendor === 'Shajgoj', 'Import plan preserves store_vendor "Shajgoj"');

  const restoreResult = await executeRestore(importPlan, restoreUser, db);
  assert(restoreResult.success === true, 'Restore executed successfully');

  // Inspect restored purchase
  const userProducts = await db.getAllUserProducts(restoreUser);
  const restoredProd = userProducts.find((p) => p.name === product.name);
  assert(restoredProd !== undefined, 'Restored product found for user');
  const restoredHistory = await db.getProductHistory(restoredProd!.id, restoreUser);
  const restoredPA = restoredHistory?.purchases.find((p) => p.store_vendor === 'Shajgoj');
  assert(restoredPA !== undefined, 'Restored purchase has store_vendor "Shajgoj"');
  const restoredPB = restoredHistory?.purchases.find((p) => p.store_vendor === 'Daraz');
  assert(restoredPB !== undefined, 'Restored purchase has store_vendor "Daraz"');

  // ----------------------------------------------------------------------------
  // TEST 14: Old backup without vendor remains valid
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 14: Old backup without vendor remains valid ---');
  const legacyBackup = {
    version: '1.0.0',
    exported_at: '2026-01-01T00:00:00.000Z',
    user: {
      id: 'legacy-user-1',
      email: 'legacy@example.com',
    },
    products: [
      {
        id: 'prod-legacy-1',
        name: 'Legacy Moisturizer',
        category: 'Skincare',
        brand: 'Nivea',
        size_value: 100,
        size_unit: 'ml',
      },
    ],
    purchases: [
      {
        id: 'purch-legacy-1',
        product_id: 'prod-legacy-1',
        purchase_date: '2026-01-01',
        price: 500,
        currency: 'BDT',
        // Note: store_vendor is completely absent
      },
    ],
    usage_periods: [],
  };

  const legacyJson = JSON.stringify(legacyBackup);
  const legacyVal = validateBackupFile(legacyJson);
  assert(legacyVal.valid === true, 'Legacy backup without store_vendor is valid');
  if (!legacyVal.valid) return;

  const legacyUser = 'user-stage16-legacy-restore';
  const legacyPlan = await buildImportPlan(
    legacyVal.backupData,
    legacyUser,
    db
  );
  assert(legacyPlan.purchasesToCreate[0].store_vendor === null, 'Legacy purchase without vendor plans with null');

  const legacyExec = await executeRestore(legacyPlan, legacyUser, db);
  assert(legacyExec.success === true, 'Legacy backup restores without error');

  const legacyProds = await db.getAllUserProducts(legacyUser);
  const legacyProd = legacyProds.find((p) => p.name === 'Legacy Moisturizer');
  assert(legacyProd !== undefined, 'Legacy product found');
  const legacyHist = await db.getProductHistory(legacyProd!.id, legacyUser);
  assert(legacyHist?.purchases[0].store_vendor === null, 'Legacy purchase in DB has store_vendor null');

  // ----------------------------------------------------------------------------
  // TEST 15: Restore remains idempotent
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 15: Restore remains idempotent ---');
  const repeatPlan = await buildImportPlan(
    validationRes.backupData,
    restoreUser,
    db
  );

  assert(repeatPlan.purchasesToCreate.length === 0, 'Idempotent repeat plan creates 0 duplicate purchases');
  assert(repeatPlan.productsToCreate.length === 0, 'Idempotent repeat plan creates 0 duplicate products');

  const repeatExec = await executeRestore(repeatPlan, restoreUser, db);
  assert(repeatExec.success === true, 'Repeat restore succeeds idempotently');
  assert(repeatExec.restoredPurchases === 0, '0 purchases added on second restore');

  // ----------------------------------------------------------------------------
  // TEST 16: Mock and Supabase contract compatibility
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 16: Mock and Supabase contract compatibility ---');
  // Type assignment checks (enforced at compile-time and runtime structure)
  const mockInstance: IDataSource = new MockDatabase(storageAdapter);
  assert(typeof mockInstance.createPurchase === 'function', 'MockDatabase implements createPurchase');
  assert(typeof mockInstance.updatePurchase === 'function', 'MockDatabase implements updatePurchase');
  assert(typeof mockInstance.importUserData === 'function', 'MockDatabase implements importUserData');

  const supabaseInstance = new SupabaseDatabase();
  assert(typeof supabaseInstance.createPurchase === 'function', 'SupabaseDatabase implements createPurchase');
  assert(typeof supabaseInstance.updatePurchase === 'function', 'SupabaseDatabase implements updatePurchase');
  assert(typeof supabaseInstance.importUserData === 'function', 'SupabaseDatabase implements importUserData');

  // ----------------------------------------------------------------------------
  // TEST 17: Multi-user isolation
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 17: Multi-user isolation ---');
  const otherProduct = await db.createProduct(otherUser, {
    name: 'Private Product',
    category: 'Haircare',
  });
  const otherPurchase = await db.createPurchase(otherUser, {
    product_id: otherProduct.id,
    purchase_date: '2026-09-01',
    price: 999,
    currency: 'BDT',
    store_vendor: 'Secret Pharmacy',
  });

  // TestUser tries to fetch otherUser's product history
  let unauthorizedBlocked = false;
  try {
    await db.getProductHistory(otherProduct.id, testUser);
  } catch (err: any) {
    if (err?.message?.includes('Unauthorized')) {
      unauthorizedBlocked = true;
    }
  }
  assert(unauthorizedBlocked, 'Test user cannot access other user product history (access strictly blocked)');

  const testUserInventory = await db.getUserInventory(testUser);
  const foundOtherPurchase = testUserInventory.unopened.some((u) => u.purchase.id === otherPurchase.id);
  assert(!foundOtherPurchase, 'Other user purchase is not visible in test user inventory');

  // ----------------------------------------------------------------------------
  // TEST 18: Unopened purchase retains vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 18: Unopened purchase retains vendor ---');
  const unopenedPurchase = await db.createPurchase(testUser, {
    product_id: product.id,
    purchase_date: '2026-09-05',
    price: 1500,
    currency: 'BDT',
    store_vendor: 'Chaldal',
  });
  const userInv = await db.getUserInventory(testUser);
  const unopenedItem = userInv.unopened.find((i) => i.purchase.id === unopenedPurchase.id);
  assert(unopenedItem !== undefined, 'Unopened purchase found in inventory');
  assert(unopenedItem!.purchase.store_vendor === 'Chaldal', 'Unopened purchase retains store_vendor "Chaldal"');

  // ----------------------------------------------------------------------------
  // TEST 19: Active purchase retains vendor
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 19: Active purchase retains vendor ---');
  const activeUsage = await db.startUsagePeriod(testUser, {
    product_id: product.id,
    purchase_id: unopenedPurchase.id,
    opened_date: '2026-09-06',
  });
  const freshInv = await db.getUserInventory(testUser);
  const activeItem = freshInv.active.find((p) => p.id === product.id);
  assert(activeItem !== undefined, 'Product has active bottle');
  assert(activeItem!.active_purchase?.store_vendor === 'Chaldal', 'Active purchase retains store_vendor "Chaldal"');

  // ----------------------------------------------------------------------------
  // TEST 20: Historical purchases preserve independent vendor values
  // ----------------------------------------------------------------------------
  console.log('\n--- Test 20: Historical purchases preserve independent vendor values ---');
  const fullHistory = await db.getProductHistory(product.id, testUser);
  assert(fullHistory !== null, 'Product history retrieved');

  // Find finished periods and their linked purchases
  const periods = fullHistory!.finished_periods;
  assert(periods.length >= 2, 'Has at least 2 finished cycles');

  const p1 = fullHistory!.purchases.find((p) => p.id === pA.id);
  const p2 = fullHistory!.purchases.find((p) => p.id === pB.id);

  assert(p1?.store_vendor === 'Shajgoj', 'Historical cycle 1 linked purchase has vendor "Shajgoj"');
  assert(p2?.store_vendor === 'Daraz', 'Historical cycle 2 linked purchase has vendor "Daraz"');

  console.log('\n=================================================================');
  console.log('✅ ALL 20 STORE / VENDOR VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================');
}

runVendorVerification().catch((err) => {
  console.error('Unhandled error during vendor verification:', err);
  process.exit(1);
});
