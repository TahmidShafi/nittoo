import { describe, it, expect } from 'vitest';
import { validateBackupFile } from './validator';
import { buildImportPlan } from './planner';
import { executeRestore } from './executor';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../mock-db';
import { buildExportData } from '../export';
import { generateJsonBackup } from '../export/json';

describe('restore', () => {
  it('validates, plans, and idempotently executes backup restore including restock_plans', async () => {
    const sourceDb = new MockDatabase(new InMemoryStorageAdapter());
    const active = await sourceDb.getActiveProducts(DEFAULT_MOCK_USER_ID);
    const cerave = active.find((p) => p.name.includes('CeraVe'))!;

    await sourceDb.createRestockPlan(DEFAULT_MOCK_USER_ID, {
      product_id: cerave.id,
      usage_period_id: cerave.active_usage!.id,
      mode: 'relative',
      days_before_finish: 14,
      reminder_date: '2026-10-17',
    });

    const exportBundle = await buildExportData(
      DEFAULT_MOCK_USER_ID,
      'demo@nittoo.local',
      sourceDb
    );
    const jsonString = generateJsonBackup(exportBundle);

    const validation = validateBackupFile(jsonString);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;
    expect(validation.backupData.restock_plans!.length).toBeGreaterThanOrEqual(1);

    // Restore into a fresh user
    const targetDb = new MockDatabase(new InMemoryStorageAdapter());
    const targetUserId = 'restore-target-user';

    const plan = await buildImportPlan(validation.backupData, targetUserId, targetDb);
    expect(plan.summary.newProductsCount).toBe(3);
    expect(plan.summary.newRestockPlansCount).toBeGreaterThanOrEqual(1);

    const exec1 = await executeRestore(plan, targetUserId, targetDb);
    expect(exec1.restoredProducts).toBe(3);
    expect(exec1.restoredRestockPlans).toBe(plan.summary.newRestockPlansCount);

    // Re-running restore against existing data skips duplicates idempotently
    const plan2 = await buildImportPlan(validation.backupData, targetUserId, targetDb);
    expect(plan2.summary.newProductsCount).toBe(0);
    expect(plan2.summary.newRestockPlansCount).toBe(0);
  });

  it('rejects malformed backup JSON and invalid restock plan modes', () => {
    expect(validateBackupFile('{not-json').valid).toBe(false);

    const badRestock = JSON.stringify({
      exported_at: '2026-09-01T00:00:00Z',
      products: [
        {
          id: 'p1',
          name: 'Test',
          category: 'Skincare',
        },
      ],
      purchases: [],
      usage_periods: [],
      restock_plans: [
        {
          id: 'rp1',
          product_id: 'p1',
          usage_period_id: 'u1',
          mode: 'invalid-mode',
          reminder_date: '2026-10-01',
        },
      ],
    });
    expect(validateBackupFile(badRestock).valid).toBe(false);
  });
});
