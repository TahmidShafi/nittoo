// ==============================================================================
// Nittoo Real Supabase Data Layer
// Implements IDataSource using @supabase/supabase-js
// ==============================================================================

import { supabase } from './supabase';
import type {
  IDataSource,
  Product,
  Purchase,
  UsagePeriod,
  CreateProductInput,
  CreatePurchaseInput,
  StartUsagePeriodInput,
  ProductWithDetails,
  ProductWithHistory,
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

    const { data, error } = await client
      .from('purchases')
      .insert({
        product_id: input.product_id,
        purchase_date: input.purchase_date,
        price: input.price,
        currency: input.currency || 'BDT',
      })
      .select('*')
      .single();

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

    const latestPurchaseMap = new Map<string, Purchase>();
    (purchases || []).forEach((pu) => {
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

    return (products as Product[])
      .filter((p) => activePeriodMap.has(p.id))
      .map((p) => {
        const finishedList = finishedPeriodsMap.get(p.id) || [];
        return {
          ...p,
          active_usage: activePeriodMap.get(p.id) || null,
          latest_purchase: latestPurchaseMap.get(p.id) || null,
          finished_count: finishedList.length,
          finished_periods: finishedList,
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

    return {
      product: product as Product,
      purchases: (purchases || []) as Purchase[],
      usage_periods: castUsage,
      active_usage: activeUsage,
      finished_periods: finishedPeriods,
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

  async resetUserData(userId: string): Promise<void> {
    const client = this.getClient();
    if (!userId) return;

    // Cascade delete on products will remove purchases and usage periods
    const { error } = await client.from('products').delete().eq('user_id', userId);
    if (error) throw new Error(`Failed to reset user data: ${error.message}`);
  }
}

export const realDb = new SupabaseDatabase();
