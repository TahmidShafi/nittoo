// ==============================================================================
// Nittoo Mock Database Layer
// LocalStorage Persistence, Multi-User Isolation, and Storage Abstraction
// ==============================================================================

import { getTodayUTC } from './dateUtils';
import type {
  IDataSource,
  Product,
  Purchase,
  UsagePeriod,
  CreateProductInput,
  CreatePurchaseInput,
  StartUsagePeriodInput,
  UpdateProductInput,
  UpdatePurchaseInput,
  UpdateUsagePeriodInput,
  ProductWithDetails,
  ProductWithHistory,
  UserInventory,
  UnopenedInventoryItem,
} from '../types';

export const DEFAULT_MOCK_USER_ID = 'default-mock-user';
export const UNOPENED_MOCK_USER_ID = 'unopened-mock-user';

// ------------------------------------------------------------------------------
// Storage Abstraction (Browser LocalStorage vs In-Memory Map)
// ------------------------------------------------------------------------------

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class BrowserStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

// ------------------------------------------------------------------------------
// Internal Stored Schema
// ------------------------------------------------------------------------------

interface StoredData {
  products: Product[];
  purchases: Purchase[];
  usage_periods: UsagePeriod[];
}

const STORAGE_KEY = 'nittoo_mock_database_v1';

// ------------------------------------------------------------------------------
// Mock Database Class
// ------------------------------------------------------------------------------

export class MockDatabase implements IDataSource {
  private adapter: StorageAdapter;

  constructor(adapter: StorageAdapter = new BrowserStorageAdapter()) {
    this.adapter = adapter;
    this.ensureInitialized();
  }

