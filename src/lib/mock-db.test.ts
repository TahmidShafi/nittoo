import { describe, it, expect } from 'vitest';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from './mock-db';

describe('MockDatabase lifecycle & isolation', () => {
  it('supports create product -> purchase -> start -> finish -> edit -> delete lifecycle', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const userA = 'user-a';
    const userB = 'user-b';

    const product = await db.createProduct(userA, {
      name: 'Lip Sleeping Mask',
      category: 'Skincare',
      brand: 'Laneige',
      size_value: 20,
      size_unit: 'g',
    });

    const purchase = await db.createPurchase(userA, {
      product_id: product.id,
      purchase_date: '2026-09-01',
      price: 1800,
      store_vendor: 'Shajgoj',
    });
    expect(purchase.store_vendor).toBe('Shajgoj');

    // Unopened initially
    const invBefore = await db.getUserInventory(userA);
    expect(invBefore.unopened).toHaveLength(1);
    expect(invBefore.active).toHaveLength(0);

    // Start active usage
    const active = await db.startUsagePeriod(userA, {
      product_id: product.id,
      purchase_id: purchase.id,
      opened_date: '2026-09-01',
    });
    expect(active.status).toBe('active');

    // Single active usage constraint
    const backup = await db.createPurchase(userA, {
      product_id: product.id,
      purchase_date: '2026-09-10',
      price: 1900,
    });
    await expect(
      db.startUsagePeriod(userA, {
        product_id: product.id,
        purchase_id: backup.id,
        opened_date: '2026-09-10',
      })
    ).rejects.toThrow(/active usage period/i);

    // Finish usage
    const finished = await db.finishUsagePeriod(userA, active.id, '2026-09-21');
    expect(finished.status).toBe('finished');
    expect(finished.finished_date).toBe('2026-09-21');

    // Edit finished usage & delete
    const edited = await db.updateUsagePeriod(userA, active.id, {
      opened_date: '2026-09-02',
      finished_date: '2026-09-22',
    });
    expect(edited.opened_date).toBe('2026-09-02');

    // Multi-user isolation
    expect(await db.getAllUserProducts(userB)).toHaveLength(0);
    await expect(db.getProductHistory(product.id, userB)).rejects.toThrow(/Unauthorized/i);

    await db.deleteUsagePeriod(userA, active.id);
    const histAfterDelete = await db.getProductHistory(product.id, userA);
    expect(histAfterDelete?.finished_periods).toHaveLength(0);
  });

  it('rejects editing finished cycle without finished_date and updates purchase vendor', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const history = await db.getUserProductsWithHistory(DEFAULT_MOCK_USER_ID);
    const cerave = history.find((h) => h.product.name.includes('CeraVe'))!;
    const finishedCycle = cerave.finished_periods[0];

    await expect(
      db.updateUsagePeriod(DEFAULT_MOCK_USER_ID, finishedCycle.id, {
        opened_date: finishedCycle.opened_date,
        finished_date: '',
      })
    ).rejects.toThrow('Finished date is required for completed cycles');

    const updatedPurchase = await db.updatePurchase(
      DEFAULT_MOCK_USER_ID,
      cerave.purchases[0].id,
      {
        purchase_date: cerave.purchases[0].purchase_date,
        price: cerave.purchases[0].price,
        currency: cerave.purchases[0].currency,
        store_vendor: 'Daraz Mall',
      }
    );
    expect(updatedPurchase.store_vendor).toBe('Daraz Mall');

    const updatedProd = await db.updateProduct(DEFAULT_MOCK_USER_ID, cerave.product.id, {
      name: 'CeraVe Updated',
      category: cerave.product.category,
      brand: 'CeraVe',
      size_value: 250,
      size_unit: 'ml',
    });
    expect(updatedProd.name).toBe('CeraVe Updated');

    await db.resetUserData(DEFAULT_MOCK_USER_ID);
    expect(await db.getAllUserProducts(DEFAULT_MOCK_USER_ID)).toHaveLength(3);
  });
});
