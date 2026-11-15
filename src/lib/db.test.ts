import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data?: unknown; error?: { message: string } | null };

const { tableQueues, mockSupabase } = vi.hoisted(() => {
  const queues = new Map<string, { data?: unknown; error?: { message: string } | null }[]>();

  function nextResponse(table: string) {
    const queue = queues.get(table);
    if (queue && queue.length > 0) {
      return queue.shift()!;
    }
    return { data: null, error: null };
  }

  function createBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'neq',
      'in',
      'order',
      'limit',
    ];
    for (const method of chainMethods) {
      builder[method] = () => builder;
    }
    builder.single = () => Promise.resolve(nextResponse(table));
    builder.maybeSingle = () => Promise.resolve(nextResponse(table));
    builder.then = (
      onFulfilled?: (value: { data?: unknown; error?: { message: string } | null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(nextResponse(table)).then(onFulfilled, onRejected);
    return builder;
  }

  return {
    tableQueues: queues,
    mockSupabase: {
      from: (table: string) => createBuilder(table),
    },
  };
});

function pushResponse(table: string, ...results: QueryResult[]) {
  const existing = tableQueues.get(table) ?? [];
  existing.push(...results);
  tableQueues.set(table, existing);
}

vi.mock('./supabase', () => ({
  supabase: mockSupabase,
  isSupabaseConfigured: true,
}));

import { SupabaseDatabase } from './db';

describe('SupabaseDatabase (mocked Supabase client)', () => {
  let db: SupabaseDatabase;
  const userId = 'user-123';

  beforeEach(() => {
    tableQueues.clear();
    db = new SupabaseDatabase();
  });

  it('creates and updates products and validates userId', async () => {
    await expect(db.createProduct('', { name: 'A', category: 'Food & Beverage' })).rejects.toThrow(
      'User ID is required'
    );

    const productRow = {
      id: 'prod-1',
      user_id: userId,
      name: 'Shampoo',
      category: 'Haircare' as const,
      brand: 'BrandA',
      size_value: 250,
      size_unit: 'ml',
      created_at: '2026-01-01T00:00:00Z',
    };
    pushResponse('products', { data: productRow, error: null });
    const created = await db.createProduct(userId, {
      name: ' Shampoo ',
      category: 'Haircare',
      brand: ' BrandA ',
      size_value: 250,
      size_unit: 'ml',
    });
    expect(created.id).toBe('prod-1');

    pushResponse('products', { data: null, error: { message: 'insert err' } });
    await expect(db.createProduct(userId, { name: 'X', category: 'Food & Beverage' })).rejects.toThrow(
      'Failed to create product'
    );

    pushResponse('products', { data: { ...productRow, name: 'Shampoo v2' }, error: null });
    const updated = await db.updateProduct(userId, 'prod-1', {
      name: 'Shampoo v2',
      category: 'Haircare',
    });
    expect(updated.name).toBe('Shampoo v2');
  });

  it('creates and updates purchases with ownership verification', async () => {
    pushResponse('products', { data: null, error: { message: 'not found' } });
    await expect(
      db.createPurchase(userId, {
        product_id: 'prod-1',
        purchase_date: '2026-04-01',
        price: 500,
      })
    ).rejects.toThrow('Unauthorized or product does not exist');

    const purchaseRow = {
      id: 'pur-1',
      product_id: 'prod-1',
      purchase_date: '2026-04-01',
      price: 500,
      currency: 'BDT',
      store_vendor: 'Mart',
      created_at: '2026-04-01T00:00:00Z',
    };
    pushResponse('products', { data: { id: 'prod-1', user_id: userId }, error: null });
    pushResponse('purchases', { data: purchaseRow, error: null });

    const created = await db.createPurchase(userId, {
      product_id: 'prod-1',
      purchase_date: '2026-04-01',
      price: 500,
      store_vendor: ' Mart ',
    });
    expect(created.id).toBe('pur-1');

    // updatePurchase: lookup existing (with joined products) -> update
    pushResponse('purchases', {
      data: { ...purchaseRow, products: { user_id: userId } },
      error: null,
    });
    pushResponse('purchases', { data: { ...purchaseRow, price: 600 }, error: null });
    const updated = await db.updatePurchase(userId, 'pur-1', {
      purchase_date: '2026-04-01',
      price: 600,
      currency: 'BDT',
    });
    expect(updated.price).toBe(600);
  });

  it('starts, updates, finishes, and deletes usage periods', async () => {
    const usageRow = {
      id: 'up-1',
      product_id: 'prod-1',
      purchase_id: 'pur-1',
      opened_date: '2026-04-02',
      finished_date: null,
      status: 'active',
      created_at: '2026-04-02T00:00:00Z',
    };

    // startUsagePeriod: check product, check purchase, check used, check existing active, insert
    pushResponse('products', { data: { id: 'prod-1', user_id: userId }, error: null });
    pushResponse('purchases', { data: { id: 'pur-1', product_id: 'prod-1' }, error: null });
    pushResponse('usage_periods', { data: [], error: null }); // not already used
    pushResponse('usage_periods', { data: [], error: null }); // no existing active
    pushResponse('usage_periods', { data: usageRow, error: null }); // insert

    const started = await db.startUsagePeriod(userId, {
      product_id: 'prod-1',
      purchase_id: 'pur-1',
      opened_date: '2026-04-02',
    });
    expect(started.status).toBe('active');

    // updateUsagePeriod: fetch period (with joined products & purchases) -> update
    pushResponse('usage_periods', {
      data: {
        ...usageRow,
        products: { user_id: userId },
        purchases: { purchase_date: '2026-04-01' },
      },
      error: null,
    });
    pushResponse('usage_periods', {
      data: { ...usageRow, opened_date: '2026-04-03' },
      error: null,
    });
    const updated = await db.updateUsagePeriod(userId, 'up-1', { opened_date: '2026-04-03' });
    expect(updated.opened_date).toBe('2026-04-03');

    // finishUsagePeriod: fetch period (with joined products) -> update usage_periods -> update restock_plans
    pushResponse('usage_periods', {
      data: { ...usageRow, products: { user_id: userId } },
      error: null,
    });
    pushResponse('usage_periods', {
      data: { ...usageRow, status: 'finished', finished_date: '2026-04-20' },
      error: null,
    });
    pushResponse('restock_plans', { data: null, error: null });
    const finished = await db.finishUsagePeriod(userId, 'up-1', '2026-04-20');
    expect(finished.status).toBe('finished');

    // deleteUsagePeriod: fetch period (must be finished, with joined products) -> delete
    pushResponse('usage_periods', {
      data: {
        ...usageRow,
        status: 'finished',
        finished_date: '2026-04-20',
        products: { user_id: userId },
      },
      error: null,
    });
    pushResponse('usage_periods', { data: null, error: null });
    const deleted = await db.deleteUsagePeriod(userId, 'up-1');
    expect(deleted.id).toBe('up-1');
  });

  it('fetches active products, product history, all products, inventory, and export data', async () => {
    const prod = {
      id: 'prod-1',
      user_id: userId,
      name: 'Toner',
      category: 'Skincare',
      brand: null,
      size_value: 150,
      size_unit: 'ml',
      created_at: '2026-01-01T00:00:00Z',
    };
    const pur1 = {
      id: 'pur-1',
      product_id: 'prod-1',
      purchase_date: '2026-04-01',
      price: 500,
      currency: 'BDT',
      store_vendor: null,
      created_at: '2026-04-01T00:00:00Z',
    };
    const pur2 = {
      id: 'pur-2',
      product_id: 'prod-1',
      purchase_date: '2026-04-10',
      price: 650,
      currency: 'BDT',
      store_vendor: 'Store',
      created_at: '2026-04-10T00:00:00Z',
    };
    const upActive = {
      id: 'up-1',
      product_id: 'prod-1',
      purchase_id: 'pur-1',
      opened_date: '2026-04-02',
      finished_date: null,
      status: 'active',
      created_at: '2026-04-02T00:00:00Z',
    };

    // getActiveProducts
    pushResponse('products', { data: [prod], error: null });
    pushResponse('purchases', { data: [pur2, pur1], error: null });
    pushResponse('usage_periods', { data: [upActive], error: null });
    pushResponse('restock_plans', { data: [], error: null });
    const active = await db.getActiveProducts(userId);
    expect(active).toHaveLength(1);
    expect(active[0].active_purchase?.id).toBe('pur-1');
    expect(active[0].latest_purchase?.id).toBe('pur-2');
    expect(active[0].unopened_count).toBe(1);

    // getProductHistory
    pushResponse('products', { data: prod, error: null });
    pushResponse('purchases', { data: [pur2, pur1], error: null });
    pushResponse('usage_periods', { data: [upActive], error: null });
    const hist = await db.getProductHistory('prod-1', userId);
    expect(hist?.purchases).toHaveLength(2);

    // getUserProductsWithHistory
    pushResponse('products', { data: [prod], error: null });
    pushResponse('purchases', { data: [pur2, pur1], error: null });
    pushResponse('usage_periods', { data: [upActive], error: null });
    const withHist = await db.getUserProductsWithHistory(userId);
    expect(withHist).toHaveLength(1);

    // getAllUserProducts
    pushResponse('products', { data: [prod], error: null });
    expect(await db.getAllUserProducts(userId)).toHaveLength(1);

    // getUserInventory
    pushResponse('products', { data: [prod], error: null });
    pushResponse('purchases', { data: [pur2, pur1], error: null });
    pushResponse('usage_periods', { data: [upActive], error: null });
    const inv = await db.getUserInventory(userId);
    expect(inv.unopened).toHaveLength(1);
    expect(inv.unopened[0].purchase.id).toBe('pur-2');

    // exportUserData
    pushResponse('products', { data: [prod], error: null });
    pushResponse('purchases', { data: [pur2, pur1], error: null });
    pushResponse('usage_periods', { data: [upActive], error: null });
    pushResponse('restock_plans', { data: [], error: null });
    const exported = await db.exportUserData(userId);
    expect(exported.products).toHaveLength(1);
    expect(exported.purchases).toHaveLength(2);

    // resetUserData
    pushResponse('products', { data: null, error: null });
    await expect(db.resetUserData(userId)).resolves.toBeUndefined();
  });

  it('handles restock plan CRUD and importUserData', async () => {
    const planRow = {
      id: 'rp-1',
      user_id: userId,
      product_id: 'prod-1',
      usage_period_id: 'up-1',
      mode: 'relative',
      days_before_finish: 3,
      reminder_date: '2026-04-28',
      status: 'planned',
      created_at: '2026-04-02T00:00:00Z',
      updated_at: '2026-04-02T00:00:00Z',
    };

    // createRestockPlan: product -> usage_period -> existingPlan -> insert
    pushResponse('products', { data: { id: 'prod-1', user_id: userId }, error: null });
    pushResponse('usage_periods', {
      data: { id: 'up-1', product_id: 'prod-1', status: 'active' },
      error: null,
    });
    pushResponse('restock_plans', { data: null, error: null });
    pushResponse('restock_plans', { data: planRow, error: null });
    const createdPlan = await db.createRestockPlan(userId, {
      product_id: 'prod-1',
      usage_period_id: 'up-1',
      mode: 'relative',
      days_before_finish: 3,
      reminder_date: '2026-04-28',
    });
    expect(createdPlan.id).toBe('rp-1');

    pushResponse('restock_plans', { data: [planRow], error: null });
    expect(await db.getRestockPlans(userId)).toHaveLength(1);

    pushResponse('restock_plans', { data: [planRow], error: null });
    expect((await db.getRestockPlanForUsagePeriod(userId, 'up-1'))?.id).toBe('rp-1');

    pushResponse('restock_plans', { data: { ...planRow, status: 'completed' }, error: null });
    expect((await db.completeRestockPlan(userId, 'rp-1')).status).toBe('completed');

    pushResponse('restock_plans', { data: { ...planRow, status: 'dismissed' }, error: null });
    expect((await db.dismissRestockPlan(userId, 'rp-1')).status).toBe('dismissed');

    pushResponse('restock_plans', { data: null, error: null });
    await expect(db.deleteRestockPlan(userId, 'rp-1')).resolves.toBeUndefined();

    // importUserData (merge_skip_conflicts with 1 product)
    pushResponse('products', { data: [], error: null });
    pushResponse('products', { data: { id: 'prod-new' }, error: null }); // insert product
    const res = await db.importUserData(userId, {
      products: [
        {
          id: 'prod-new',
          name: 'Lotion',
          category: 'Skincare',
          brand: null,
          created_at: '2026-04-01T00:00:00Z',
        },
      ],
      purchases: [],
      usage_periods: [],
      restock_plans: [],
    });
    expect(res.restoredProducts).toBe(1);

    // createRestockPlan updating existing planned plan
    pushResponse('products', { data: { id: 'prod-1', user_id: userId }, error: null });
    pushResponse('usage_periods', {
      data: { id: 'up-1', product_id: 'prod-1', status: 'active' },
      error: null,
    });
    pushResponse('restock_plans', { data: planRow, error: null });
    pushResponse('restock_plans', {
      data: { ...planRow, reminder_date: '2026-04-30' },
      error: null,
    });
    const updatedPlan = await db.createRestockPlan(userId, {
      product_id: 'prod-1',
      usage_period_id: 'up-1',
      mode: 'custom',
      days_before_finish: null,
      reminder_date: '2026-04-30',
    });
    expect(updatedPlan.reminder_date).toBe('2026-04-30');

    // importUserData (with product + purchase + active usage + restock_plan)
    pushResponse('products', { data: [], error: null }); // existing products
    pushResponse('products', { data: { id: 'prod-r1' }, error: null }); // insert product
    pushResponse('purchases', { data: [], error: null }); // existing purchases
    pushResponse('purchases', { data: { id: 'pur-r1' }, error: null }); // insert purchase
    pushResponse('usage_periods', { data: [], error: null }); // existing periods
    pushResponse('usage_periods', { data: { id: 'up-r1' }, error: null }); // insert usage
    pushResponse('restock_plans', { data: [], error: null }); // existing plans
    pushResponse('restock_plans', { data: null, error: null }); // insert plan
    const replaceRes = await db.importUserData(userId, {
      products: [
        {
          id: 'p-old',
          name: 'Cream',
          category: 'Skincare',
          brand: null,
          created_at: '2026-04-01T00:00:00Z',
        },
      ],
      purchases: [
        {
          id: 'pur-old',
          product_id: 'p-old',
          purchase_date: '2026-04-01',
          price: 400,
          currency: 'BDT',
          store_vendor: null,
          created_at: '2026-04-01T00:00:00Z',
        },
      ],
      usage_periods: [
        {
          id: 'up-old',
          product_id: 'p-old',
          purchase_id: 'pur-old',
          opened_date: '2026-04-02',
          finished_date: null,
          status: 'active',
          created_at: '2026-04-02T00:00:00Z',
        },
      ],
      restock_plans: [
        {
          id: 'rp-old',
          product_id: 'p-old',
          usage_period_id: 'up-old',
          mode: 'relative',
          days_before_finish: 3,
          reminder_date: '2026-04-28',
          status: 'planned',
          created_at: '2026-04-02T00:00:00Z',
        },
      ],
    });
    expect(replaceRes.restoredProducts).toBe(1);
    expect(replaceRes.restoredPurchases).toBe(1);
    expect(replaceRes.restoredRestockPlans).toBe(1);
  });
});
