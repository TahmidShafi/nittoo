import { describe, it, expect } from 'vitest';
import {
  getCurrentPurchase,
  getLatestPurchasePrice,
  getActiveOrLatestPurchasePrice,
  calculateEstimatedNextPrice,
  getUpcomingPurchases,
  calculateEstimatedMonthlyConsumption,
  calculateEstimatedMonthlyConsumptionFromDetails,
  getCostEfficiencyRankings,
  getCostComparisonChartData,
  getCategorySpending,
} from './analytics';
import type { ProductWithHistory } from '../types';

const makeProductHistory = (overrides?: Partial<ProductWithHistory>): ProductWithHistory => ({
  product: {
    id: 'p1',
    user_id: 'u1',
    name: 'Hydrating Cleanser',
    category: 'Skincare',
    brand: 'CeraVe',
    size_value: 236,
    size_unit: 'ml',
    created_at: '2026-01-01T00:00:00Z',
  },
  purchases: [
    {
      id: 'pu-active',
      product_id: 'p1',
      purchase_date: '2026-07-01',
      price: 500,
      currency: 'BDT',
      store_vendor: 'Shajgoj',
      created_at: '2026-07-01T00:00:00Z',
    },
    {
      id: 'pu-backup',
      product_id: 'p1',
      purchase_date: '2026-08-20',
      price: 650,
      currency: 'BDT',
      store_vendor: 'Shajgoj',
      created_at: '2026-08-20T00:00:00Z',
    },
  ],
  finished_periods: [
    {
      id: 'fin-1',
      product_id: 'p1',
      purchase_id: 'pu-active',
      opened_date: '2026-07-01',
      finished_date: '2026-07-31', // 30 days
      status: 'finished',
      created_at: '2026-07-01T00:00:00Z',
    },
  ],
  active_usage: {
    id: 'act-1',
    product_id: 'p1',
    purchase_id: 'pu-active',
    opened_date: '2026-08-01',
    finished_date: null,
    status: 'active',
    created_at: '2026-08-01T00:00:00Z',
  },
  usage_periods: [],
  unopened_purchases: [],
  ...overrides,
});

