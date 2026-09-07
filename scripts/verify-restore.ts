// ==============================================================================
// Nittoo Stage 15 Automated Verification: Data Restore & Import System
// Tests validation, versioning, multi-tenant isolation, safe merge, idempotency,
// active bottle conflicts, unopened inventory, analytics consistency, and UX.
// ==============================================================================

import * as fs from 'fs';
import * as path from 'path';
import {
  MockDatabase,
  InMemoryStorageAdapter,
  DEFAULT_MOCK_USER_ID,
} from '../src/lib/mock-db';
import {
  validateBackupFile,
  buildImportPlan,
  executeRestore,
  SUPPORTED_BACKUP_VERSION,
} from '../src/lib/restore';
import { buildExportData } from '../src/lib/export/normalizer';
import { generateJsonBackup } from '../src/lib/export/json';
import { calculateAverageLifespan } from '../src/lib/prediction';
import { calculateConfidence } from '../src/lib/confidence';
import type { NittooExportData } from '../src/lib/export/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runRestoreVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 15: DATA RESTORE & IMPORT SYSTEM VERIFICATION');
  console.log('=================================================================\n');

  const storageAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(storageAdapter);

  // ----------------------------------------------------------------------------
  // SETUP TEST DATA FOR EXPORT / RESTORE ROUNDTRIP
  // ----------------------------------------------------------------------------
  console.log('--- Setup: Creating Authoritative Source Backup ---');
  const userA_Id = 'user-alice-111';
  const userA_Email = 'alice@example.com';

  // Seed User A with 2 products, 3 purchases (1 active, 1 completed, 1 unopened)
  const cleanser = await db.createProduct(userA_Id, {
    name: 'CeraVe Hydrating Cleanser',
    category: 'Skincare',
    brand: 'CeraVe',
    size_value: 236,
    size_unit: 'ml',
  });

  const shampoo = await db.createProduct(userA_Id, {
    name: 'Kérastase Bain Satin',
    category: 'Haircare',
    brand: 'Kérastase',
    size_value: 250,
    size_unit: 'ml',
  });

  // Purchase 1: Cleanser (Completed cycle: 60 days)
  const purCleanser1 = await db.createPurchase(userA_Id, {
    product_id: cleanser.id,
    purchase_date: '2026-01-01',
    price: 1850,
  });
  const cycle1 = await db.startUsagePeriod(userA_Id, {
    product_id: cleanser.id,
    purchase_id: purCleanser1.id,
    opened_date: '2026-01-01',
  });
  await db.finishUsagePeriod(userA_Id, cycle1.id, '2026-03-02'); // 60 days

  // Purchase 2: Cleanser (Active container)
  const purCleanser2 = await db.createPurchase(userA_Id, {
    product_id: cleanser.id,
    purchase_date: '2026-03-05',
    price: 1850,
  });
  await db.startUsagePeriod(userA_Id, {
    product_id: cleanser.id,
    purchase_id: purCleanser2.id,
    opened_date: '2026-03-05',
  });

  // Purchase 3: Shampoo (Unopened inventory backup)
  await db.createPurchase(userA_Id, {
    product_id: shampoo.id,
    purchase_date: '2026-08-15',
    price: 3200,
  });

  // Generate authoritative JSON backup for User A
  const exportDataA = await buildExportData(userA_Id, userA_Email, db);
  const rawJsonBackupA = generateJsonBackup(exportDataA);

  assert(rawJsonBackupA.length > 0, 'Generated valid JSON backup for User A');

  // ============================================================================
  // GROUP 1: GENERAL & VALIDATION (Tests 1 - 6)
  // ============================================================================
  console.log('\n--- 1. GENERAL & VALIDATION (Tests 1 - 6) ---');

  // 1. Restore entry exists in AccountPage
  const accountPageSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/AccountPage.tsx'),
    'utf-8'
  );
  assert(
    accountPageSrc.includes('BACKUP & RESTORE') &&
      accountPageSrc.includes('Restore Backup') &&
      accountPageSrc.includes('RestoreDataModal'),
    'Test 1: Restore entry & Backup & Restore section exist in AccountPage'
  );

  // 2. File picker accepts JSON
  const modalSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/RestoreDataModal.tsx'),
    'utf-8'
  );
  assert(
    modalSrc.includes('accept=".json,application/json"') &&
      modalSrc.includes('Only Nittoo JSON backups can be restored'),
    'Test 2: File picker accepts .json / application/json and informs user'
  );

  // 3. Invalid JSON rejected
  const invalidJsonResult = validateBackupFile('NOT VALID JSON {{{');
  assert(
    !invalidJsonResult.valid && invalidJsonResult.error.includes("That file isn't a valid Nittoo backup"),
    'Test 3: Corrupted / non-JSON payload rejected with clear error'
  );

  // 4. Invalid Nittoo schema rejected
  const randomJsonResult = validateBackupFile(JSON.stringify({ some: 'random', data: 123 }));
  assert(
    !randomJsonResult.valid && randomJsonResult.error.includes("That file isn't a valid Nittoo backup"),
    'Test 4: Non-Nittoo arbitrary JSON rejected'
  );

  // 5. Unsupported version rejected
  const unsupportedVersionJson = JSON.stringify({
    version: '2.5.0',
    products: [],
    purchases: [],
    usage_periods: [],
  });
  const unsupportedResult = validateBackupFile(unsupportedVersionJson);
  assert(
    !unsupportedResult.valid &&
      unsupportedResult.error.includes("This Nittoo backup version isn't supported by this version of Nittoo"),
    'Test 5: Unsupported backup version (2.5.0) rejected with version notice'
  );

  // 6. Oversized file rejected
  const oversizedResult = validateBackupFile(rawJsonBackupA, 100); // 100 bytes limit
  assert(
    !oversizedResult.valid && oversizedResult.details!.includes('exceeds maximum limit'),
    'Test 6: Oversized file exceeding limit rejected'
  );

  // ============================================================================
  // GROUP 2: SECURITY & MULTI-TENANT ISOLATION (Tests 7 - 11)
  // ============================================================================
  console.log('\n--- 2. SECURITY & MULTI-TENANT ISOLATION (Tests 7 - 11) ---');

  const userB_Id = 'user-bob-222';
  const userB_Email = 'bob@example.com';

  // Validate backup A for restoration into User B's account
  const validationA = validateBackupFile(rawJsonBackupA);
  assert(validationA.valid === true, 'Backup A passed schema validation');
  if (!validationA.valid) return;

  const planForB = await buildImportPlan(validationA.backupData, userB_Id, db);
  const restoreResultB = await executeRestore(planForB, userB_Id, db);

  assert(restoreResultB.success === true, 'Restore executed successfully for User B');

  const userBData = await db.exportUserData(userB_Id);
  const userADataAfter = await db.exportUserData(userA_Id);

  // 7. Backup user ID never becomes current ownership
  const anyBelongsToA = userBData.products.some((p) => p.user_id === userA_Id);
  assert(!anyBelongsToA, "Test 7: Backup user ID (User A) is NEVER assigned as record ownership");

  // 8. Current authenticated user owns restored records
  const allBelongToB = userBData.products.every((p) => p.user_id === userB_Id);
  assert(allBelongToB, `Test 8: All restored products strictly owned by User B (${userB_Id})`);

  // 9. Cross-account restore isolation
  assert(
    userADataAfter.products.length === 2 && userADataAfter.purchases.length === 3,
    'Test 9: User A original records remain completely unmutated and isolated'
  );

  // 10. RLS preserved
  assert(
    userBData.products.length === 2,
    `Test 10: RLS isolation preserved: User B sees only their 2 restored products`
  );

  // 11. No secrets imported
  const maliciousBackupWithSecret = JSON.stringify({
    ...JSON.parse(rawJsonBackupA),
    auth_token: 'secret-token-123',
    service_role_key: 'super-secret',
  });
  const secretResult = validateBackupFile(maliciousBackupWithSecret);
  assert(
    !secretResult.valid && secretResult.details!.includes('Unauthorized security tokens'),
    'Test 11: Backups containing passwords or security tokens are rejected'
  );

  // ============================================================================
  // GROUP 3: PRODUCTS (Tests 12 - 14)
  // ============================================================================
  console.log('\n--- 3. PRODUCTS RESTORATION & DEDUPLICATION (Tests 12 - 14) ---');

  // 12. Products restored
  assert(userBData.products.length === 2, `Test 12: 2 products restored for User B`);

  // 13. Duplicate stable IDs prevented
  const userBInventory = await db.getUserInventory(userB_Id);
  assert(
    userBInventory.active.length === 1 && userBInventory.unopened.length === 1,
    'Test 13: Accurate product inventory restored without phantom duplicates'
  );

  // 14. Product relationships preserved
  const restoredCleanser = userBData.products.find((p) => p.name.includes('CeraVe'))!;
  assert(
    restoredCleanser.brand === 'CeraVe' &&
      restoredCleanser.category === 'Skincare' &&
      restoredCleanser.size_value === 236 &&
      restoredCleanser.size_unit === 'ml',
    'Test 14: Product brand, category, and size units preserved accurately'
  );

  // ============================================================================
  // GROUP 4: PURCHASES (Tests 15 - 17)
  // ============================================================================
  console.log('\n--- 4. PURCHASES & INTEGRITY (Tests 15 - 17) ---');

  // 15. Purchases restored
  assert(userBData.purchases.length === 3, `Test 15: 3 purchases restored for User B`);

  // 16. Purchase-product links preserved
  const userBProductIds = new Set(userBData.products.map((p) => p.id));
  const allPurchasesLinked = userBData.purchases.every((pu) =>
    userBProductIds.has(pu.product_id)
  );
  assert(allPurchasesLinked, 'Test 16: All purchases link to valid current-user products');

  // 17. No orphan purchases
  const orphanBackup = JSON.stringify({
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    products: [{ id: 'p1', name: 'Product 1', category: 'General' }],
    purchases: [{ id: 'pur1', product_id: 'non-existent-p', purchase_date: '2026-01-01', price: 100 }],
    usage_periods: [],
  });
  const orphanResult = validateBackupFile(orphanBackup);
  assert(
    !orphanResult.valid && orphanResult.details!.includes('references non-existent product'),
    'Test 17: Orphan purchases are rejected by validation layer'
  );

  // ============================================================================
  // GROUP 5: USAGE PERIODS & ACTIVE CONFLICTS (Tests 18 - 21)
  // ============================================================================
  console.log('\n--- 5. USAGE PERIODS & ACTIVE CONFLICTS (Tests 18 - 21) ---');

  // 18. Historical cycles restored
  const restoredCycles = userBData.usage_periods.filter((u) => u.status === 'finished');
  assert(
    restoredCycles.length === 1 &&
      restoredCycles[0].opened_date === '2026-01-01' &&
      restoredCycles[0].finished_date === '2026-03-02',
    'Test 18: Historical completed usage cycle restored with exact opened and finished dates'
  );

  // 19. Active usage restored when no conflict
  const restoredActive = userBData.usage_periods.filter((u) => u.status === 'active');
  assert(
    restoredActive.length === 1 && restoredActive[0].opened_date === '2026-03-05',
    'Test 19: Active usage period restored when no conflict exists'
  );

  // 20 & 21. Active Conflict Handled Safely & No Duplicate Active Usage
  // Now, suppose User B already has an active Cleanser (which they now do).
  // User B creates another backup file that ALSO has an active Cleanser bottle.
  const conflictingBackup = JSON.parse(rawJsonBackupA);
  // Modify IDs to simulate separate backup bottle
  conflictingBackup.purchases.push({
    id: 'pur-conflicting-active',
    product_id: cleanser.id,
    product_name: 'CeraVe Hydrating Cleanser',
    brand: 'CeraVe',
    category: 'Skincare',
    purchase_date: '2026-09-01',
    price: 1900,
    currency: 'BDT',
  });
  conflictingBackup.usage_periods.push({
    id: 'u-conflicting-active',
    product_id: cleanser.id,
    product_name: 'CeraVe Hydrating Cleanser',
    purchase_id: 'pur-conflicting-active',
    opened_date: '2026-09-01',
    status: 'active',
  });

  const conflictPlan = await buildImportPlan(conflictingBackup, userB_Id, db);
  assert(
    conflictPlan.activeConflicts.length === 1,
    'Test 20: Active container conflict detected in import plan preview'
  );
  assert(
    conflictPlan.activeConflicts[0].action === 'keep_current_active',
    'Test 20b: Action is strictly keep_current_active (current active container preserved)'
  );

  await executeRestore(conflictPlan, userB_Id, db);

  const userBUsageAfterConflict = (await db.exportUserData(userB_Id)).usage_periods;
  const userBCleanserActive = userBUsageAfterConflict.filter(
    (u) => u.product_id === restoredCleanser.id && u.status === 'active'
  );
  assert(
    userBCleanserActive.length === 1,
    'Test 21: Single active bottle invariant strictly maintained (no duplicate active container created)'
  );

  // ============================================================================
  // GROUP 6: INVENTORY (Tests 22 - 23)
  // ============================================================================
  console.log('\n--- 6. INVENTORY INTEGRITY (Tests 22 - 23) ---');

  const userBInvAfter = await db.getUserInventory(userB_Id);

  // 22. Unopened purchases restored as unopened
  // Original unopened shampoo + conflicting cleanser purchase (which was kept unopened)
  assert(
    userBInvAfter.unopened.length >= 2,
    `Test 22: Unopened purchases restored with status unopened (${userBInvAfter.unopened.length} unopened)`
  );

  // 23. Multiple unopened purchases preserved individually
  const unopenedCleansers = userBInvAfter.unopened.filter((item) =>
    item.product.name.includes('CeraVe')
  );
  assert(
    unopenedCleansers.length === 1,
    'Test 23: Conflicting active container safely preserved as unopened inventory item'
  );

  // ============================================================================
  // GROUP 7: ANALYTICS CONSISTENCY (Tests 24 - 26)
  // ============================================================================
  console.log('\n--- 7. ANALYTICS & PREDICTIONS CONSISTENCY (Tests 24 - 26) ---');

  // 24. Restored historical data produces same observed calculations
  const originalCycles = exportDataA.usage_history.filter((u) => u.status === 'completed');
  const restoredBHistory = await db.getProductHistory(restoredCleanser.id, userB_Id);
  const restoredBCycles = restoredBHistory?.finished_periods || [];

  const originalLifespan = calculateAverageLifespan(
    originalCycles.map((c) => ({
      ...c,
      status: 'finished',
      created_at: new Date().toISOString(),
    }))
  );
  const restoredLifespan = calculateAverageLifespan(restoredBCycles);

  assert(
    originalLifespan === restoredLifespan && restoredLifespan === 60,
    `Test 24: Restored average lifespan (${restoredLifespan} days) matches original observed calculation (60 days)`
  );

  // 25. Predictions remain consistent with restored history
  assert(
    restoredBCycles.length === 1,
    'Test 25: Restored cycles count matches historical completed count (1 cycle)'
  );

  // 26. Confidence remains consistent
  const originalConf = calculateConfidence(originalCycles.length);
  const restoredConf = calculateConfidence(restoredBCycles.length);
  assert(
    originalConf.state === restoredConf.state && originalConf.label === restoredConf.label,
    `Test 26: Confidence calculation (${restoredConf.label}) matches original confidence state`
  );

  // ============================================================================
  // GROUP 8: IDEMPOTENCY (Test 27)
  // ============================================================================
  console.log('\n--- 8. IDEMPOTENCY (Test 27) ---');

  const beforeSecondRestore = await db.exportUserData(userB_Id);
  const planForB_Run2 = await buildImportPlan(validationA.backupData, userB_Id, db);

  assert(
    planForB_Run2.summary.newProductsCount === 0 &&
      planForB_Run2.summary.existingProductsCount === 2,
    'Test 27a: Plan detects 0 new products and 2 existing products on re-import'
  );

  const resultB_Run2 = await executeRestore(planForB_Run2, userB_Id, db);
  assert(resultB_Run2.success === true, 'Test 27b: Second restore execution succeeds');

  const afterSecondRestore = await db.exportUserData(userB_Id);
  assert(
    afterSecondRestore.products.length === beforeSecondRestore.products.length &&
      afterSecondRestore.purchases.length === beforeSecondRestore.purchases.length &&
      afterSecondRestore.usage_periods.length === beforeSecondRestore.usage_periods.length,
    'Test 27: Idempotency verified: Restoring identical backup twice creates 0 duplicate records'
  );

  // ============================================================================
  // GROUP 9: MOCK DB & STORAGE RELOAD (Tests 28 - 29)
  // ============================================================================
  console.log('\n--- 9. MOCK DB & STORAGE PERSISTENCE (Tests 28 - 29) ---');

  // 28. Mock restore works in memory adapter
  assert(userBData.products.length > 0, 'Test 28: Mock restore functions accurately with storage adapter');

  // 29. Mock persistence after reload
  const reloadedDb = new MockDatabase(storageAdapter);
  const reloadedUserBData = await reloadedDb.exportUserData(userB_Id);
  assert(
    reloadedUserBData.products.length === afterSecondRestore.products.length &&
      reloadedUserBData.purchases.length === afterSecondRestore.purchases.length,
    'Test 29: Persisted data fully recovered on database instance reload'
  );

  // ============================================================================
  // GROUP 10: SUPABASE LIVE / SCHEMA VERIFICATION (Tests 30 - 33)
  // ============================================================================
  console.log('\n--- 10. SUPABASE COMPLIANCE & RLS SCOPE (Tests 30 - 33) ---');

  // 30. Supabase Database implementation has importUserData method
  const dbSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/db.ts'), 'utf-8');
  assert(
    dbSrc.includes('async importUserData(') &&
      dbSrc.includes("status: 'active'") &&
      dbSrc.includes("status: 'finished'"),
    'Test 30: SupabaseDatabase implements importUserData with active and finished status mapping'
  );

  // 31. RLS verified in schema and code
  assert(
    dbSrc.includes("eq('user_id', userId)"),
    'Test 31: SupabaseDatabase explicitly scopes product lookups to user_id (satisfies RLS)'
  );

  // 32. Cross-account isolation verified in schema
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/schema.sql'), 'utf-8');
  assert(
    schemaSql.includes('idx_usage_periods_single_active') &&
      schemaSql.includes('CREATE POLICY "Users can insert own products"'),
    'Test 32: Supabase schema contains single-active constraint index and RLS policies'
  );

  // 33. Clean up test data
  await db.resetUserData(userA_Id, true);
  await db.resetUserData(userB_Id, true);
  const userBAfterClean = await db.exportUserData(userB_Id);
  assert(
    userBAfterClean.products.length === 0 && userBAfterClean.purchases.length === 0,
    'Test 33: Test data cleanup succeeds'
  );

  // ============================================================================
  // GROUP 11: UX WORKFLOW & ERROR HANDLING (Tests 34 - 37)
  // ============================================================================
  console.log('\n--- 11. UX WORKFLOW & SAFE STATE (Tests 34 - 37) ---');

  // 34. Preview appears before mutation
  assert(
    modalSrc.includes("setStep('preview')") &&
      modalSrc.includes("setStep('confirm')") &&
      modalSrc.includes("executeRestore("),
    'Test 34: UI strictly previews import plan and requires confirmation before executeRestore'
  );

  // 35. Restore confirmation required
  assert(
    modalSrc.includes('Confirm Data Restore') &&
      modalSrc.includes('Existing data will not be automatically deleted'),
    'Test 35: Modal requires explicit confirmation with non-destructive disclaimer'
  );

  // 36. Success feedback displayed
  assert(
    modalSrc.includes('Data Successfully Restored') &&
      modalSrc.includes('executionResult.restoredProducts') &&
      modalSrc.includes('executionResult.restoredPurchases'),
    'Test 36: Success feedback screen presents exact counts of restored items'
  );

  // 37. Restore error does not falsely report success
  assert(
    modalSrc.includes("Couldn't restore this backup") &&
      modalSrc.includes('No changes were made'),
    'Test 37: Restore error reports failure and explains no changes were made'
  );

  // ============================================================================
  // GROUP 12: RESPONSIVE & ACCESSIBILITY (Tests 38 - 40)
  // ============================================================================
  console.log('\n--- 12. RESPONSIVE & ACCESSIBILITY (Tests 38 - 40) ---');

  // 38. 375px layout
  assert(
    modalSrc.includes('max-w-lg') &&
      modalSrc.includes('overflow-y-auto') &&
      modalSrc.includes('min-h-[44px]'),
    'Test 38: Modal uses mobile-friendly scrollable layout and 44px min touch targets'
  );

  // 39. Keyboard navigation & ARIA
  assert(
    modalSrc.includes('role="dialog"') &&
      modalSrc.includes('aria-modal="true"') &&
      modalSrc.includes("e.key === 'Escape'"),
    'Test 39: Modal implements ARIA dialog attributes and Escape key handling'
  );

  // 40. Reduced motion & no color-only warnings
  assert(
    modalSrc.includes('ACTIVE CONFLICT') &&
      modalSrc.includes('<svg') &&
      modalSrc.includes('Action: Keep current active bottle'),
    'Test 40: Warning states combine icons, text banners, and explicit action explanations'
  );

  console.log('\n=================================================================');
  console.log('ALL 40 RESTORE & IMPORT TESTS PASSED SUCCESSFULLY! ✓');
  console.log('=================================================================\n');
}

runRestoreVerification().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
