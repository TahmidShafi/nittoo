import { describe, it, expect } from 'vitest';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from './mock-db';

describe('MockDatabase lifecycle & isolation', () => {
  it('moves purchase from unopened to active and enforces single active usage constraint', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const userA = 'user-a';

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

    const invBefore = await db.getUserInventory(userA);
    expect(invBefore.unopened).toHaveLength(1);
    expect(invBefore.active).toHaveLength(0);

    const active = await db.startUsagePeriod(userA, {
      product_id: product.id,
      purchase_id: purchase.id,
      opened_date: '2026-09-01',
    });
    expect(active.status).toBe('active');

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
  });

  it('supports finishing, editing, deleting cycles and multi-user isolation', async () => {
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
    const active = await db.startUsagePeriod(userA, {
      product_id: product.id,
      purchase_id: purchase.id,
      opened_date: '2026-09-01',
    });

    const finished = await db.finishUsagePeriod(userA, active.id, '2026-09-21');
    expect(finished.status).toBe('finished');
    expect(finished.finished_date).toBe('2026-09-21');

    const edited = await db.updateUsagePeriod(userA, active.id, {
      opened_date: '2026-09-02',
      finished_date: '2026-09-22',
    });
    expect(edited.opened_date).toBe('2026-09-02');

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

  it.each([
    ['Shajgoj', 'Shajgoj'],
    ['  Daraz Mall  ', 'Daraz Mall'],
    ['   ', null],
    [null, null],
    [undefined, null],
  ])('normalizes store_vendor (%s -> %s) on create and update', async (rawVendor, expected) => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const prod = await db.createProduct('v-user', { name: 'Sunscreen', category: 'Skincare' });
    const pur = await db.createPurchase('v-user', {
      product_id: prod.id,
      purchase_date: '2026-09-01',
      price: 800,
      store_vendor: rawVendor,
    });
    expect(pur.store_vendor).toBe(expected);

    // Clear vendor back to null on update
    const cleared = await db.updatePurchase('v-user', pur.id, {
      purchase_date: '2026-09-01',
      price: 800,
      currency: 'BDT',
      store_vendor: '   ',
    });
    expect(cleared.store_vendor).toBeNull();
  });

  it('enforces history edit date rules and preserves purchase when deleting finished cycle', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const u = 'hist-user';
    const prod = await db.createProduct(u, { name: 'Toner', category: 'Skincare' });
    const pur = await db.createPurchase(u, {
      product_id: prod.id,
      purchase_date: '2026-09-05',
      price: 600,
    });
    const up = await db.startUsagePeriod(u, {
      product_id: prod.id,
      purchase_id: pur.id,
      opened_date: '2026-09-06',
    });
    const finished = await db.finishUsagePeriod(u, up.id, '2026-09-26');

    await expect(
      db.updateUsagePeriod(u, finished.id, {
        opened_date: '2026-09-01', // earlier than purchase_date 2026-09-05
        finished_date: '2026-09-26',
      })
    ).rejects.toThrow(/purchase/i);

    await expect(
      db.updateUsagePeriod(u, finished.id, {
        opened_date: '2026-09-20',
        finished_date: '2026-09-10', // earlier than opened_date
      })
    ).rejects.toThrow(/earlier/i);

    await db.deleteUsagePeriod(u, finished.id);
    const inv = await db.getUserInventory(u);
    expect(inv.unopened.some((item) => item.purchase.id === pur.id)).toBe(true);
  });

  it('transitions backup purchase from unopened to active after finishing current bottle', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const u = 'unopened-user';
    const prod = await db.createProduct(u, { name: 'Serum', category: 'Skincare' });
    const p1 = await db.createPurchase(u, { product_id: prod.id, purchase_date: '2026-08-01', price: 500 });
    const p2 = await db.createPurchase(u, { product_id: prod.id, purchase_date: '2026-08-15', price: 650 });

    const up1 = await db.startUsagePeriod(u, {
      product_id: prod.id,
      purchase_id: p1.id,
      opened_date: '2026-08-02',
    });

    let inv = await db.getUserInventory(u);
    expect(inv.active).toHaveLength(1);
    expect(inv.unopened).toHaveLength(1);
    expect(inv.unopened[0].purchase.id).toBe(p2.id);

    await db.finishUsagePeriod(u, up1.id, '2026-09-01');
    const up2 = await db.startUsagePeriod(u, {
      product_id: prod.id,
      purchase_id: p2.id,
      opened_date: '2026-09-02',
    });
    expect(up2.status).toBe('active');

    inv = await db.getUserInventory(u);
    expect(inv.unopened).toHaveLength(0);
    expect(inv.active[0].active_purchase?.price).toBe(650);
  });

  describe('purchase size handling', () => {
    it('creates, updates, and reads a purchase with size_value and size_unit', async () => {
      const db = new MockDatabase(new InMemoryStorageAdapter());
      const u = 'user-size-1';
      const product = await db.createProduct(u, {
        name: 'Cleanser',
        category: 'Skincare',
        brand: 'CeraVe',
        size_value: 236,
        size_unit: 'ml',
      });

      const created = await db.createPurchase(u, {
        product_id: product.id,
        purchase_date: '2026-10-01',
        price: 1200,
        size_value: 473,
        size_unit: 'ml',
      });
      expect(created.size_value).toBe(473);
      expect(created.size_unit).toBe('ml');

      const updated = await db.updatePurchase(u, created.id, {
        purchase_date: '2026-10-01',
        price: 1500,
        currency: 'BDT',
        size_value: 500,
        size_unit: 'ml',
      });
      expect(updated.size_value).toBe(500);
      expect(updated.size_unit).toBe('ml');

      const history = await db.getProductHistory(product.id, u);
      expect(history?.purchases[0].size_value).toBe(500);
      expect(history?.purchases[0].size_unit).toBe('ml');
    });

    it('rejects size_value <= 0 and invalid size_unit on createPurchase and updatePurchase', async () => {
      const db = new MockDatabase(new InMemoryStorageAdapter());
      const u = 'user-size-2';
      const product = await db.createProduct(u, {
        name: 'Cleanser',
        category: 'Skincare',
        brand: 'CeraVe',
        size_value: 236,
        size_unit: 'ml',
      });

      await expect(
        db.createPurchase(u, {
          product_id: product.id,
          purchase_date: '2026-10-01',
          price: 1200,
          size_value: 0,
          size_unit: 'ml',
        })
      ).rejects.toThrow(/size/i);

      await expect(
        db.createPurchase(u, {
          product_id: product.id,
          purchase_date: '2026-10-01',
          price: 1200,
          size_value: -10,
          size_unit: 'ml',
        })
      ).rejects.toThrow(/size/i);

      await expect(
        db.createPurchase(u, {
          product_id: product.id,
          purchase_date: '2026-10-01',
          price: 1200,
          size_value: 100,
          size_unit: 'oz' as never,
        })
      ).rejects.toThrow(/size/i);

      const valid = await db.createPurchase(u, {
        product_id: product.id,
        purchase_date: '2026-10-01',
        price: 1200,
      });

      await expect(
        db.updatePurchase(u, valid.id, {
          purchase_date: '2026-10-01',
          price: 1200,
          currency: 'BDT',
          size_value: 0,
          size_unit: 'ml',
        })
      ).rejects.toThrow(/size/i);

      await expect(
        db.updatePurchase(u, valid.id, {
          purchase_date: '2026-10-01',
          price: 1200,
          currency: 'BDT',
          size_value: 100,
          size_unit: 'L' as never,
        })
      ).rejects.toThrow(/size/i);
    });

    it('stores null when entered purchase size equals the product default', async () => {
      const db = new MockDatabase(new InMemoryStorageAdapter());
      const u = 'user-size-3';
      const product = await db.createProduct(u, {
        name: 'Cleanser',
        category: 'Skincare',
        brand: 'CeraVe',
        size_value: 236,
        size_unit: 'ml',
      });

      const created = await db.createPurchase(u, {
        product_id: product.id,
        purchase_date: '2026-10-01',
        price: 1200,
        size_value: 236,
        size_unit: 'ml',
      });
      expect(created.size_value).toBeNull();
      expect(created.size_unit).toBeNull();

      const updated = await db.updatePurchase(u, created.id, {
        purchase_date: '2026-10-01',
        price: 1200,
        currency: 'BDT',
        size_value: 473,
        size_unit: 'ml',
      });
      expect(updated.size_value).toBe(473);

      const reset = await db.updatePurchase(u, created.id, {
        purchase_date: '2026-10-01',
        price: 1200,
        currency: 'BDT',
        size_value: 236,
        size_unit: 'ml',
      });
      expect(reset.size_value).toBeNull();
      expect(reset.size_unit).toBeNull();
    });

    it('reads legacy purchases without size fields back as null', async () => {
      const adapter = new InMemoryStorageAdapter();
      const u = 'user-legacy';
      adapter.setItem(
        'nittoo_mock_database_v1',
        JSON.stringify({
          products: [
            {
              id: 'p-leg',
              user_id: u,
              name: 'Legacy Cleanser',
              category: 'Skincare',
              brand: 'CeraVe',
              size_value: 236,
              size_unit: 'ml',
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
          purchases: [
            {
              id: 'pu-leg',
              product_id: 'p-leg',
              purchase_date: '2026-01-01',
              price: 900,
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
          usage_periods: [],
          restock_plans: [],
        })
      );

      const db = new MockDatabase(adapter);
      const history = await db.getProductHistory('p-leg', u);
      expect(history?.purchases).toHaveLength(1);
      expect(history?.purchases[0].size_value).toBeNull();
      expect(history?.purchases[0].size_unit).toBeNull();

      const inv = await db.getUserInventory(u);
      expect(inv.unopened).toHaveLength(1);
      expect(inv.unopened[0].purchase.size_value).toBeNull();
      expect(inv.unopened[0].purchase.size_unit).toBeNull();
    });
  });
});
