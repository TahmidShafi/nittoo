// ==============================================================================
// Nittoo Real Supabase Data Layer
// Implements IDataSource using @supabase/supabase-js
// ==============================================================================

import { supabase } from './supabase';
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
  UserDataExport,
  ImportUserDataInput,
  ImportExecutionResult,
} from '../types';

export class SupabaseDatabase implements IDataSource {
  private getClient() {
    if (!supabase) {
      throw new Error(
        'Supabase client is not configured. Please supply valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }
    return supabase;
  }

  async createProduct(userId: string, input: CreateProductInput): Promise<Product> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');

    const { data, error } = await client
      .from('products')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        category: input.category,
        brand: input.brand?.trim() || null,
        size_value: input.size_value ?? null,
        size_unit: input.size_unit ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create product: ${error.message}`);
    return data as Product;
  }

  async createPurchase(userId: string, input: CreatePurchaseInput): Promise<Purchase> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');

    // 1. Verify product ownership
    const { data: product, error: prodErr } = await client
      .from('products')
      .select('id, user_id')
      .eq('id', input.product_id)
      .eq('user_id', userId)
      .single();

    if (prodErr || !product) {
      throw new Error('Unauthorized or product does not exist');
    }

    const normalizedVendor =
      input.store_vendor !== undefined && input.store_vendor !== null
        ? input.store_vendor.trim() || null
        : null;

    const insertPayload: Record<string, any> = {
      product_id: input.product_id,
      purchase_date: input.purchase_date,
      price: input.price,
      currency: input.currency || 'BDT',
    };
    if (normalizedVendor !== null) {
      insertPayload.store_vendor = normalizedVendor;
    }

    let { data, error } = await client
      .from('purchases')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error && error.message?.includes('store_vendor') && 'store_vendor' in insertPayload) {
      console.warn(
        "Supabase purchases table is missing 'store_vendor' column. Run: ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS store_vendor TEXT; in Supabase SQL Editor. Retrying insert without vendor."
      );
      delete insertPayload.store_vendor;
      const fallbackRes = await client
        .from('purchases')
        .insert(insertPayload)
        .select('*')
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) throw new Error(`Failed to create purchase: ${error.message}`);
    return data as Purchase;
  }

  async startUsagePeriod(userId: string, input: StartUsagePeriodInput): Promise<UsagePeriod> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');

    // 1. Verify product ownership
    const { data: product, error: prodErr } = await client
      .from('products')
      .select('id, user_id')
      .eq('id', input.product_id)
      .eq('user_id', userId)
      .single();

    if (prodErr || !product) {
      throw new Error('Unauthorized or product does not exist');
    }

    // 2. Verify purchase ownership and relation
    const { data: purchase, error: purErr } = await client
      .from('purchases')
      .select('id, product_id')
      .eq('id', input.purchase_id)
      .eq('product_id', input.product_id)
      .single();

    if (purErr || !purchase) {
      throw new Error('Purchase does not belong to this product');
    }

    // 2.5 Ensure purchase has not already been used
    const { data: usedPeriods, error: usedErr } = await client
      .from('usage_periods')
      .select('id')
      .eq('purchase_id', input.purchase_id);

    if (usedErr) throw new Error(`Failed to check purchase usage status: ${usedErr.message}`);
    if (usedPeriods && usedPeriods.length > 0) {
      throw new Error('This purchase has already been opened or used');
    }

    // 3. Ensure no active period already exists
    const { data: activePeriods, error: checkErr } = await client
      .from('usage_periods')
      .select('id')
      .eq('product_id', input.product_id)
      .eq('status', 'active');

    if (checkErr) throw new Error(`Failed to check existing usage: ${checkErr.message}`);
    if (activePeriods && activePeriods.length > 0) {
      throw new Error('Product already has an active usage period');
    }

    // 4. Insert active usage period
    const { data, error } = await client
      .from('usage_periods')
      .insert({
        product_id: input.product_id,
        purchase_id: input.purchase_id,
        opened_date: input.opened_date,
        finished_date: null,
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to start usage period: ${error.message}`);
    return data as UsagePeriod;
  }

