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
 * Flag indicating whether the application is running in dev mock mode
 */
export const isMockMode = !isSupabaseConfigured;

/**
 * Base database client instance (real Supabase or local mock)
 */
const rawDb: IDataSource = isSupabaseConfigured ? realDb : mockDb;

/**
 * Singleton database client instance conforming to IDataSource.
 * All UI pages, components, and hooks access data exclusively through this object.
 * Automatically invalidates in-memory SWR cache upon successful write operations.
 */
export const db: IDataSource = {
  // Read operations pass through directly to underlying data source
  getActiveProducts: (userId) => rawDb.getActiveProducts(userId),
  getProductHistory: (productId, userId) => rawDb.getProductHistory(productId, userId),
  getAllUserProducts: (userId) => rawDb.getAllUserProducts(userId),
  getUserProductsWithHistory: (userId) => rawDb.getUserProductsWithHistory(userId),
  getUserInventory: (userId) => rawDb.getUserInventory(userId),
  exportUserData: (userId) => rawDb.exportUserData(userId),

  // Write operations delegate to underlying data source and invalidate affected cache
  createProduct: async (userId, input) => {
    const res = await rawDb.createProduct(userId, input);
    dataCache.invalidateProduct(userId, res.id);
    return res;
  },

  createPurchase: async (userId, input) => {
    const res = await rawDb.createPurchase(userId, input);
    dataCache.invalidateProduct(userId, input.product_id);
    return res;
  },

  startUsagePeriod: async (userId, input) => {
    const res = await rawDb.startUsagePeriod(userId, input);
    dataCache.invalidateProduct(userId, input.product_id);
    return res;
  },

  finishUsagePeriod: async (userId, usagePeriodId, finishedDate) => {
    const res = await rawDb.finishUsagePeriod(userId, usagePeriodId, finishedDate);
    dataCache.invalidateProduct(userId, res.product_id);
    return res;
  },

  updateProduct: async (userId, productId, input) => {
    const res = await rawDb.updateProduct(userId, productId, input);
    dataCache.invalidateProduct(userId, productId);
    return res;
  },

  updatePurchase: async (userId, purchaseId, input) => {
    const res = await rawDb.updatePurchase(userId, purchaseId, input);
    dataCache.invalidateProduct(userId);
    return res;
  },

  updateUsagePeriod: async (userId, usagePeriodId, input) => {
    const res = await rawDb.updateUsagePeriod(userId, usagePeriodId, input);
    dataCache.invalidateProduct(userId);
    return res;
  },

  importUserData: async (userId, input) => {
    const res = await rawDb.importUserData(userId, input);
    dataCache.clearUser(userId);
    return res;
  },

  resetUserData: async (userId, isDeletingAccount) => {
    await rawDb.resetUserData(userId, isDeletingAccount);
    dataCache.clearUser(userId);
  },
};

export { isSupabaseConfigured };
