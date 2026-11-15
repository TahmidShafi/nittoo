// ==============================================================================
// Nittoo Restore Import Planner
// Pure planning layer that compares validated backup data against the current user's
// database records, detects stable ID duplicates, flags active conflicts, and builds
// an immutable ImportPlan for user preview and confirmation.
// ==============================================================================

import type { IDataSource, Product, Purchase, UsagePeriod, RestockPlan, ImportRestockPlanItemInput } from '../../types';
import type { NittooExportData } from '../export/types';
import type {
  ImportPlan,
  ImportPlanSummary,
  ActiveUsageConflict,
  PossibleProductMatch,
} from './types';

export async function buildImportPlan(
  backupData: NittooExportData,
  currentUserId: string,
  dataSource: IDataSource
): Promise<ImportPlan> {
  // 1. Fetch current user data (RLS scoped to current authenticated user only)
  const [currentUserData, currentInventory] = await Promise.all([
    dataSource.exportUserData(currentUserId),
    dataSource.getUserInventory(currentUserId),
  ]);

  const existingProducts: Product[] = currentUserData.products || [];
  const existingPurchases: Purchase[] = currentUserData.purchases || [];
  const existingUsage: UsagePeriod[] = currentUserData.usage_periods || [];
  const existingRestockPlans: RestockPlan[] = currentUserData.restock_plans || [];

  const existingProductIdSet = new Set(existingProducts.map((p) => p.id));
  const existingPurchaseIdSet = new Set(existingPurchases.map((pu) => pu.id));
  const existingUsageIdSet = new Set(existingUsage.map((u) => u.id));
  const existingRestockPlanIdSet = new Set(existingRestockPlans.map((rp) => rp.id));

  // Map of existing product names (normalized) to existing product IDs
  const existingProductByName = new Map<string, Product>();
  for (const p of existingProducts) {
    existingProductByName.set(p.name.trim().toLowerCase(), p);
  }

  // Track currently active products
  const activeProductIds = new Set<string>();
  for (const activeItem of currentInventory.active) {
    const pId = activeItem.id || (activeItem as any).product?.id;
    if (pId) activeProductIds.add(pId);
  }
  for (const u of existingUsage) {
    if (u.status === 'active') {
      activeProductIds.add(u.product_id);
    }
  }

  // 2. Resolve Products
  const productsToCreate: ImportPlan['productsToCreate'] = [];
  const productMapping = new Map<string, string>(); // backupProductId -> effectiveProductId
  const possibleProductMatches: PossibleProductMatch[] = [];

  let newProductsCount = 0;
  let existingProductsCount = 0;

  for (const bp of backupData.products) {
    const userScopedProductId = `${currentUserId}_${bp.id}`;
    if (existingProductIdSet.has(bp.id)) {
      // Stable ID match: product already exists in current account
      existingProductsCount++;
      productMapping.set(bp.id, bp.id);
    } else if (existingProductIdSet.has(userScopedProductId)) {
      // Scoped stable ID match: product already restored for this user
      existingProductsCount++;
      productMapping.set(bp.id, userScopedProductId);
    } else {
      // Check if a product with the same name exists with different ID
      const nameKey = bp.name.trim().toLowerCase();
      const nameMatch = existingProductByName.get(nameKey);

      if (nameMatch) {
        // Safe deterministic strategy: Flag possible match, but preserve as separate product
        possibleProductMatches.push({
          backupProductId: bp.id,
          productName: bp.name,
          existingProductId: nameMatch.id,
          action: 'preserve_separate',
        });
      }

      newProductsCount++;
      productMapping.set(bp.id, bp.id);
      productsToCreate.push({
        id: bp.id,
        name: bp.name,
        brand: bp.brand || null,
        category: bp.category,
        size: bp.size ?? null,
        unit: bp.unit ?? null,
        created_at: bp.created_at,
      });
    }
  }

  // 3. Resolve Purchases
  const purchasesToCreate: ImportPlan['purchasesToCreate'] = [];
  const purchaseMapping = new Map<string, string>();

  let newPurchasesCount = 0;
  let existingPurchasesCount = 0;

  for (const bpu of backupData.purchases) {
    const effectiveProductId = productMapping.get(bpu.product_id);
    if (!effectiveProductId) continue; // safety check

    const userScopedPurchaseId = `${currentUserId}_${bpu.id}`;
    if (existingPurchaseIdSet.has(bpu.id)) {
      existingPurchasesCount++;
      purchaseMapping.set(bpu.id, bpu.id);
    } else if (existingPurchaseIdSet.has(userScopedPurchaseId)) {
      existingPurchasesCount++;
      purchaseMapping.set(bpu.id, userScopedPurchaseId);
    } else {
      newPurchasesCount++;
      purchaseMapping.set(bpu.id, bpu.id);
      purchasesToCreate.push({
        id: bpu.id,
        product_id: effectiveProductId,
        purchase_date: bpu.purchase_date,
        price: bpu.price,
        currency: bpu.currency || 'BDT',
        store_vendor: bpu.store_vendor ? (bpu.store_vendor.trim() || null) : null,
        created_at: (bpu as any).created_at,
      });
    }
  }

  // 4. Resolve Usage Periods & Active Conflicts
  const usageToCreate: ImportPlan['usageToCreate'] = [];
  const activeConflicts: ActiveUsageConflict[] = [];
  const plannedActiveProductIds = new Set<string>(activeProductIds);
  const usedPurchaseIds = new Set<string>();
  const usageMapping = new Map<string, string>();
  const skippedBackupUsageIds = new Set<string>();

  // Mark already used purchases in current user account
  for (const u of existingUsage) {
    usedPurchaseIds.add(u.purchase_id);
  }

  let historicalCyclesCount = 0;
  let activeUsageCount = 0;

  const rawUsageList = backupData.usage_history || (backupData as any).usage_periods || [];

  for (const bu of rawUsageList) {
    const effectiveProductId = productMapping.get(bu.product_id);
    const effectivePurchaseId = purchaseMapping.get(bu.purchase_id);
    if (!effectiveProductId || !effectivePurchaseId) continue;

    const userScopedUsageId = `${currentUserId}_${bu.id}`;
    if (existingUsageIdSet.has(bu.id)) {
      usageMapping.set(bu.id, bu.id);
      usedPurchaseIds.add(effectivePurchaseId);
      continue; // Idempotent skip
    }
    if (existingUsageIdSet.has(userScopedUsageId)) {
      usageMapping.set(bu.id, userScopedUsageId);
      usedPurchaseIds.add(effectivePurchaseId);
      continue; // Idempotent skip
    }

    const isFinished = (bu.status as string) !== 'active';

    if (isFinished) {
      historicalCyclesCount++;
      usedPurchaseIds.add(effectivePurchaseId);
      usageMapping.set(bu.id, bu.id);
      usageToCreate.push({
        id: bu.id,
        product_id: effectiveProductId,
        purchase_id: effectivePurchaseId,
        opened_date: bu.opened_date,
        finished_date: bu.finished_date || bu.opened_date,
        status: 'finished',
        created_at: (bu as any).created_at,
      });
    } else {
      // Active bottle
      if (plannedActiveProductIds.has(effectiveProductId)) {
        // Active bottle conflict!
        skippedBackupUsageIds.add(bu.id);
        activeConflicts.push({
          productName: bu.product_name || 'Product',
          backupProductId: bu.product_id,
          backupUsageId: bu.id,
          action: 'keep_current_active',
          description: `${bu.product_name || 'Product'} has an active bottle in both your current data and the backup. Action: Keep current active bottle (backup purchase will be preserved as unopened).`,
        });
        // Backup active bottle skipped from activation, remains unopened purchase!
      } else {
        activeUsageCount++;
        plannedActiveProductIds.add(effectiveProductId);
        usedPurchaseIds.add(effectivePurchaseId);
        usageMapping.set(bu.id, bu.id);
        usageToCreate.push({
          id: bu.id,
          product_id: effectiveProductId,
          purchase_id: effectivePurchaseId,
          opened_date: bu.opened_date,
          finished_date: null,
          status: 'active',
          created_at: (bu as any).created_at,
        });
      }
    }
  }

  // 5. Unopened Purchases Count
  // Purchases in this import that do not have an active or finished usage period
  const unopenedPurchasesCount = purchasesToCreate.filter(
    (pu) => !usedPurchaseIds.has(pu.id)
  ).length;

  // 5b. Resolve Restock Plans (idempotent, respects active usage conflicts & single planned constraint)
  const restockPlansToCreate: ImportRestockPlanItemInput[] = [];
  const plannedUsagePeriodIds = new Set<string>(
    existingRestockPlans.filter((rp) => rp.status === 'planned').map((rp) => rp.usage_period_id)
  );
  let newRestockPlansCount = 0;

  for (const brp of backupData.restock_plans || []) {
    if (skippedBackupUsageIds.has(brp.usage_period_id)) continue;

    const effectiveProductId = productMapping.get(brp.product_id);
    const effectiveUsageId = usageMapping.get(brp.usage_period_id);
    if (!effectiveProductId || !effectiveUsageId) continue;

    const userScopedPlanId = `${currentUserId}_${brp.id}`;
    if (existingRestockPlanIdSet.has(brp.id) || existingRestockPlanIdSet.has(userScopedPlanId)) {
      continue; // Idempotent skip
    }

    if (brp.status === 'planned' && plannedUsagePeriodIds.has(effectiveUsageId)) {
      continue; // Enforce at most one 'planned' restock plan per usage period
    }

    if (brp.status === 'planned') {
      plannedUsagePeriodIds.add(effectiveUsageId);
    }

    newRestockPlansCount++;
    restockPlansToCreate.push({
      id: brp.id,
      product_id: effectiveProductId,
      usage_period_id: effectiveUsageId,
      mode: brp.mode,
      days_before_finish: brp.days_before_finish ?? null,
      reminder_date: brp.reminder_date,
      status: brp.status,
      created_at: brp.created_at,
      completed_at: (brp as any).completed_at ?? null,
    });
  }

  const warnings: string[] = [];
  if (activeConflicts.length > 0) {
    warnings.push(
      `${activeConflicts.length} active bottle conflict${activeConflicts.length > 1 ? 's' : ''} detected. Your current active bottle will be kept, and conflicting backup bottles will be preserved as unopened inventory.`
    );
  }
  if (possibleProductMatches.length > 0) {
    warnings.push(
      `${possibleProductMatches.length} product${possibleProductMatches.length > 1 ? 's have' : ' has'} similar names to existing items. They will be preserved as separate records to prevent data loss.`
    );
  }

  const summary: ImportPlanSummary = {
    newProductsCount,
    existingProductsCount,
    newPurchasesCount,
    existingPurchasesCount,
    historicalCyclesCount,
    activeUsageCount,
    unopenedPurchasesCount,
    activeConflictsCount: activeConflicts.length,
    newRestockPlansCount,
    estimatedMonthlyConsumption: backupData.summary?.estimated_monthly_consumption ?? null,
    invalidRecordsCount: 0,
  };

  return {
    isValid: true,
    backupMeta: {
      exported_at: backupData.exported_at,
      version: backupData.version,
      original_email: backupData.user?.email || 'Unknown',
    },
    summary,
    productsToCreate,
    purchasesToCreate,
    usageToCreate,
    restockPlansToCreate,
    activeConflicts,
    possibleProductMatches,
    warnings,
  };
}
