// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  DEMO_MODE_KEY,
  getActiveDataSource,
  isDemoSessionActive,
  setDemoModeActive,
} from './dataSource';
import { dataCache } from './dataCache';
import { mockDb } from './mock-db';

describe('dataSource proxy & demo mode routing', () => {
  const userId = 'ds-test-user';

  beforeEach(async () => {
    window.localStorage.clear();
    dataCache.clearAll();
    await mockDb.resetUserData(userId);
  });

  it('toggles demo mode via localStorage and clears cache', () => {
    expect(isDemoSessionActive()).toBe(false);
    dataCache.set(userId, 'products', []);
    setDemoModeActive(true);
    expect(isDemoSessionActive()).toBe(true);
    expect(window.localStorage.getItem(DEMO_MODE_KEY)).toBe('true');
    expect(dataCache.get(userId, 'products')).toBeNull();
    expect(getActiveDataSource()).toBe(mockDb);

    setDemoModeActive(false);
    expect(isDemoSessionActive()).toBe(false);
  });

  it('delegates CRUD, restock, export/import, and reset operations while managing cache', async () => {
    setDemoModeActive(true);
    const product = await db.createProduct(userId, {
      name: 'Serum',
      category: 'Skincare',
      brand: 'BrandA',
      size_value: 30,
      size_unit: 'ml',
    });

    const purchase = await db.createPurchase(userId, {
      product_id: product.id,
      purchase_date: '2026-04-01',
      price: 1200,
      currency: 'BDT',
      store_vendor: 'ShopX',
    });

    const usage = await db.startUsagePeriod(userId, {
      product_id: product.id,
      purchase_id: purchase.id,
      opened_date: '2026-04-02',
    });

    const plan = await db.createRestockPlan(userId, {
      product_id: product.id,
      usage_period_id: usage.id,
      mode: 'relative',
      days_before_finish: 3,
      reminder_date: '2026-04-28',
    });

    expect((await db.getActiveProducts(userId)).length).toBe(1);
    expect((await db.getAllUserProducts(userId)).length).toBe(1);
    expect((await db.getUserProductsWithHistory(userId)).length).toBe(1);
    expect(await db.getProductHistory(product.id, userId)).not.toBeNull();
    expect((await db.getUserInventory(userId)).unopened.length).toBe(0);
    expect((await db.getRestockPlans(userId)).length).toBe(1);
    expect((await db.getRestockPlanForUsagePeriod(userId, usage.id))?.id).toBe(plan.id);

    const updatedProduct = await db.updateProduct(userId, product.id, {
      name: 'Serum Pro',
      category: 'Skincare',
    });
    expect(updatedProduct.name).toBe('Serum Pro');

    const updatedPurchase = await db.updatePurchase(userId, purchase.id, {
      purchase_date: '2026-04-01',
      price: 1300,
      currency: 'BDT',
    });
    expect(updatedPurchase.price).toBe(1300);

    const updatedUsage = await db.updateUsagePeriod(userId, usage.id, { opened_date: '2026-04-03' });
    expect(updatedUsage.opened_date).toBe('2026-04-03');

    const updatedPlan = await db.updateRestockPlan(userId, plan.id, {
      mode: 'custom',
      reminder_date: '2026-04-29',
    });
    expect(updatedPlan.reminder_date).toBe('2026-04-29');

    const completedPlan = await db.completeRestockPlan(userId, plan.id);
    expect(completedPlan.status).toBe('completed');

    const dismissedPlan = await db.dismissRestockPlan(userId, plan.id);
    expect(dismissedPlan.status).toBe('dismissed');

    await db.deleteRestockPlan(userId, plan.id);
    expect(await db.getRestockPlans(userId)).toHaveLength(0);

    const finished = await db.finishUsagePeriod(userId, usage.id, '2026-04-20');
    expect(finished.status).toBe('finished');

    const exported = await db.exportUserData(userId);
    expect(exported.products).toHaveLength(1);

    const importRes = await db.importUserData(userId, {
      products: [
        {
          id: product.id,
          name: 'Serum Pro',
          category: 'Skincare',
          brand: 'BrandA',
          created_at: product.created_at,
        },
      ],
      purchases: [],
      usage_periods: [],
    });
    expect(importRes.success).toBe(true);

    await db.deleteUsagePeriod(userId, usage.id);
    await db.resetUserData(userId);
    expect(await db.getAllUserProducts(userId)).toHaveLength(0);
  });
});