describe('analytics', () => {
  it('uses active purchase price for current-cost metrics and historical average for upcoming', () => {
    const item = makeProductHistory();
    expect(getLatestPurchasePrice(item.purchases)).toBe(650);
    expect(getActiveOrLatestPurchasePrice(item)).toBe(500);

    const monthly = calculateEstimatedMonthlyConsumption([item]);
    expect(monthly).not.toBeNull();
    expect(monthly!).toBeCloseTo(500, 5);

    const rankings = getCostEfficiencyRankings([item]);
    expect(rankings.mostEfficient[0].costPerDay).toBeCloseTo(500 / 30, 2);

    const upcoming = getUpcomingPurchases([item], '2026-08-25');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].estimatedNextPrice).toBe(575); // (500 + 650) / 2
  });

  it('excludes inactive products from monthly run rate', () => {
    const inactive = makeProductHistory({ active_usage: null });
    expect(calculateEstimatedMonthlyConsumption([inactive])).toBeNull();
    expect(getActiveOrLatestPurchasePrice(inactive)).toBe(650);
  });

  it('handles zero-price products in getCategorySpending without NaN or division by zero', () => {
    const freeItem = makeProductHistory({
      purchases: [
        {
          id: 'pu-free',
          product_id: 'p1',
          purchase_date: '2026-07-01',
          price: 0,
          currency: 'BDT',
          store_vendor: null,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
      active_usage: {
        id: 'act-free',
        product_id: 'p1',
        purchase_id: 'pu-free',
        opened_date: '2026-08-01',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-01T00:00:00Z',
      },
    });

    const cats = getCategorySpending([freeItem]);
    expect(cats).toHaveLength(1);
    expect(cats[0].monthlyCost).toBe(0);
    expect(cats[0].percentageOfTotal).toBe(0);
  });

  it('formats comparison chart points and sorts upcoming purchases with overdue first', () => {
    const overdue = makeProductHistory();
    const soon = makeProductHistory({
      product: {
        ...overdue.product,
        id: 'p2',
        name: 'Toothpaste',
        brand: 'Sensodyne',
        category: 'Oral Care',
      },
      active_usage: {
        id: 'act-2',
        product_id: 'p2',
        purchase_id: 'pu-active',
        opened_date: '2026-08-20',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-20T00:00:00Z',
      },
    });

    const upcoming = getUpcomingPurchases([soon, overdue], '2026-09-05');
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].isOverdue).toBe(true);
    expect(upcoming[1].isOverdue).toBe(false);

    const chart = getCostComparisonChartData([overdue, soon]);
    expect(chart).toHaveLength(2);
    expect(chart[0].name).toContain('CeraVe');
    expect(calculateEstimatedNextPrice([])).toBe(0);
  });

  it('excludes products >30 days out or with 0 finished cycles from upcoming purchases and rankings', () => {
    const dueSoon = makeProductHistory();
    const farOut = makeProductHistory({
      product: { ...dueSoon.product, id: 'p-far', name: 'Far Cleanser' },
      active_usage: {
        id: 'act-far',
        product_id: 'p-far',
        purchase_id: 'pu-active',
        opened_date: '2026-08-24',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-24T00:00:00Z',
      },
      finished_periods: [
        {
          id: 'fin-far',
          product_id: 'p-far',
          purchase_id: 'pu-active',
          opened_date: '2026-05-01',
          finished_date: '2026-06-30', // 60 days
          status: 'finished',
          created_at: '2026-05-01T00:00:00Z',
        },
      ],
    });
    const noHistory = makeProductHistory({
      product: { ...dueSoon.product, id: 'p-none', name: 'New Serum' },
      finished_periods: [],
    });

    const upcoming = getUpcomingPurchases([dueSoon, farOut, noHistory], '2026-08-25');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].product.id).toBe('p1');

    const rankings = getCostEfficiencyRankings([dueSoon, farOut, noHistory]);
    expect(rankings.mostEfficient).toHaveLength(2);
    expect(rankings.mostEfficient[0].product.id).toBe('p-far'); // 500/60 < 500/30
    expect(rankings.leastEfficient[0].product.id).toBe('p1');
  });

  it('aggregates getCategorySpending across categories, normalizes to 100%, and handles empty/zero-cycle', () => {
    expect(getCategorySpending([])).toEqual([]);

    const noCycle = makeProductHistory({
      product: { ...makeProductHistory().product, id: 'p0' },
      finished_periods: [],
    });
    expect(getCategorySpending([noCycle])).toEqual([]);

    const skincare1 = makeProductHistory({
      product: { ...makeProductHistory().product, id: 's1', category: 'Skincare' },
    }); // 500/mo
    const skincare2 = makeProductHistory({
      product: { ...makeProductHistory().product, id: 's2', category: 'Skincare' },
      purchases: [
        {
          id: 'pu-s2',
          product_id: 's2',
          purchase_date: '2026-07-01',
          price: 400,
          currency: 'BDT',
          store_vendor: null,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
      active_usage: {
        id: 'act-s2',
        product_id: 's2',
        purchase_id: 'pu-s2',
        opened_date: '2026-08-01',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-01T00:00:00Z',
      },
    }); // 400/mo -> Skincare = 900/mo (60%)
    const haircare = makeProductHistory({
      product: { ...makeProductHistory().product, id: 'h1', category: 'Haircare' },
      purchases: [
        {
          id: 'pu-h1',
          product_id: 'h1',
          purchase_date: '2026-07-01',
          price: 600,
          currency: 'BDT',
          store_vendor: null,
          created_at: '2026-07-01T00:00:00Z',
        },
      ],
      active_usage: {
        id: 'act-h1',
        product_id: 'h1',
        purchase_id: 'pu-h1',
        opened_date: '2026-08-01',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-01T00:00:00Z',
      },
    }); // 600/mo (40%)

    const cats = getCategorySpending([haircare, skincare1, skincare2]);
    expect(cats).toHaveLength(2);
    expect(cats[0].category).toBe('Skincare');
    expect(cats[0].monthlyCost).toBe(900);
    expect(cats[0].productCount).toBe(2);
    expect(cats[0].percentageOfTotal).toBe(60);
    expect(cats[1].category).toBe('Haircare');
    expect(cats[1].percentageOfTotal).toBe(40);
  });

  it('uses rate-normalized predicted lifespan for costPerDay and monthly run rate on size switches', () => {
    // Product default 200ml finished in 40d (5 ml/day); active bottle is 400ml at 1000 BDT ->
    // predicted lifespan is 80d (not 40d), so costPerDay = 12.50 and monthly = 375 BDT.
    const item = makeProductHistory({
      product: {
        id: 'p-switch',
        user_id: 'u1',
        name: 'Size Switch Cleanser',
        category: 'Skincare',
        brand: 'CeraVe',
        size_value: 200,
        size_unit: 'ml',
        created_at: '2026-01-01T00:00:00Z',
      },
      purchases: [
        {
          id: 'pu-old',
          product_id: 'p-switch',
          purchase_date: '2026-01-01',
          price: 500,
          currency: 'BDT',
          store_vendor: 'Shajgoj',
          size_value: null,
          size_unit: null,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'pu-active',
          product_id: 'p-switch',
          purchase_date: '2026-03-01',
          price: 1000,
          currency: 'BDT',
          store_vendor: 'Shajgoj',
          size_value: 400,
          size_unit: 'ml',
          created_at: '2026-03-01T00:00:00Z',
        },
      ],
      finished_periods: [
        {
          id: 'f-1',
          product_id: 'p-switch',
          purchase_id: 'pu-old',
          opened_date: '2026-01-01',
          finished_date: '2026-02-10', // 40 days
          status: 'finished',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      active_usage: {
        id: 'a-1',
        product_id: 'p-switch',
        purchase_id: 'pu-active',
        opened_date: '2026-03-01',
        finished_date: null,
        status: 'active',
        created_at: '2026-03-01T00:00:00Z',
      },
    });

    const rankings = getCostEfficiencyRankings([item]);
    expect(rankings.mostEfficient[0].averageLifespan).toBe(80);
    expect(rankings.mostEfficient[0].costPerDay).toBe(12.5);
    expect(calculateEstimatedMonthlyConsumption([item])).toBe(375);
  });

  it('Dashboard and Analytics produce identical monthly consumption using active purchase price when backup differs', () => {
    const activePurchase = {
      id: 'pu-active',
      product_id: 'p-diff',
      purchase_date: '2026-02-01',
      price: 400,
      currency: 'BDT',
      vendor: 'Active Mart',
      size_value: 200,
      size_unit: 'ml' as const,
      created_at: '2026-02-01T00:00:00Z',
    };
    const latestBackupPurchase = {
      id: 'pu-backup',
      product_id: 'p-diff',
      purchase_date: '2026-03-10',
      price: 900,
      currency: 'BDT',
      vendor: 'Backup Mart',
      size_value: 200,
      size_unit: 'ml' as const,
      created_at: '2026-03-10T00:00:00Z',
    };
    const finishedPeriod = {
      id: 'u-1',
      product_id: 'p-diff',
      purchase_id: 'pu-old',
      opened_date: '2026-01-01',
      finished_date: '2026-01-31',
      status: 'finished' as const,
      created_at: '2026-01-01T00:00:00Z',
    };
    const activeUsage = {
      id: 'u-2',
      product_id: 'p-diff',
      purchase_id: 'pu-active',
      opened_date: '2026-02-01',
      finished_date: null,
      status: 'active' as const,
      created_at: '2026-02-01T00:00:00Z',
    };

    const history = makeProductHistory({
      product: {
        id: 'p-diff',
        user_id: 'u1',
        name: 'Facewash',
        category: 'Skincare',
        brand: 'Simple',
        size_value: 200,
        size_unit: 'ml',
        created_at: '2026-01-01T00:00:00Z',
      },
      purchases: [latestBackupPurchase, activePurchase],
      finished_periods: [finishedPeriod],
      usage_periods: [finishedPeriod, activeUsage],
      active_usage: activeUsage,
    });

    const details = {
      ...history.product,
      purchases: [latestBackupPurchase, activePurchase],
      active_purchase: activePurchase,
      latest_purchase: latestBackupPurchase,
      active_usage: activeUsage,
      finished_periods: [finishedPeriod],
      unopened_count: 1,
    };

    const analyticsTotal = calculateEstimatedMonthlyConsumption([history]);
    const dashboardTotal = calculateEstimatedMonthlyConsumptionFromDetails([details]);

    expect(analyticsTotal).toBe(400); // 400 / 30 * 30 = 400 (uses active purchase, not 900 backup)
    expect(dashboardTotal).toBe(analyticsTotal);
  });

  it('handles products with all-finished cycles, unopened-only stock, or no purchases without crashing and reconciles category spending', () => {
    const activeProduct = makeProductHistory(); // Skincare, active, 500/mo

    const allFinished = makeProductHistory({
      product: {
        ...makeProductHistory().product,
        id: 'p-finished-only',
        name: 'Body Lotion',
        category: 'Body Care',
      },
      active_usage: null,
      usage_periods: makeProductHistory().finished_periods,
    });

    const unopenedOnly = makeProductHistory({
      product: {
        ...makeProductHistory().product,
        id: 'p-unopened-only',
        name: 'Handwash Refill',
        category: 'Household Cleaning',
      },
      active_usage: null,
      finished_periods: [],
      usage_periods: [],
      unopened_purchases: makeProductHistory().purchases,
    });

    const noPurchases = makeProductHistory({
      product: {
        ...makeProductHistory().product,
        id: 'p-no-purchases',
        name: 'Empty Item',
        category: 'Other',
      },
      purchases: [],
      active_usage: null,
      finished_periods: [],
      usage_periods: [],
    });

    const all = [activeProduct, allFinished, unopenedOnly, noPurchases];

    expect(getCurrentPurchase(allFinished)?.id).toBe('pu-backup');
    expect(getCurrentPurchase(unopenedOnly)?.id).toBe('pu-backup');
    expect(getCurrentPurchase(noPurchases)).toBeNull();

    expect(getActiveOrLatestPurchasePrice(allFinished)).toBe(650);
    expect(getActiveOrLatestPurchasePrice(unopenedOnly)).toBe(650);
    expect(getActiveOrLatestPurchasePrice(noPurchases)).toBeNull();

    expect(calculateEstimatedNextPrice(noPurchases.purchases)).toBe(0);
    expect(getUpcomingPurchases(all, '2026-08-25').length).toBeGreaterThanOrEqual(0);

    // Rankings include finished-only via latest purchase, exclude unopened-only & no-purchases
    const rankings = getCostEfficiencyRankings(all);
    expect(rankings.mostEfficient.map((r) => r.product.id)).toEqual(
      expect.arrayContaining(['p1', 'p-finished-only'])
    );
    expect(rankings.mostEfficient).toHaveLength(2);
    expect(getCostComparisonChartData(all)).toHaveLength(2);

    // Category spending includes only active products and reconciles with monthly total
    const monthlyTotal = calculateEstimatedMonthlyConsumption(all);
    const categories = getCategorySpending(all);
    const categorySum = categories.reduce((sum, c) => sum + c.monthlyCost, 0);
    expect(monthlyTotal).toBeCloseTo(500, 5);
    expect(categorySum).toBeCloseTo(monthlyTotal ?? 0, 5);
    expect(categories.map((c) => c.category)).toEqual(['Skincare']);
  });
});
