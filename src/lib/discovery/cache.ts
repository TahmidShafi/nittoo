// ==============================================================================
// Nittoo Product Discovery In-Memory Search Cache
// Session-scoped, non-persistent, 5-minute TTL cache for external search queries
// ==============================================================================

import type { DiscoveryCacheEntry, DiscoveryProduct } from './types';

const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 50;

class DiscoveryCache {
  private cache = new Map<string, DiscoveryCacheEntry>();

  get(query: string): DiscoveryProduct[] | null {
    const key = query.trim().toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > DISCOVERY_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  set(query: string, results: DiscoveryProduct[]): void {
    const key = query.trim().toLowerCase();
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      results,
    });
  }

  getBarcode(barcode: string): DiscoveryProduct | null {
    const key = `barcode:${barcode.trim().toLowerCase()}`;
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > DISCOVERY_CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.results[0] || null;
  }

  setBarcode(barcode: string, product: DiscoveryProduct): void {
    const key = `barcode:${barcode.trim().toLowerCase()}`;
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      timestamp: Date.now(),
      results: [product],
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const discoveryCache = new DiscoveryCache();
