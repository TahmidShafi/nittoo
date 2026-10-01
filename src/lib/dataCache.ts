// ==============================================================================
// Nittoo Client-Side In-Memory SWR Data Cache (Stage 16.9)
// Provides tenant-isolated, memory-only Stale-While-Revalidate caching.
// Strictly avoids localStorage/sessionStorage/IndexedDB persistence.
// ==============================================================================

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  userId: string;
  key: string;
}

/**
 * Default freshness duration: 30 seconds.
 * Entries younger than 30s are considered FRESH.
 * Entries older than 30s are considered STALE and trigger silent revalidation.
 */
export const STALE_TIME_MS = 30 * 1000;

/**
 * Maximum cache entries per user to prevent unbounded memory growth.
 * When limit is reached, least-recently-used (LRU) entry is evicted.
 */
export const MAX_CACHE_ENTRIES_PER_USER = 100;

/**
 * Lightweight value equality checker to prevent unneeded rerenders
 * when fresh revalidation data matches the cached snapshot.
 */
export function areValuesEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Security assertion to guarantee no passwords, access tokens, refresh tokens,
 * or API secrets ever enter the in-memory cache.
 */
function assertNoSecrets(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const str = JSON.stringify(data);
  const sensitivePatterns = [
    /"password"/i,
    /"access_token"/i,
    /"refresh_token"/i,
    /"secret_key"/i,
    /"service_role"/i,
  ];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(str)) {
      throw new Error(`Security violation: Detected sensitive credential pattern (${pattern}) in cache payload.`);
    }
  }
}

class DataCache {
  // User ID -> Map of ResourceKey -> CacheEntry
  private cache = new Map<string, Map<string, CacheEntry<unknown>>>();

  /**
   * Retrieve cached entry for a given user and resource key.
   * Updates LRU access ordering.
   */
  get<T>(userId: string | undefined | null, key: string): CacheEntry<T> | null {
    if (!userId || !key) return null;
    const userMap = this.cache.get(userId);
    if (!userMap) return null;

    const entry = userMap.get(key);
    if (!entry) return null;

    // Refresh LRU order by re-inserting
    userMap.delete(key);
    userMap.set(key, entry);

    return entry as CacheEntry<T>;
  }

  /**
   * Set or update a cached entry for a given user and key.
   * Enforces LRU size capping and zero-secret safety.
   */
  set<T>(userId: string | undefined | null, key: string, data: T): void {
    if (!userId || !key || data === undefined) return;
    assertNoSecrets(data);

    let userMap = this.cache.get(userId);
    if (!userMap) {
      userMap = new Map();
      this.cache.set(userId, userMap);
    }

    // Evict oldest (first) entry if capacity reached
    if (userMap.size >= MAX_CACHE_ENTRIES_PER_USER && !userMap.has(key)) {
      const oldestKey = userMap.keys().next().value;
      if (oldestKey) {
        userMap.delete(oldestKey);
      }
    }

    const entry: CacheEntry<T> = {
      data,
      fetchedAt: Date.now(),
      userId,
      key,
    };

    // If key already existed, delete first so it moves to end of LRU iteration
    userMap.delete(key);
    userMap.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Checks if an entry exists for the given user and key.
   */
  has(userId: string | undefined | null, key: string): boolean {
    if (!userId || !key) return false;
    const userMap = this.cache.get(userId);
    return !!userMap?.has(key);
  }

  /**
   * Returns true if entry exists and was fetched within STALE_TIME_MS.
   */
  isFresh(entry: CacheEntry<unknown> | null | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < STALE_TIME_MS;
  }

  /**
   * Returns true if entry is missing or older than STALE_TIME_MS.
   */
  isStale(entry: CacheEntry<unknown> | null | undefined): boolean {
    if (!entry) return true;
    return Date.now() - entry.fetchedAt >= STALE_TIME_MS;
  }

  /**
   * Invalidate a single resource key for a given user.
   */
  invalidate(userId: string | undefined | null, key: string): void {
    if (!userId || !key) return;
    const userMap = this.cache.get(userId);
    if (userMap) {
      userMap.delete(key);
    }
  }

  /**
   * Invalidate all domain views affected by a product or inventory mutation:
   * - dashboard
   * - inventory
   * - analytics
   * - all-products
   * - specific product detail / comparison if productId is provided
   */
  invalidateProduct(userId: string | undefined | null, productId?: string): void {
    if (!userId) return;
    const userMap = this.cache.get(userId);
    if (!userMap) return;

    userMap.delete('dashboard');
    userMap.delete('inventory');
    userMap.delete('analytics');
    userMap.delete('all-products');
    userMap.delete('restock-plans');

    if (productId) {
      userMap.delete(`product:${productId}`);
      // Invalidate any comparison entry containing this productId
      for (const k of Array.from(userMap.keys())) {
        if (k.startsWith('comparison:') && k.includes(productId)) {
          userMap.delete(k);
        }
      }
    } else {
      // If no specific product ID given, clear all product & comparison entries
      for (const k of Array.from(userMap.keys())) {
        if (k.startsWith('product:') || k.startsWith('comparison:')) {
          userMap.delete(k);
        }
      }
    }
  }

  /**
   * Clear all cached data for a specific user (e.g. on sign-out or account deletion).
   */
  clearUser(userId: string | undefined | null): void {
    if (!userId) return;
    this.cache.delete(userId);
  }

  /**
   * Clear entire in-memory cache across all users (testing / teardown).
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Return number of cached entries for a given user.
   */
  getUserEntryCount(userId: string): number {
    return this.cache.get(userId)?.size ?? 0;
  }

  /**
   * Return list of keys for a given user (diagnostic / testing).
   */
  getAllKeys(userId: string): string[] {
    const userMap = this.cache.get(userId);
    return userMap ? Array.from(userMap.keys()) : [];
  }

  /**
   * Deterministic comparison cache key for a pair of product IDs.
   */
  getComparisonKey(productIdA: string, productIdB: string): string {
    const sorted = [productIdA, productIdB].sort();
    return `comparison:${sorted[0]}:${sorted[1]}`;
  }
}

export const dataCache = new DataCache();