  async finishUsagePeriod(
    userId: string,
    usagePeriodId: string,
    finishedDate: string
  ): Promise<UsagePeriod> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');

    // Verify ownership through product
    const { data: period, error: periodErr } = await client
      .from('usage_periods')
      .select('id, opened_date, products!inner(user_id)')
      .eq('id', usagePeriodId)
      .single();

    if (periodErr || !period) {
      throw new Error('Usage period not found');
    }

    const typedPeriod = period as unknown as {
      id: string;
      opened_date: string;
      products: { user_id: string } | { user_id: string }[];
    };

    const prodUser = Array.isArray(typedPeriod.products)
      ? typedPeriod.products[0]
      : typedPeriod.products;

    if (!prodUser || prodUser.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    if (finishedDate < typedPeriod.opened_date) {
      throw new Error('Finished date cannot be earlier than opened date');
    }

    const { data, error } = await client
      .from('usage_periods')
      .update({
        finished_date: finishedDate,
        status: 'finished',
      })
      .eq('id', usagePeriodId)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to finish usage period: ${error.message}`);
    return data as UsagePeriod;
  }

  async updateProduct(
    userId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');
    if (!input.name || !input.name.trim()) throw new Error('Product name is required');
    if (!input.category) throw new Error('Product category is required');
    if (input.size_value !== undefined && input.size_value !== null && input.size_value <= 0) {
      throw new Error('Size value must be greater than zero');
    }

    const { data, error } = await client
      .from('products')
      .update({
        name: input.name.trim(),
        category: input.category,
        brand: input.brand?.trim() || null,
        size_value: input.size_value ?? null,
        size_unit: input.size_unit ?? null,
      })
      .eq('id', productId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update product: ${error?.message || 'Product not found'}`);
    }
    return data as Product;
  }

  async updatePurchase(
    userId: string,
    purchaseId: string,
    input: UpdatePurchaseInput
  ): Promise<Purchase> {
    const client = this.getClient();
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

    // Verify ownership and check linked usage periods
    const { data: purchase, error: purErr } = await client
      .from('purchases')
      .select('id, product_id, products!inner(user_id)')
      .eq('id', purchaseId)
      .single();

    if (purErr || !purchase) {
      throw new Error('Purchase not found');
    }

    const typedPurchase = purchase as unknown as {
      id: string;
      product_id: string;
      products: { user_id: string } | { user_id: string }[];
    };
    const prodUser = Array.isArray(typedPurchase.products)
      ? typedPurchase.products[0]
      : typedPurchase.products;

    if (!prodUser || prodUser.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this purchase');
    }

    // Check if there is an active usage period linked to this purchase
    const { data: linkedUsage, error: usageErr } = await client
      .from('usage_periods')
      .select('id, opened_date, status')
      .eq('purchase_id', purchaseId)
      .eq('status', 'active')
      .maybeSingle();

    if (!usageErr && linkedUsage) {
      if (linkedUsage.opened_date < input.purchase_date) {
        throw new Error('Opened date cannot be earlier than purchase date');
      }
    }

    const updatePayload: Record<string, any> = {
      purchase_date: input.purchase_date,
      price: input.price,
      currency: input.currency.trim() || 'BDT',
    };

    if (input.store_vendor !== undefined) {
      updatePayload.store_vendor =
        input.store_vendor !== null ? input.store_vendor.trim() || null : null;
    }

    let { data, error } = await client
      .from('purchases')
      .update(updatePayload)
      .eq('id', purchaseId)
      .select('*')
      .single();

    if (error && error.message?.includes('store_vendor') && 'store_vendor' in updatePayload) {
      console.warn(
        "Supabase purchases table is missing 'store_vendor' column. Run: ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS store_vendor TEXT; in Supabase SQL Editor. Retrying update without vendor."
      );
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.store_vendor;
      const fallbackRes = await client
        .from('purchases')
        .update(fallbackPayload)
        .eq('id', purchaseId)
        .select('*')
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error || !data) {
      throw new Error(`Failed to update purchase: ${error?.message || 'Purchase update failed'}`);
    }
    return data as Purchase;
  }

  async updateUsagePeriod(
    userId: string,
    usagePeriodId: string,
    input: UpdateUsagePeriodInput
  ): Promise<UsagePeriod> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required');
    if (!input.opened_date || !input.opened_date.trim()) {
      throw new Error('Opened date is required');
    }

    const today = getTodayUTC();
    if (input.opened_date > today) {
      throw new Error('Opened date cannot be in the future');
    }

    // Verify ownership and active status
    const { data: period, error: periodErr } = await client
      .from('usage_periods')
      .select('id, purchase_id, status, products!inner(user_id), purchases!inner(purchase_date)')
      .eq('id', usagePeriodId)
      .single();

    if (periodErr || !period) {
      throw new Error('Usage period not found');
    }

    const typedPeriod = period as unknown as {
      id: string;
      purchase_id: string;
      status: string;
      products: { user_id: string } | { user_id: string }[];
      purchases: { purchase_date: string } | { purchase_date: string }[];
    };

    const prodUser = Array.isArray(typedPeriod.products)
      ? typedPeriod.products[0]
      : typedPeriod.products;

    if (!prodUser || prodUser.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this product');
    }

    if (typedPeriod.status !== 'active') {
      throw new Error('Only active bottles can be edited');
    }

    const pur = Array.isArray(typedPeriod.purchases)
      ? typedPeriod.purchases[0]
      : typedPeriod.purchases;

    if (pur && input.opened_date < pur.purchase_date) {
      throw new Error('Opened date cannot be earlier than purchase date');
    }

    const { data, error } = await client
      .from('usage_periods')
      .update({
        opened_date: input.opened_date,
      })
      .eq('id', usagePeriodId)
      .eq('status', 'active')
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update usage period: ${error?.message || 'Update failed'}`);
    }
    return data as UsagePeriod;
  }

  async getActiveProducts(userId: string): Promise<ProductWithDetails[]> {
    const client = this.getClient();
    if (!userId) return [];

    // Query active usage periods with linked product and purchases
    const { data: products, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (prodErr) throw new Error(`Failed to get products: ${prodErr.message}`);
    if (!products || products.length === 0) return [];

    const productIds = products.map((p) => p.id);

    const [{ data: activePeriods }, { data: purchases }, { data: allPeriods }] =
      await Promise.all([
        client
          .from('usage_periods')
          .select('*')
          .in('product_id', productIds)
          .eq('status', 'active'),
        client
          .from('purchases')
          .select('*')
          .in('product_id', productIds)
          .order('purchase_date', { ascending: false }),
        client
          .from('usage_periods')
          .select('*')
          .in('product_id', productIds),
      ]);

    const activePeriodMap = new Map<string, UsagePeriod>();
    (activePeriods || []).forEach((u) => activePeriodMap.set(u.product_id, u as UsagePeriod));

    const purchaseByIdMap = new Map<string, Purchase>();
    const latestPurchaseMap = new Map<string, Purchase>();
    (purchases || []).forEach((pu) => {
      purchaseByIdMap.set(pu.id, pu as Purchase);
      if (!latestPurchaseMap.has(pu.product_id)) {
        latestPurchaseMap.set(pu.product_id, pu as Purchase);
      }
    });

    const finishedPeriodsMap = new Map<string, UsagePeriod[]>();
    (allPeriods || []).forEach((u) => {
      if (u.status === 'finished') {
        const list = finishedPeriodsMap.get(u.product_id) || [];
        list.push(u as UsagePeriod);
        finishedPeriodsMap.set(u.product_id, list);
      }
    });

    const usedPurchaseIds = new Set((allPeriods || []).map((u) => u.purchase_id));
    const unopenedCountMap = new Map<string, number>();
    (purchases || []).forEach((pu) => {
      if (!usedPurchaseIds.has(pu.id)) {
        unopenedCountMap.set(pu.product_id, (unopenedCountMap.get(pu.product_id) || 0) + 1);
      }
    });

    return (products as Product[])
      .filter((p) => activePeriodMap.has(p.id))
      .map((p) => {
        const finishedList = finishedPeriodsMap.get(p.id) || [];
        const activeUsage = activePeriodMap.get(p.id) || null;
        const activePurchase = activeUsage
          ? purchaseByIdMap.get(activeUsage.purchase_id) || latestPurchaseMap.get(p.id) || null
          : null;
        return {
          ...p,
          active_usage: activeUsage,
          latest_purchase: latestPurchaseMap.get(p.id) || null,
          active_purchase: activePurchase,
          finished_count: finishedList.length,
          finished_periods: finishedList,
          unopened_count: unopenedCountMap.get(p.id) || 0,
        };
      });
  }

  async getProductHistory(
    productId: string,
    userId: string
  ): Promise<ProductWithHistory | null> {
    const client = this.getClient();
    if (!userId || !productId) return null;

    const { data: product, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', userId)
      .single();

    if (prodErr || !product) return null;

    const [{ data: purchases }, { data: usagePeriods }] = await Promise.all([
      client
        .from('purchases')
        .select('*')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false }),
      client
        .from('usage_periods')
        .select('*')
        .eq('product_id', productId)
        .order('opened_date', { ascending: false }),
    ]);

    const castUsage = (usagePeriods || []) as UsagePeriod[];
    const activeUsage = castUsage.find((u) => u.status === 'active') || null;
    const finishedPeriods = castUsage.filter((u) => u.status === 'finished');

    const usedPurchaseIds = new Set(castUsage.map((u) => u.purchase_id));
    const castPurchases = (purchases || []) as Purchase[];
    const unopenedPurchases = castPurchases.filter((pu) => !usedPurchaseIds.has(pu.id));

    return {
      product: product as Product,
      purchases: castPurchases,
      usage_periods: castUsage,
      active_usage: activeUsage,
      finished_periods: finishedPeriods,
      unopened_purchases: unopenedPurchases,
    };
  }

  async getAllUserProducts(userId: string): Promise<Product[]> {
    const client = this.getClient();
    if (!userId) return [];

    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) throw new Error(`Failed to load user products: ${error.message}`);
    return (data || []) as Product[];
  }

  async getUserInventory(userId: string): Promise<UserInventory> {
    const client = this.getClient();
    if (!userId) return { active: [], unopened: [] };

    const { data: products, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (prodErr) throw new Error(`Failed to get products: ${prodErr.message}`);
    if (!products || products.length === 0) return { active: [], unopened: [] };

    const productMap = new Map<string, Product>();
    products.forEach((p) => productMap.set(p.id, p as Product));
    const productIds = products.map((p) => p.id);

    const [{ data: activePeriods }, { data: purchases }, { data: allPeriods }] =
      await Promise.all([
        client
          .from('usage_periods')
          .select('*')
          .in('product_id', productIds)
          .eq('status', 'active'),
        client
          .from('purchases')
          .select('*')
          .in('product_id', productIds)
          .order('purchase_date', { ascending: false }),
        client
          .from('usage_periods')
          .select('*')
          .in('product_id', productIds),
      ]);

    const activePeriodMap = new Map<string, UsagePeriod>();
    (activePeriods || []).forEach((u) => activePeriodMap.set(u.product_id, u as UsagePeriod));

    const purchaseByIdMap = new Map<string, Purchase>();
    const latestPurchaseMap = new Map<string, Purchase>();
    (purchases || []).forEach((pu) => {
      purchaseByIdMap.set(pu.id, pu as Purchase);
      if (!latestPurchaseMap.has(pu.product_id)) {
        latestPurchaseMap.set(pu.product_id, pu as Purchase);
      }
    });

    const finishedPeriodsMap = new Map<string, UsagePeriod[]>();
    (allPeriods || []).forEach((u) => {
      if (u.status === 'finished') {
        const list = finishedPeriodsMap.get(u.product_id) || [];
        list.push(u as UsagePeriod);
        finishedPeriodsMap.set(u.product_id, list);
      }
    });

    const usedPurchaseIds = new Set((allPeriods || []).map((u) => u.purchase_id));
    const unopenedCountMap = new Map<string, number>();
    const unopenedItems: UnopenedInventoryItem[] = [];

    (purchases || []).forEach((pu) => {
      if (!usedPurchaseIds.has(pu.id)) {
        unopenedCountMap.set(pu.product_id, (unopenedCountMap.get(pu.product_id) || 0) + 1);
        const prod = productMap.get(pu.product_id);
        if (prod) {
          unopenedItems.push({
            purchase: pu as Purchase,
            product: prod,
          });
        }
      }
    });

    const activeList: ProductWithDetails[] = (products as Product[])
      .filter((p) => activePeriodMap.has(p.id))
      .map((p) => {
        const finishedList = finishedPeriodsMap.get(p.id) || [];
        const activeUsage = activePeriodMap.get(p.id) || null;
        const activePurchase = activeUsage
          ? purchaseByIdMap.get(activeUsage.purchase_id) || latestPurchaseMap.get(p.id) || null
          : null;
        return {
          ...p,
          active_usage: activeUsage,
          latest_purchase: latestPurchaseMap.get(p.id) || null,
          active_purchase: activePurchase,
          finished_count: finishedList.length,
          finished_periods: finishedList,
          unopened_count: unopenedCountMap.get(p.id) || 0,
        };
      });

    return {
      active: activeList,
      unopened: unopenedItems,
    };
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    if (!userId) {
      return {
        exported_at: new Date().toISOString(),
        user: { id: '', email: '' },
        summary: { total_products: 0, total_purchases: 0, total_usage_periods: 0 },
        products: [],
        purchases: [],
        usage_periods: [],
      };
    }

    const client = this.getClient();
    const { data: productsData, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (prodErr) throw new Error(`Failed to export products: ${prodErr.message}`);

    const products = (productsData || []) as Product[];
    const productIds = products.map((p) => p.id);

    let purchases: Purchase[] = [];
    let usagePeriods: UsagePeriod[] = [];

    if (productIds.length > 0) {
      const [purchasesRes, usageRes] = await Promise.all([
        client
          .from('purchases')
          .select('*')
          .in('product_id', productIds)
          .order('purchase_date', { ascending: false }),
        client
          .from('usage_periods')
          .select('*')
          .in('product_id', productIds)
          .order('opened_date', { ascending: false }),
      ]);

      if (purchasesRes.error) throw new Error(`Failed to export purchases: ${purchasesRes.error.message}`);
      if (usageRes.error) throw new Error(`Failed to export usage periods: ${usageRes.error.message}`);

      purchases = (purchasesRes.data || []) as Purchase[];
      usagePeriods = (usageRes.data || []) as UsagePeriod[];
    }

    return {
      exported_at: new Date().toISOString(),
      user: {
        id: userId,
        email: '',
      },
      summary: {
        total_products: products.length,
        total_purchases: purchases.length,
        total_usage_periods: usagePeriods.length,
      },
      products,
      purchases,
      usage_periods: usagePeriods,
    };
  }

  async importUserData(
    userId: string,
    input: ImportUserDataInput
  ): Promise<ImportExecutionResult> {
    const client = this.getClient();
    if (!userId) throw new Error('User ID is required for import');

    let restoredProducts = 0;
    let restoredPurchases = 0;
    let restoredCycles = 0;
    let skippedConflicts = 0;

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // 1. Existing user products (Strict RLS isolation)
    const { data: existingProducts, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('user_id', userId);

    if (prodErr) throw new Error(`Failed to query user products for import: ${prodErr.message}`);

    const existingProductIdSet = new Set((existingProducts || []).map((p) => p.id));
    const productIdMap = new Map<string, string>(); // backupProductId -> effectiveProductId

    for (const p of input.products) {
      if (existingProductIdSet.has(p.id)) {
        productIdMap.set(p.id, p.id);
      } else {
        const insertPayload: any = {
          user_id: userId,
          name: p.name.trim(),
          category: p.category,
          brand: p.brand?.trim() || null,
          size_value: p.size ?? null,
          size_unit: p.unit ?? null,
        };
        if (p.created_at) insertPayload.created_at = p.created_at;

        // If backup ID is valid UUID, try inserting with ID; fallback to generated UUID on conflict
        let insertedId: string | null = null;
        if (isUuid(p.id)) {
          const { data: inserted, error: insErr } = await client
            .from('products')
            .insert({ ...insertPayload, id: p.id })
            .select('id')
            .single();

          if (!insErr && inserted) {
            insertedId = inserted.id;
          }
        }

        if (!insertedId) {
          const { data: inserted, error: insErr2 } = await client
            .from('products')
            .insert(insertPayload)
            .select('id')
            .single();

          if (insErr2 || !inserted) {
            throw new Error(`Failed to restore product ${p.name}: ${insErr2?.message || 'Unknown error'}`);
          }
          insertedId = inserted.id;
        }

        productIdMap.set(p.id, insertedId!);
        restoredProducts++;
      }
    }

    // 2. Existing purchases for effective products
    const allUserProductIds = Array.from(new Set([...Array.from(productIdMap.values()), ...Array.from(existingProductIdSet)]));
    let existingPurchases: Purchase[] = [];
    if (allUserProductIds.length > 0) {
      const { data: purData, error: purErr } = await client
        .from('purchases')
        .select('*')
        .in('product_id', allUserProductIds);

      if (purErr) throw new Error(`Failed to query user purchases: ${purErr.message}`);
      existingPurchases = (purData || []) as Purchase[];
    }

    const existingPurchaseIdSet = new Set(existingPurchases.map((pu) => pu.id));
    const purchaseIdMap = new Map<string, string>();
    const newlyCreatedPurchaseIds = new Set<string>();

    for (const pu of input.purchases) {
      let targetProductId = productIdMap.get(pu.product_id);
      if (!targetProductId && existingProductIdSet.has(pu.product_id)) {
        targetProductId = pu.product_id;
      }
      if (!targetProductId) continue;

      if (existingPurchaseIdSet.has(pu.id)) {
        purchaseIdMap.set(pu.id, pu.id);
      } else {
        const insertPayload: any = {
          product_id: targetProductId,
          purchase_date: pu.purchase_date,
          price: Number(pu.price),
          currency: pu.currency || 'BDT',
          store_vendor: pu.store_vendor ? pu.store_vendor.trim() || null : null,
        };
        if (pu.created_at) insertPayload.created_at = pu.created_at;

        let insertedId: string | null = null;
        if (isUuid(pu.id)) {
          const { data: inserted, error: insErr } = await client
            .from('purchases')
            .insert({ ...insertPayload, id: pu.id })
            .select('id')
            .single();

          if (!insErr && inserted) {
            insertedId = inserted.id;
          }
        }

        if (!insertedId) {
          const { data: inserted, error: insErr2 } = await client
            .from('purchases')
            .insert(insertPayload)
            .select('id')
            .single();

          if (insErr2 || !inserted) {
            throw new Error(`Failed to restore purchase: ${insErr2?.message || 'Unknown error'}`);
          }
          insertedId = inserted.id;
        }

        purchaseIdMap.set(pu.id, insertedId!);
        newlyCreatedPurchaseIds.add(insertedId!);
        restoredPurchases++;
      }
    }

    // 3. Existing usage periods
    let existingPeriods: UsagePeriod[] = [];
    if (allUserProductIds.length > 0) {
      const { data: usageData, error: uErr } = await client
        .from('usage_periods')
        .select('*')
        .in('product_id', allUserProductIds);

      if (uErr) throw new Error(`Failed to query user usage periods: ${uErr.message}`);
      existingPeriods = (usageData || []) as UsagePeriod[];
    }

    const existingUsageIdSet = new Set(existingPeriods.map((u) => u.id));
    const activeProductIds = new Set(
      existingPeriods.filter((u) => u.status === 'active').map((u) => u.product_id)
    );
    const usedPurchaseIds = new Set<string>(existingPeriods.map((u) => u.purchase_id));

    for (const u of input.usage_periods) {
      let targetProductId = productIdMap.get(u.product_id);
      if (!targetProductId && existingProductIdSet.has(u.product_id)) {
        targetProductId = u.product_id;
      }
      let targetPurchaseId = purchaseIdMap.get(u.purchase_id);
      if (!targetPurchaseId && existingPurchaseIdSet.has(u.purchase_id)) {
        targetPurchaseId = u.purchase_id;
      }
      if (!targetProductId || !targetPurchaseId) continue;

      if (existingUsageIdSet.has(u.id)) {
        usedPurchaseIds.add(targetPurchaseId);
        continue; // Idempotent skip
      }

      if (u.status === 'active') {
        if (activeProductIds.has(targetProductId)) {
          // Active bottle conflict! Keep current active bottle, backup active record remains unopened
          skippedConflicts++;
        } else {
          const insertPayload: any = {
            product_id: targetProductId,
            purchase_id: targetPurchaseId,
            opened_date: u.opened_date,
            status: 'active',
          };
          if (u.created_at) insertPayload.created_at = u.created_at;

          let inserted = false;
          if (isUuid(u.id)) {
            const { error: insErr } = await client
              .from('usage_periods')
              .insert({ ...insertPayload, id: u.id });
            if (!insErr) inserted = true;
          }
          if (!inserted) {
            const { error: insErr2 } = await client
              .from('usage_periods')
              .insert(insertPayload);
            if (insErr2) throw new Error(`Failed to restore active usage: ${insErr2.message}`);
          }
          activeProductIds.add(targetProductId);
          usedPurchaseIds.add(targetPurchaseId);
        }
      } else {
        // Historical finished cycle
        const insertPayload: any = {
          product_id: targetProductId,
          purchase_id: targetPurchaseId,
          opened_date: u.opened_date,
          finished_date: u.finished_date || u.opened_date,
          status: 'finished',
        };
        if (u.created_at) insertPayload.created_at = u.created_at;

        let inserted = false;
        if (isUuid(u.id)) {
          const { error: insErr } = await client
            .from('usage_periods')
            .insert({ ...insertPayload, id: u.id });
          if (!insErr) inserted = true;
        }
        if (!inserted) {
          const { error: insErr2 } = await client
            .from('usage_periods')
            .insert(insertPayload);
          if (insErr2) throw new Error(`Failed to restore usage cycle: ${insErr2.message}`);
        }
        restoredCycles++;
        usedPurchaseIds.add(targetPurchaseId);
      }
    }

    const restoredUnopened = Array.from(newlyCreatedPurchaseIds).filter(
      (pid) => !usedPurchaseIds.has(pid)
    ).length;

    return {
      success: true,
      restoredProducts,
      restoredPurchases,
      restoredCycles,
      restoredUnopened,
      skippedConflicts,
    };
  }

  async resetUserData(userId: string, _isDeletingAccount?: boolean): Promise<void> {
    const client = this.getClient();
    if (!userId) return;

    // Cascade delete on products will remove purchases and usage periods
    const { error } = await client.from('products').delete().eq('user_id', userId);
    if (error) throw new Error(`Failed to reset user data: ${error.message}`);
  }
}

export const realDb = new SupabaseDatabase();
