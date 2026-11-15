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

    // Error handling when userId is missing
    await expect(executeRestore(plan2, '', targetDb)).rejects.toThrow();

    // Multi-tenant isolation: sourceDb (DEFAULT_MOCK_USER_ID) unaffected by targetDb restore
    const sourceProducts = await sourceDb.getAllUserProducts(DEFAULT_MOCK_USER_ID);
    expect(sourceProducts).toHaveLength(3);
  });

  it('preserves existing active bottle on conflict and saves backup bottle as unopened', async () => {
    const sourceDb = new MockDatabase(new InMemoryStorageAdapter());
    const exportBundle = await buildExportData(DEFAULT_MOCK_USER_ID, 'src@nittoo.local', sourceDb);
    const jsonString = generateJsonBackup(exportBundle);
    const validation = validateBackupFile(jsonString);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    const sourceActive = await sourceDb.getActiveProducts(DEFAULT_MOCK_USER_ID);
    const cerave = sourceActive.find((p) => p.name.includes('CeraVe'))!;

    const targetDb = new MockDatabase(new InMemoryStorageAdapter());
    const targetUser = 'conflict-user';
    const firstPlan = await buildImportPlan(validation.backupData, targetUser, targetDb);
    await executeRestore(firstPlan, targetUser, targetDb);

    // Second backup has a different active purchase & usage for the same CeraVe product ID
    const secondBackup = structuredClone(validation.backupData);
    secondBackup.purchases.push({
      id: 'pur-conflict-new',
      product_id: cerave.id,
      product_name: cerave.name,
      brand: cerave.brand ?? 'CeraVe',
      category: cerave.category,
      purchase_date: '2026-10-05',
      price: 1500,
      currency: 'BDT',
      store_vendor: null,
    });
    secondBackup.usage_history = secondBackup.usage_history.map((u) =>
      u.product_id === cerave.id && u.status === 'active'
        ? {
            ...u,
            id: 'up-conflict-new',
            purchase_id: 'pur-conflict-new',
            opened_date: '2026-10-06',
          }
        : u
    );

    const plan = await buildImportPlan(secondBackup, targetUser, targetDb);
    expect(plan.activeConflicts.length).toBeGreaterThanOrEqual(1);
    const result = await executeRestore(plan, targetUser, targetDb);
    expect(result.success).toBe(true);

    // Original active bottle remained active; conflicting backup bottle became unopened
    const inv = await targetDb.getUserInventory(targetUser);
    const activeCerave = inv.active.find((a) => a.name === cerave.name);
    expect(activeCerave?.active_usage?.purchase_id).not.toBe('pur-conflict-new');
    expect(inv.unopened.some((u) => u.product.name === cerave.name)).toBe(true);
  });

  it.each([
    ['unsupported version', { version: '2.0.0', products: [], purchases: [], usage_periods: [] }],
    ['sensitive password key', { version: '1.0.0', password: '123', products: [], purchases: [], usage_periods: [] }],
    ['sensitive service_role key', { version: '1.0.0', service_role: 'abc', products: [], purchases: [], usage_periods: [] }],
    ['missing products array', { version: '1.0.0', purchases: [], usage_periods: [] }],
    ['missing purchases array', { version: '1.0.0', products: [], usage_periods: [] }],
    [
      'dangling purchase product_id',
      {
        version: '1.0.0',
        exported_at: '2026-09-01T00:00:00Z',
        products: [{ id: 'p1', name: 'Soap', category: 'Skincare' }],
        purchases: [{ id: 'pur1', product_id: 'missing', purchase_date: '2026-09-01', price: 100 }],
        usage_periods: [],
      },
    ],
  ])('rejects invalid backup payload (%s)', (_label, payload) => {
    expect(validateBackupFile(JSON.stringify(payload)).valid).toBe(false);
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

  it('rejects invalid backup shapes, missing fields, and bad purchases/usage_periods', () => {
    expect(validateBackupFile('[]').valid).toBe(false);
    expect(validateBackupFile('{}').valid).toBe(false);
    expect(
      validateBackupFile(
        JSON.stringify({
          products: [{ id: '', name: '', category: '' }],
          purchases: [],
          usage_periods: [],
        })
      ).valid
    ).toBe(false);
    expect(
      validateBackupFile(
        JSON.stringify({
          products: [{ id: 'p1', name: 'Soap', category: 'Personal Care' }],
          purchases: [{ id: 'pur1', product_id: 'p1', purchase_date: 'bad', price: -5 }],
          usage_periods: [],
        })
      ).valid
    ).toBe(false);
    expect(
      validateBackupFile(
        JSON.stringify({
          products: [{ id: 'p1', name: 'Soap', category: 'Personal Care' }],
          purchases: [{ id: 'pur1', product_id: 'p1', purchase_date: '2026-04-01', price: 100 }],
          usage_periods: [
            {
              id: 'u1',
              product_id: 'p1',
              purchase_id: 'pur1',
              opened_date: '2026-04-02',
              status: 'unknown',
            },
          ],
        })
      ).valid
    ).toBe(false);
  });
});
