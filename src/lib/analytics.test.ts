import { describe, it, expect } from 'vitest';
import {
  getLatestPurchasePrice,
  getActiveOrLatestPurchasePrice,
  calculateEstimatedNextPrice,
  getUpcomingPurchases,
  calculateEstimatedMonthlyConsumption,
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
});
