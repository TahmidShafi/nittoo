// ==============================================================================
// Nittoo Product Discovery & Enrichment Module
// Public entry point for external catalog search, normalization, and caching
// ==============================================================================

import type { DiscoveryProduct, DiscoverySearchOptions, IProductDiscoveryProvider } from './types';
import { CompositeDiscoveryProvider } from './provider';
import { discoveryCache } from './cache';

export * from './types';
export * from './normalize';
export * from './provider';
export * from './cache';

export const MIN_SEARCH_QUERY_LENGTH = 3;

let defaultProvider: IProductDiscoveryProvider = new CompositeDiscoveryProvider();

/**
 * Configure the active discovery provider (e.g. for testing with mock fixtures).
 */
export function setDiscoveryProvider(provider: IProductDiscoveryProvider): void {
  defaultProvider = provider;
}

/**
 * Get the currently configured discovery provider.
 */
export function getDiscoveryProvider(): IProductDiscoveryProvider {
  return defaultProvider;
}

/**
 * High-level product discovery function with query validation and in-memory caching.
 *
 * @param query Search query typed by the user (minimum 3 characters)
 * @param options Optional limits and AbortSignal
 * @returns Array of normalized DiscoveryProduct models
 */
export async function searchExternalProducts(
  query: string,
  options?: DiscoverySearchOptions
): Promise<DiscoveryProduct[]> {
  const cleanQuery = query.trim();

  // 1. Guard against queries below minimum length
  if (cleanQuery.length < MIN_SEARCH_QUERY_LENGTH) {
    return [];
  }

  // 2. Check in-memory session cache
  const cached = discoveryCache.get(cleanQuery);
  if (cached) {
    return cached;
  }

  // 3. Delegate to active provider
  const results = await defaultProvider.search(cleanQuery, options);

  // 4. Cache valid results
  if (results.length > 0) {
    discoveryCache.set(cleanQuery, results);
  }

  return results;
}
