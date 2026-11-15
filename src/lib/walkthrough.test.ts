import { describe, expect, it } from 'vitest';
import { InMemoryStorageAdapter, MockDatabase } from './mock-db';
import { getPredictionMetrics } from '../hooks/usePrediction';
import { calculateConfidence } from './confidence';
import { buildExportData } from './export/normalizer';
import { generateJsonBackup } from './export/json';
import { validateBackupFile } from './restore/validator';
import { buildImportPlan } from './restore/planner';
import { executeRestore } from './restore/executor';

describe('Full end-to-end domain walkthrough', () => {
  it('runs create -> purchase -> cycle -> backup -> prediction -> restock -> export -> restore', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const userA = 'walkthrough-a';
    const userB = 'walkthrough-b';

    const prod = await db.createProduct(userA, {
      name: 'Niacinamide Serum',
      category: 'Skincare',
      brand: 'The Ordinary',
      size_value: 30,
      size_unit: 'ml',
    });
    const pur1 = await db.createPurchase(userA, {
      product_id: prod.id,
      purchase_date: '2026-08-01',
      price: 900,
      store_vendor: 'Shajgoj',
    });
    const up1 = await db.startUsagePeriod(userA, {
      product_id: prod.id,
      purchase_id: pur1.id,
      opened_date: '2026-08-01',
    });

    // Learning state with 0 finished cycles
    let activeList = await db.getActiveProducts(userA);
    let metrics = getPredictionMetrics(activeList[0], '2026-08-10');
    expect(metrics.predictedRemainingDays).toBeNull();
    expect(calculateConfidence(0).state).toBe('no_data');

    // Finish first cycle (30 days)
    await db.finishUsagePeriod(userA, up1.id, '2026-08-31');

    // Buy second bottle + backup bottle
    const pur2 = await db.createPurchase(userA, {
      product_id: prod.id,
      purchase_date: '2026-09-01',
      price: 960,
    });
    const pur3 = await db.createPurchase(userA, {
      product_id: prod.id,
      purchase_date: '2026-09-10',
      price: 1100,
    });
    const up2 = await db.startUsagePeriod(userA, {
      product_id: prod.id,
      purchase_id: pur2.id,
      opened_date: '2026-09-01',
    });

    activeList = await db.getActiveProducts(userA);
    metrics = getPredictionMetrics(activeList[0], '2026-09-16');
    expect(metrics.averageLifespan).toBe(30);
    expect(metrics.predictedRemainingDays).toBe(15);
    expect(metrics.costPerDay).toBe(32); // 960 / 30 (active bottle price, not backup 1100)
    expect(activeList[0].unopened_count).toBe(1);
    expect(calculateConfidence(1).state).toBe('early');

    await db.createRestockPlan(userA, {
      product_id: prod.id,
      usage_period_id: up2.id,
      mode: 'relative',
      days_before_finish: 5,
      reminder_date: '2026-09-26',
    });

    const bundle = await buildExportData(userA, 'a@nittoo.local', db);
    const json = generateJsonBackup(bundle);
    const validated = validateBackupFile(json);
    expect(validated.valid).toBe(true);
    if (!validated.valid) return;

    const plan = await buildImportPlan(validated.backupData, userB, db);
    const exec = await executeRestore(plan, userB, db);
    expect(exec.success).toBe(true);
    expect(exec.restoredProducts).toBe(1);
    expect(exec.restoredPurchases).toBe(3);
    expect(exec.restoredRestockPlans).toBe(1);

    const userBInv = await db.getUserInventory(userB);
    expect(userBInv.active).toHaveLength(1);
    expect(userBInv.unopened).toHaveLength(1);
    expect(userBInv.unopened[0].purchase.price).toBe(pur3.price);
  });
});
