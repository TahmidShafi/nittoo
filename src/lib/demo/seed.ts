// ==============================================================================
// Nittoo Demo Mode Seed Data (Pure Function)
// Generates ~12 realistic products across categories spanning 12-18 months
// of purchases and finished cycles, plus an unopened backup and a restock plan.
// ==============================================================================

import { addDays, getTodayLocal } from '../dateUtils';
import type {
  Product,
  Purchase,
  UsagePeriod,
  RestockPlan,
  ProductCategory,
  SizeUnit,
} from '../../types';

export interface DemoSeedBundle {
  products: Product[];
  purchases: Purchase[];
  usage_periods: UsagePeriod[];
  restock_plans: RestockPlan[];
}

interface ProductTemplate {
  slug: string;
  name: string;
  brand: string;
  category: ProductCategory;
  size_value: number;
  size_unit: SizeUnit;
  basePrice: number;
  vendor: string;
  cycleDays: number[]; // finished cycle lengths from oldest to newest
  activeDaysAgo?: number; // if set, has an active bottle opened N days ago
  activeSizeOverride?: number; // optional pack size override for the active purchase
  activePriceOverride?: number; // optional price override matching activeSizeOverride
  hasUnopenedBackup?: boolean;
  backupPriceOffset?: number;
  hasRestockPlan?: boolean;
}

const DEMO_TEMPLATES: ProductTemplate[] = [
  {
    slug: 'cerave-cleanser',
    name: 'Hydrating Facial Cleanser',
    brand: 'CeraVe',
    category: 'Skincare',
    size_value: 236,
    size_unit: 'ml',
    basePrice: 1650,
    vendor: 'Shajgoj',
    cycleDays: [64, 61, 63, 60, 62],
    activeDaysAgo: 48,
    hasUnopenedBackup: true,
    backupPriceOffset: 100,
    hasRestockPlan: true,
  },
  {
    slug: 'biore-sunscreen',
    name: 'UV Aqua Rich Watery Essence SPF50+',
    brand: 'Biore',
    category: 'Skincare',
    size_value: 50,
    size_unit: 'g',
    basePrice: 1150,
    vendor: 'Shajgoj',
    cycleDays: [44, 46, 42, 45, 43],
    activeDaysAgo: 40,
  },
  {
    slug: 'sensodyne-rapid',
    name: 'Rapid Relief Toothpaste',
    brand: 'Sensodyne',
    category: 'Oral Care',
    size_value: 100,
    size_unit: 'g',
    basePrice: 460,
    vendor: 'Unimart',
    cycleDays: [46, 45, 44, 47, 45, 46],
    activeDaysAgo: 49, // overdue by ~3 days
  },
  {
    slug: 'oralb-floss',
    name: 'Essential Floss Mint',
    brand: 'Oral-B',
    category: 'Oral Care',
    size_value: 50,
    size_unit: 'count',
    basePrice: 320,
    vendor: 'Lazz Pharma',
    cycleDays: [90, 95, 88],
    activeDaysAgo: 35,
  },
  {
    slug: 'loreal-shampoo',
    name: 'Elvive Hyaluron Moisture Shampoo',
    brand: "L'Oreal Paris",
    category: 'Haircare',
    size_value: 340,
    size_unit: 'ml',
    basePrice: 890,
    vendor: 'Daraz',
    cycleDays: [75, 78, 72, 74],
    activeDaysAgo: 30,
    activeSizeOverride: 650,
    activePriceOverride: 1490,
  },
  {
    slug: 'dove-bodywash',
    name: 'Deeply Nourishing Body Wash',
    brand: 'Dove',
    category: 'Body Care',
    size_value: 500,
    size_unit: 'ml',
    basePrice: 780,
    vendor: 'Unimart',
    cycleDays: [58, 60, 56, 59],
    activeDaysAgo: 22,
  },
  {
    slug: 'nivea-deo',
    name: 'Fresh Active Roll-On Deodorant',
    brand: 'Nivea',
    category: 'Personal Hygiene',
    size_value: 50,
    size_unit: 'ml',
    basePrice: 380,
    vendor: 'Chaldal',
    cycleDays: [70, 68, 72],
    activeDaysAgo: 55,
  },
  {
    slug: 'gillette-foam',
    name: 'Series Sensitive Shave Foam',
    brand: 'Gillette',
    category: 'Shaving & Grooming',
    size_value: 245,
    size_unit: 'g',
    basePrice: 490,
    vendor: 'Unimart',
    cycleDays: [110, 105],
    activeDaysAgo: 40,
  },
  {
    slug: 'vim-dishwash',
    name: 'Dishwash Liquid Lemon',
    brand: 'Vim',
    category: 'Household Cleaning',
    size_value: 500,
    size_unit: 'ml',
    basePrice: 240,
    vendor: 'Chaldal',
    cycleDays: [38, 40, 39, 41, 37, 40],
    activeDaysAgo: 28,
  },
  {
    slug: 'surf-excel',
    name: 'Matic Liquid Detergent',
    brand: 'Surf Excel',
    category: 'Laundry',
    size_value: 1000,
    size_unit: 'ml',
    basePrice: 540,
    vendor: 'Chaldal',
    cycleDays: [48, 52, 50, 49],
    activeDaysAgo: 18,
  },
  {
    slug: 'omega3-softgels',
    name: 'Triple Strength Omega-3 Fish Oil',
    brand: 'NOW Foods',
    category: 'Supplements',
    size_value: 90,
    size_unit: 'count',
    basePrice: 2450,
    vendor: 'Lazz Pharma',
    cycleDays: [90, 90, 90],
    activeDaysAgo: 45,
  },
  {
    slug: 'nescafe-gold',
    name: 'Gold Blend Instant Coffee',
    brand: 'Nescafe',
    category: 'Food & Beverage',
    size_value: 200,
    size_unit: 'g',
    basePrice: 1350,
    vendor: 'Unimart',
    cycleDays: [55, 58, 54],
    activeDaysAgo: 12,
  },
];