  private getData(): StoredData {
    const raw = this.adapter.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: StoredData = { products: [], purchases: [], usage_periods: [] };
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { products: [], purchases: [], usage_periods: [] };
    }
  }

  private saveData(data: StoredData): void {
    this.adapter.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private ensureInitialized(): void {
    const existing = this.adapter.getItem(STORAGE_KEY);
    if (!existing) {
      this.seedDefaultData();
    }
  }

  public seedDefaultData(): void {
    const seedTime = '2026-08-30T10:00:00.000Z';

    // 1. CeraVe Hydrating Cleanser (2 finished periods: 61d, 63d; 1 active)
    const ceraveProduct: Product = {
      id: 'prod-cerave-cleanser',
      user_id: DEFAULT_MOCK_USER_ID,
      name: 'CeraVe Hydrating Cleanser',
      category: 'Skincare',
      brand: 'CeraVe',
      size_value: 236,
      size_unit: 'ml',
      created_at: seedTime,
    };

    const ceravePurchases: Purchase[] = [
      {
        id: 'pur-cerave-1',
        product_id: ceraveProduct.id,
        purchase_date: '2026-04-26',
        price: 1250,
        currency: 'BDT',
        created_at: '2026-04-26T10:00:00.000Z',
      },
      {
        id: 'pur-cerave-2',
        product_id: ceraveProduct.id,
        purchase_date: '2026-06-27',
        price: 1250,
        currency: 'BDT',
        created_at: '2026-06-27T10:00:00.000Z',
      },
      {
        id: 'pur-cerave-3',
        product_id: ceraveProduct.id,
        purchase_date: '2026-08-30',
        price: 1250,
        currency: 'BDT',
        created_at: '2026-08-30T10:00:00.000Z',
      },
    ];

    const ceraveUsage: UsagePeriod[] = [
      {
        id: 'use-cerave-1',
        product_id: ceraveProduct.id,
        purchase_id: 'pur-cerave-1',
        opened_date: '2026-04-26',
        finished_date: '2026-06-26', // 61 days
        status: 'finished',
        created_at: '2026-04-26T10:00:00.000Z',
      },
      {
        id: 'use-cerave-2',
        product_id: ceraveProduct.id,
        purchase_id: 'pur-cerave-2',
        opened_date: '2026-06-27',
        finished_date: '2026-08-29', // 63 days
        status: 'finished',
        created_at: '2026-06-27T10:00:00.000Z',
      },
      {
        id: 'use-cerave-3',
        product_id: ceraveProduct.id,
        purchase_id: 'pur-cerave-3',
        opened_date: '2026-08-30',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-30T10:00:00.000Z',
      },
    ];

    // 2. Olaplex No. 4 Shampoo (0 finished periods, 1 active)
    const olaplexProduct: Product = {
      id: 'prod-olaplex-shampoo',
      user_id: DEFAULT_MOCK_USER_ID,
      name: 'Olaplex No. 4 Shampoo',
      category: 'Haircare',
      brand: 'Olaplex',
      size_value: 250,
      size_unit: 'ml',
      created_at: '2026-08-15T10:00:00.000Z',
    };

    const olaplexPurchases: Purchase[] = [
      {
        id: 'pur-olaplex-1',
        product_id: olaplexProduct.id,
        purchase_date: '2026-08-15',
        price: 3200,
        currency: 'BDT',
        created_at: '2026-08-15T10:00:00.000Z',
      },
    ];

    const olaplexUsage: UsagePeriod[] = [
      {
        id: 'use-olaplex-1',
        product_id: olaplexProduct.id,
        purchase_id: 'pur-olaplex-1',
        opened_date: '2026-08-15',
        finished_date: null,
        status: 'active',
        created_at: '2026-08-15T10:00:00.000Z',
      },
    ];

    // 3. Sensodyne Rapid Relief (1 finished period: 45d; 1 active)
    const sensodyneProduct: Product = {
      id: 'prod-sensodyne-toothpaste',
      user_id: DEFAULT_MOCK_USER_ID,
      name: 'Sensodyne Rapid Relief Toothpaste',
      category: 'Oral Care',
      brand: 'Sensodyne',
      size_value: 100,
      size_unit: 'g',
      created_at: '2026-06-01T10:00:00.000Z',
    };

    const sensodynePurchases: Purchase[] = [
      {
        id: 'pur-sensodyne-1',
        product_id: sensodyneProduct.id,
        purchase_date: '2026-06-01',
        price: 480,
        currency: 'BDT',
        created_at: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'pur-sensodyne-2',
        product_id: sensodyneProduct.id,
        purchase_date: '2026-07-17',
        price: 480,
        currency: 'BDT',
        created_at: '2026-07-17T10:00:00.000Z',
      },
    ];

    const sensodyneUsage: UsagePeriod[] = [
      {
        id: 'use-sensodyne-1',
        product_id: sensodyneProduct.id,
        purchase_id: 'pur-sensodyne-1',
        opened_date: '2026-06-01',
        finished_date: '2026-07-16', // 45 days
        status: 'finished',
        created_at: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'use-sensodyne-2',
        product_id: sensodyneProduct.id,
        purchase_id: 'pur-sensodyne-2',
        opened_date: '2026-07-17',
        finished_date: null,
        status: 'active',
        created_at: '2026-07-17T10:00:00.000Z',
      },
    ];

    // 4. Deterministic Unopened Seed Data for Lifecycle Verification
    const unopenedProductOnly: Product = {
      id: 'prod-unopened-only',
      user_id: UNOPENED_MOCK_USER_ID,
      name: 'Laneige Lip Sleeping Mask',
      category: 'Skincare',
      brand: 'Laneige',
      size_value: 20,
      size_unit: 'g',
      created_at: seedTime,
    };

    const unopenedProductOnlyPurchases: Purchase[] = [
      {
        id: 'pur-unopened-only-1',
        product_id: unopenedProductOnly.id,
        purchase_date: '2026-08-20',
        price: 1800,
        currency: 'BDT',
        created_at: seedTime,
      },
    ];

    const unopenedProductBackup: Product = {
      id: 'prod-unopened-backup',
      user_id: UNOPENED_MOCK_USER_ID,
      name: 'Bioderma Sensibio H2O Micellar Water',
      category: 'Skincare',
      brand: 'Bioderma',
      size_value: 500,
      size_unit: 'ml',
      created_at: seedTime,
    };

    const unopenedProductBackupPurchases: Purchase[] = [
      {
        id: 'pur-unopened-backup-1',
        product_id: unopenedProductBackup.id,
        purchase_date: '2026-08-01',
        price: 1650,
        currency: 'BDT',
        created_at: seedTime,
      },
      {
        id: 'pur-unopened-backup-2',
        product_id: unopenedProductBackup.id,
        purchase_date: '2026-08-25',
        price: 1700,
        currency: 'BDT',
        created_at: seedTime,
      },
    ];

    const unopenedProductBackupUsage: UsagePeriod[] = [
      {
        id: 'use-unopened-backup-1',
        product_id: unopenedProductBackup.id,
        purchase_id: 'pur-unopened-backup-1',
        opened_date: '2026-08-01',
        finished_date: null,
        status: 'active',
        created_at: seedTime,
      },
    ];

    const initialData: StoredData = {
      products: [
        ceraveProduct,
        olaplexProduct,
        sensodyneProduct,
        unopenedProductOnly,
        unopenedProductBackup,
      ],
      purchases: [
        ...ceravePurchases,
        ...olaplexPurchases,
        ...sensodynePurchases,
        ...unopenedProductOnlyPurchases,
        ...unopenedProductBackupPurchases,
      ],
      usage_periods: [
        ...ceraveUsage,
        ...olaplexUsage,
        ...sensodyneUsage,
        ...unopenedProductBackupUsage,
      ],
    };

    this.saveData(initialData);
  }

  // ----------------------------------------------------------------------------
  // IDataSource Implementation
  // ----------------------------------------------------------------------------

  async createProduct(userId: string, input: CreateProductInput): Promise<Product> {
    if (!userId) throw new Error('User ID is required');
    if (!input.name || !input.name.trim()) throw new Error('Product name is required');
    if (!input.category) throw new Error('Product category is required');
    if (input.size_value !== undefined && input.size_value !== null && input.size_value <= 0) {
      throw new Error('Size value must be greater than zero');
    }

    const data = this.getData();
    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      name: input.name.trim(),
      category: input.category,
      brand: input.brand?.trim() || null,
      size_value: input.size_value ?? null,
      size_unit: input.size_unit ?? null,
      created_at: new Date().toISOString(),
    };

    data.products.push(newProduct);
    this.saveData(data);
    return newProduct;
  }

  async createPurchase(userId: string, input: CreatePurchaseInput): Promise<Purchase> {
    if (!userId) throw new Error('User ID is required');
    if (input.price < 0) throw new Error('Purchase price cannot be negative');

    const data = this.getData();
    const product = data.products.find((p) => p.id === input.product_id);
    if (!product) {
      throw new Error('Product not found');
    }
    if (product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    const newPurchase: Purchase = {
      id: `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      product_id: input.product_id,
      purchase_date: input.purchase_date,
      price: input.price,
      currency: input.currency || 'BDT',
      created_at: new Date().toISOString(),
    };

    data.purchases.push(newPurchase);
    this.saveData(data);
    return newPurchase;
  }

  async startUsagePeriod(userId: string, input: StartUsagePeriodInput): Promise<UsagePeriod> {
    if (!userId) throw new Error('User ID is required');

    const data = this.getData();
    const product = data.products.find((p) => p.id === input.product_id);
    if (!product) throw new Error('Product not found');
    if (product.user_id !== userId) throw new Error('Unauthorized: You do not own this product');

    const purchase = data.purchases.find((pu) => pu.id === input.purchase_id);
    if (!purchase) throw new Error('Purchase not found');
    if (purchase.product_id !== product.id) {
      throw new Error('Purchase does not belong to the specified product');
    }

    // Constraint: only one active usage period per product
    const existingActive = data.usage_periods.find(
      (u) => u.product_id === input.product_id && u.status === 'active'
    );
    if (existingActive) {
      throw new Error('Product already has an active usage period');
    }

    // Constraint: purchase cannot already be opened/used
    const alreadyUsed = data.usage_periods.some((u) => u.purchase_id === input.purchase_id);
    if (alreadyUsed) {
      throw new Error('This purchase has already been opened or used');
    }

    const newPeriod: UsagePeriod = {
      id: `use-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      product_id: input.product_id,
      purchase_id: input.purchase_id,
      opened_date: input.opened_date,
      finished_date: null,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    data.usage_periods.push(newPeriod);
    this.saveData(data);
    return newPeriod;
  }

  async finishUsagePeriod(
    userId: string,
    usagePeriodId: string,
    finishedDate: string
  ): Promise<UsagePeriod> {
    if (!userId) throw new Error('User ID is required');

    const data = this.getData();
    const periodIndex = data.usage_periods.findIndex((u) => u.id === usagePeriodId);
    if (periodIndex === -1) {
      throw new Error('Usage period not found');
    }

    const period = data.usage_periods[periodIndex];
    const product = data.products.find((p) => p.id === period.product_id);
    if (!product || product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    if (finishedDate < period.opened_date) {
      throw new Error('Finished date cannot be earlier than opened date');
    }

    const updatedPeriod: UsagePeriod = {
      ...period,
      finished_date: finishedDate,
      status: 'finished',
    };

    data.usage_periods[periodIndex] = updatedPeriod;
    this.saveData(data);
    return updatedPeriod;
  }

  async updateProduct(
    userId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    if (!userId) throw new Error('User ID is required');
    if (!input.name || !input.name.trim()) throw new Error('Product name is required');
    if (!input.category) throw new Error('Product category is required');
    if (input.size_value !== undefined && input.size_value !== null && input.size_value <= 0) {
      throw new Error('Size value must be greater than zero');
    }

    const data = this.getData();
    const productIndex = data.products.findIndex((p) => p.id === productId);
    if (productIndex === -1) {
      throw new Error('Product not found');
    }

    const product = data.products[productIndex];
    if (product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    const updatedProduct: Product = {
      ...product,
      name: input.name.trim(),
      category: input.category,
      brand: input.brand?.trim() || null,
      size_value: input.size_value ?? null,
      size_unit: input.size_unit ?? null,
    };

    data.products[productIndex] = updatedProduct;
    this.saveData(data);
    return updatedProduct;
  }

  async updatePurchase(
    userId: string,
    purchaseId: string,
    input: UpdatePurchaseInput
  ): Promise<Purchase> {
    if (!userId) throw new Error('User ID is required');
    if (!input.purchase_date || !input.purchase_date.trim()) {
      throw new Error('Purchase date is required');
    }
    if (
      input.price === undefined ||
      input.price === null ||
      isNaN(input.price) ||
      input.price < 0
    ) {
      throw new Error('Purchase price cannot be negative');
    }
    if (!input.currency || !input.currency.trim()) {
      throw new Error('Currency is required');
    }

    const data = this.getData();
    const purchaseIndex = data.purchases.findIndex((pu) => pu.id === purchaseId);
    if (purchaseIndex === -1) {
      throw new Error('Purchase not found');
    }

    const purchase = data.purchases[purchaseIndex];
    const product = data.products.find((p) => p.id === purchase.product_id);
    if (!product || product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this purchase');
    }

    // Check if an active usage period is linked to this purchase
    const linkedUsage = data.usage_periods.find(
      (u) => u.purchase_id === purchaseId && u.status === 'active'
    );
    if (linkedUsage && linkedUsage.opened_date < input.purchase_date) {
      throw new Error('Opened date cannot be earlier than purchase date');
    }

    const updatedPurchase: Purchase = {
      ...purchase,
      purchase_date: input.purchase_date,
      price: input.price,
      currency: input.currency.trim() || 'BDT',
    };

    data.purchases[purchaseIndex] = updatedPurchase;
    this.saveData(data);
    return updatedPurchase;
  }

  async updateUsagePeriod(
    userId: string,
    usagePeriodId: string,
    input: UpdateUsagePeriodInput
  ): Promise<UsagePeriod> {
    if (!userId) throw new Error('User ID is required');
    if (!input.opened_date || !input.opened_date.trim()) {
      throw new Error('Opened date is required');
    }

    const today = getTodayUTC();
    if (input.opened_date > today) {
      throw new Error('Opened date cannot be in the future');
    }

    const data = this.getData();
    const periodIndex = data.usage_periods.findIndex((u) => u.id === usagePeriodId);
    if (periodIndex === -1) {
      throw new Error('Usage period not found');
    }

    const period = data.usage_periods[periodIndex];
    const product = data.products.find((p) => p.id === period.product_id);
    if (!product || product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    if (period.status !== 'active') {
      throw new Error('Only active bottles can be edited');
    }

    const purchase = data.purchases.find((pu) => pu.id === period.purchase_id);
    if (purchase && input.opened_date < purchase.purchase_date) {
      throw new Error('Opened date cannot be earlier than purchase date');
    }

    const updatedPeriod: UsagePeriod = {
      ...period,
      opened_date: input.opened_date,
    };

    data.usage_periods[periodIndex] = updatedPeriod;
    this.saveData(data);
    return updatedPeriod;
  }

  async getActiveProducts(userId: string): Promise<ProductWithDetails[]> {
    if (!userId) return [];

    const data = this.getData();
    const userProducts = data.products.filter((p) => p.user_id === userId);

    const results: ProductWithDetails[] = [];

    for (const product of userProducts) {
      const activeUsage =
        data.usage_periods.find(
          (u) => u.product_id === product.id && u.status === 'active'
        ) || null;

      // Only include active products on dashboard
      if (activeUsage) {
        const latestPurchase =
          data.purchases
            .filter((pu) => pu.product_id === product.id)
            .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0] || null;

        const finishedPeriods = data.usage_periods.filter(
          (u) => u.product_id === product.id && u.status === 'finished'
        );

        const usedPurchaseIds = new Set(data.usage_periods.map((u) => u.purchase_id));
        const unopenedCount = data.purchases.filter(
          (pu) => pu.product_id === product.id && !usedPurchaseIds.has(pu.id)
        ).length;

        const activePurchase =
          data.purchases.find((pu) => pu.id === activeUsage.purchase_id) || latestPurchase || null;

        results.push({
          ...product,
          active_usage: activeUsage,
          latest_purchase: latestPurchase,
          active_purchase: activePurchase,
          finished_count: finishedPeriods.length,
          finished_periods: finishedPeriods,
          unopened_count: unopenedCount,
        });
      }
    }

    return results;
  }

  async getProductHistory(
    productId: string,
    userId: string
  ): Promise<ProductWithHistory | null> {
    if (!userId || !productId) return null;

    const data = this.getData();
    const product = data.products.find((p) => p.id === productId);
    if (!product) return null;
    if (product.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    const purchases = data.purchases
      .filter((pu) => pu.product_id === productId)
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

    const usagePeriods = data.usage_periods
      .filter((u) => u.product_id === productId)
      .sort((a, b) => b.opened_date.localeCompare(a.opened_date));

    const activeUsage = usagePeriods.find((u) => u.status === 'active') || null;
    const finishedPeriods = usagePeriods.filter((u) => u.status === 'finished');

    const usedPurchaseIds = new Set(usagePeriods.map((u) => u.purchase_id));
    const unopenedPurchases = purchases.filter((pu) => !usedPurchaseIds.has(pu.id));

    return {
      product,
      purchases,
      usage_periods: usagePeriods,
      active_usage: activeUsage,
      finished_periods: finishedPeriods,
      unopened_purchases: unopenedPurchases,
    };
  }

  async getAllUserProducts(userId: string): Promise<Product[]> {
    if (!userId) return [];
    const data = this.getData();
    return data.products
      .filter((p) => p.user_id === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getUserInventory(userId: string): Promise<UserInventory> {
    if (!userId) return { active: [], unopened: [] };

    const data = this.getData();
    const userProducts = data.products.filter((p) => p.user_id === userId);
    const userProductMap = new Map<string, Product>();
    userProducts.forEach((p) => userProductMap.set(p.id, p));

    const usedPurchaseIds = new Set(data.usage_periods.map((u) => u.purchase_id));
    const unopenedItems: UnopenedInventoryItem[] = [];

    const userPurchases = data.purchases
      .filter((pu) => userProductMap.has(pu.product_id) && !usedPurchaseIds.has(pu.id))
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));

    for (const pu of userPurchases) {
      const prod = userProductMap.get(pu.product_id);
      if (prod) {
        unopenedItems.push({
          purchase: pu,
          product: prod,
        });
      }
    }

    const activeList = await this.getActiveProducts(userId);
    return {
      active: activeList,
      unopened: unopenedItems,
    };
  }

  async resetUserData(userId: string): Promise<void> {
    if (!userId) return;
    const data = this.getData();
    const userProductIds = new Set(
      data.products.filter((p) => p.user_id === userId).map((p) => p.id)
    );

    data.products = data.products.filter((p) => p.user_id !== userId);
    data.purchases = data.purchases.filter((pu) => !userProductIds.has(pu.product_id));
    data.usage_periods = data.usage_periods.filter((u) => !userProductIds.has(u.product_id));

    this.saveData(data);

    // If default mock user, reseed
    if (userId === DEFAULT_MOCK_USER_ID) {
      this.seedDefaultData();
    }
  }
}

// Singleton for browser app use
export const mockDb = new MockDatabase();
