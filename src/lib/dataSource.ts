// ==============================================================================
// Nittoo Data Source Selector
// Single Source of Truth for Database Access Across Entire Application
// Automatically routes to mockDb or realDb based on Supabase credentials
// ==============================================================================

import type { IDataSource } from '../types';
import { isSupabaseConfigured } from './supabase';
import { mockDb } from './mock-db';
import { realDb } from './db';
import { dataCache } from './dataCache';

/**
 * LocalStorage flag for runtime Demo Mode (works even when Supabase is configured)
 */
export const DEMO_MODE_KEY = 'nittoo_demo_mode';
export const DEMO_USER_ID = 'demo-user-nittoo';

/**
 * Flag indicating whether the application has no Supabase credentials configured
 */
export const isMockMode = !isSupabaseConfigured;

/**
 * Checks whether the current browser session is in Demo Mode.
 */
export function isDemoSessionActive(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  return window.localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

/**
 * Enables or disables runtime Demo Mode for the current browser session.
 */
export function setDemoModeActive(active: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (active) {
      window.localStorage.setItem(DEMO_MODE_KEY, 'true');
    } else {
      window.localStorage.removeItem(DEMO_MODE_KEY);
    }
  }
  dataCache.clearAll();
}

/**
 * Selects the active data source at runtime per session.
 * Demo Mode or missing Supabase credentials routes to mockDb; otherwise realDb.
 */
export function getActiveDataSource(): IDataSource {
  if (!isSupabaseConfigured || isDemoSessionActive()) {
    return mockDb;
  }
  return realDb;
}

/**
 * Singleton database client instance conforming to IDataSource.
 * All UI pages, components, and hooks access data exclusively through this object.
 * Resolves mockDb vs realDb at runtime and invalidates SWR cache upon writes.
 */
export const db: IDataSource = {
  // Read operations pass through directly to underlying data source
  getActiveProducts: (userId) => getActiveDataSource().getActiveProducts(userId),
  getProductHistory: (productId, userId) => getActiveDataSource().getProductHistory(productId, userId),
  getAllUserProducts: (userId) => getActiveDataSource().getAllUserProducts(userId),
  getUserProductsWithHistory: (userId) => getActiveDataSource().getUserProductsWithHistory(userId),
  getUserInventory: (userId) => getActiveDataSource().getUserInventory(userId),
  exportUserData: (userId) => getActiveDataSource().exportUserData(userId),

  // Write operations delegate to underlying data source and invalidate affected cache
  createProduct: async (userId, input) => {
    const res = await getActiveDataSource().createProduct(userId, input);
    dataCache.invalidateProduct(userId, res.id);
    return res;
  },

  createPurchase: async (userId, input) => {
    const res = await getActiveDataSource().createPurchase(userId, input);
    dataCache.invalidateProduct(userId, input.product_id);
    return res;
  },

  startUsagePeriod: async (userId, input) => {
    const res = await getActiveDataSource().startUsagePeriod(userId, input);
    dataCache.invalidateProduct(userId, input.product_id);
    return res;
  },

  finishUsagePeriod: async (userId, usagePeriodId, finishedDate) => {
    const res = await getActiveDataSource().finishUsagePeriod(userId, usagePeriodId, finishedDate);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  updateProduct: async (userId, productId, input) => {
    const res = await getActiveDataSource().updateProduct(userId, productId, input);
    dataCache.invalidateProduct(userId, productId);
    return res;
  },

  updatePurchase: async (userId, purchaseId, input) => {
    const res = await getActiveDataSource().updatePurchase(userId, purchaseId, input);
    dataCache.invalidateProduct(userId);
    return res;
  },

  updateUsagePeriod: async (userId, usagePeriodId, input) => {
    const res = await getActiveDataSource().updateUsagePeriod(userId, usagePeriodId, input);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  deleteUsagePeriod: async (userId, usagePeriodId) => {
    const res = await getActiveDataSource().deleteUsagePeriod(userId, usagePeriodId);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  importUserData: async (userId, input) => {
    const res = await getActiveDataSource().importUserData(userId, input);
    dataCache.clearUser(userId);
    return res;
  },

  resetUserData: async (userId, isDeletingAccount) => {
    await getActiveDataSource().resetUserData(userId, isDeletingAccount);
    dataCache.clearUser(userId);
  },

  // Restock Planning (Stage 21)
  createRestockPlan: async (userId, input) => {
    const res = await getActiveDataSource().createRestockPlan(userId, input);
    dataCache.invalidateProduct(userId, input.product_id);
    return res;
  },

  getRestockPlans: (userId) => getActiveDataSource().getRestockPlans(userId),

  getRestockPlanForUsagePeriod: (userId, usagePeriodId) =>
    getActiveDataSource().getRestockPlanForUsagePeriod(userId, usagePeriodId),

  updateRestockPlan: async (userId, planId, input) => {
    const res = await getActiveDataSource().updateRestockPlan(userId, planId, input);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  deleteRestockPlan: async (userId, planId) => {
    await getActiveDataSource().deleteRestockPlan(userId, planId);
    dataCache.invalidateProduct(userId);
  },

  completeRestockPlan: async (userId, planId) => {
    const res = await getActiveDataSource().completeRestockPlan(userId, planId);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  dismissRestockPlan: async (userId, planId) => {
    const res = await getActiveDataSource().dismissRestockPlan(userId, planId);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },
};

export { isSupabaseConfigured };