/**
 * Pure deterministic demo dataset generator.
 * Produces 12 products across 10 categories with 12-18 months of historical
 * purchases & finished cycles, 1 unopened backup, and 1 active restock plan.
 */
export function buildDemoSeedData(
  userId: string,
  referenceDate: string = getTodayLocal()
): DemoSeedBundle {
  const products: Product[] = [];
  const purchases: Purchase[] = [];
  const usage_periods: UsagePeriod[] = [];
  const restock_plans: RestockPlan[] = [];

  for (const tpl of DEMO_TEMPLATES) {
    const productId = `demo-prod-${tpl.slug}`;
    const totalFinishedDays = tpl.cycleDays.reduce((s, d) => s + d, 0);
    const activeOffset = tpl.activeDaysAgo ?? 0;
    // Start 12-18 months back based on total cycle span
    const firstOpenedDate = addDays(
      referenceDate,
      -(totalFinishedDays + activeOffset + tpl.cycleDays.length * 2)
    );

    products.push({
      id: productId,
      user_id: userId,
      name: tpl.name,
      brand: tpl.brand,
      category: tpl.category,
      size_value: tpl.size_value,
      size_unit: tpl.size_unit,
      created_at: `${firstOpenedDate}T08:00:00.000Z`,
    });

    let cursorDate = firstOpenedDate;

    tpl.cycleDays.forEach((duration, idx) => {
      const purchaseDate = addDays(cursorDate, -1);
      const finishedDate = addDays(cursorDate, duration);
      const purchaseId = `demo-pur-${tpl.slug}-f${idx + 1}`;
      const usageId = `demo-use-${tpl.slug}-f${idx + 1}`;
      // Slight realistic price progression over 12-18 months
      const price = tpl.basePrice + Math.floor(idx / 2) * 20;

      purchases.push({
        id: purchaseId,
        product_id: productId,
        purchase_date: purchaseDate,
        price,
        currency: 'BDT',
        store_vendor: tpl.vendor,
        created_at: `${purchaseDate}T10:00:00.000Z`,
      });

      usage_periods.push({
        id: usageId,
        product_id: productId,
        purchase_id: purchaseId,
        opened_date: cursorDate,
        finished_date: finishedDate,
        status: 'finished',
        created_at: `${cursorDate}T10:00:00.000Z`,
      });

      cursorDate = addDays(finishedDate, 2);
    });

    // Active bottle
    if (tpl.activeDaysAgo !== undefined) {
      const openedDate = addDays(referenceDate, -tpl.activeDaysAgo);
      const purchaseDate = addDays(openedDate, -2);
      const activePurchaseId = `demo-pur-${tpl.slug}-active`;
      const activeUsageId = `demo-use-${tpl.slug}-active`;
      const latestCyclePrice =
        tpl.activePriceOverride ?? tpl.basePrice + Math.floor(tpl.cycleDays.length / 2) * 20;

      purchases.push({
        id: activePurchaseId,
        product_id: productId,
        purchase_date: purchaseDate,
        price: latestCyclePrice,
        currency: 'BDT',
        store_vendor: tpl.vendor,
        size_value: tpl.activeSizeOverride ?? null,
        size_unit: tpl.activeSizeOverride ? tpl.size_unit : null,
        created_at: `${purchaseDate}T10:00:00.000Z`,
      });

      usage_periods.push({
        id: activeUsageId,
        product_id: productId,
        purchase_id: activePurchaseId,
        opened_date: openedDate,
        finished_date: null,
        status: 'active',
        created_at: `${openedDate}T10:00:00.000Z`,
      });

      if (tpl.hasRestockPlan) {
        const avgLifespan = Math.round(
          tpl.cycleDays.reduce((a, b) => a + b, 0) / tpl.cycleDays.length
        );
        const expectedFinish = addDays(openedDate, avgLifespan);
        const reminderDate = addDays(expectedFinish, -14);
        restock_plans.push({
          id: `demo-rp-${tpl.slug}`,
          user_id: userId,
          product_id: productId,
          usage_period_id: activeUsageId,
          mode: 'relative',
          days_before_finish: 14,
          reminder_date: reminderDate,
          status: 'planned',
          created_at: `${openedDate}T12:00:00.000Z`,
          completed_at: null,
        });
      }
    }

    // Unopened backup purchase
    if (tpl.hasUnopenedBackup) {
      const backupDate = addDays(referenceDate, -5);
      purchases.push({
        id: `demo-pur-${tpl.slug}-backup`,
        product_id: productId,
        purchase_date: backupDate,
        price: tpl.basePrice + (tpl.backupPriceOffset ?? 50),
        currency: 'BDT',
        store_vendor: tpl.vendor,
        created_at: `${backupDate}T14:00:00.000Z`,
      });
    }
  }

  return { products, purchases, usage_periods, restock_plans };
}
