// ==============================================================================
// Nittoo Product Discovery Providers
// Adapters for Open Beauty Facts and Open Food Facts public CPG catalogs
// ==============================================================================

import type { DiscoveryProduct, DiscoverySearchOptions, IProductDiscoveryProvider } from './types';
import { mapCategory, normalizeText, parseSize, sanitizeImageUrl } from './normalize';

export interface RawOpenFactsProduct {
  code?: string;
  id?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  brand_owner?: string;
  quantity?: string;
  categories_tags?: string[];
  categories?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  image_url?: string;
}

export interface RawOpenFactsResponse {
  count?: number;
  products?: RawOpenFactsProduct[];
}

export type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Normalizes raw Open Beauty Facts / Open Food Facts response JSON
 * into Nittoo's provider-agnostic DiscoveryProduct model.
 */
export function normalizeOpenFactsProducts(
  rawProducts: RawOpenFactsProduct[] | undefined,
  source: string
): DiscoveryProduct[] {
  if (!Array.isArray(rawProducts)) return [];

  const results: DiscoveryProduct[] = [];

  for (const p of rawProducts) {
    if (!p || typeof p !== 'object') continue;

    const rawName = p.product_name || p.product_name_en || p.generic_name;
    const name = normalizeText(rawName);
    if (!name) continue; // Skip items without a usable name

    const brand = normalizeText(p.brands || p.brand_owner) || undefined;
    const rawCategory = Array.isArray(p.categories_tags)
      ? p.categories_tags.join(', ')
      : typeof p.categories === 'string'
      ? p.categories
      : undefined;

    const category = mapCategory(p.categories_tags || p.categories);
    const rawSize = p.quantity ? normalizeText(p.quantity) : undefined;
    const { sizeValue, sizeUnit } = parseSize(p.quantity);
    const imageUrl = sanitizeImageUrl(p.image_small_url || p.image_front_small_url || p.image_url);
    const barcode = p.code ? normalizeText(p.code) : undefined;
    const externalId = p.code || p.id || `${source}-${results.length}-${name.toLowerCase()}`;

    results.push({
      externalId,
      source,
      name,
      brand,
      category,
      rawCategory,
      sizeValue,
      sizeUnit,
      rawSize,
      imageUrl,
      barcode,
    });
  }

  return results;
}

/**
 * Open Beauty Facts Provider
 * Best suited for skincare, haircare, cosmetics, body care, and hygiene products.
 */
export class OpenBeautyFactsProvider implements IProductDiscoveryProvider {
  readonly name = 'OpenBeautyFacts';
  private fetchFn: FetchFunction;
  private baseUrl: string;

  constructor(options?: { fetchFn?: FetchFunction; baseUrl?: string }) {
    this.fetchFn = options?.fetchFn || fetch;
    this.baseUrl = options?.baseUrl || 'https://world.openbeautyfacts.org/cgi/search.pl';
  }

  async search(query: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = options?.limit || 10;
    const url = `${this.baseUrl}?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=${limit}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenBeautyFacts search failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawOpenFactsResponse;
    return normalizeOpenFactsProducts(data.products, 'openbeautyfacts').slice(0, limit);
  }
}

/**
 * Open Food Facts Provider
 * Complementary provider for supplements, vitamins, and food & beverage essentials.
 */
export class OpenFoodFactsProvider implements IProductDiscoveryProvider {
  readonly name = 'OpenFoodFacts';
  private fetchFn: FetchFunction;
  private baseUrl: string;

  constructor(options?: { fetchFn?: FetchFunction; baseUrl?: string }) {
    this.fetchFn = options?.fetchFn || fetch;
    this.baseUrl = options?.baseUrl || 'https://world.openfoodfacts.org/cgi/search.pl';
  }

  async search(query: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const limit = options?.limit || 10;
    const url = `${this.baseUrl}?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=${limit}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenFoodFacts search failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawOpenFactsResponse;
    return normalizeOpenFactsProducts(data.products, 'openfoodfacts').slice(0, limit);
  }
}

/**
 * Composite Provider
 * Searches Open Beauty Facts first. If results are sparse (< 3),
 * queries Open Food Facts to support supplements & grocery consumables.
 */
export class CompositeDiscoveryProvider implements IProductDiscoveryProvider {
  readonly name = 'CompositeProvider';
  private beautyProvider: IProductDiscoveryProvider;
  private foodProvider: IProductDiscoveryProvider;

  constructor(options?: {
    beautyProvider?: IProductDiscoveryProvider;
    foodProvider?: IProductDiscoveryProvider;
  }) {
    this.beautyProvider = options?.beautyProvider || new OpenBeautyFactsProvider();
    this.foodProvider = options?.foodProvider || new OpenFoodFactsProvider();
  }

  async search(query: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct[]> {
    const limit = options?.limit || 8;
    const beautyResults = await this.beautyProvider.search(query, { ...options, limit });

    if (beautyResults.length >= limit) {
      return beautyResults.slice(0, limit);
    }

    // Try food provider for supplements/grocery if beauty provider has few results
    try {
      const foodResults = await this.foodProvider.search(query, {
        ...options,
        limit: limit - beautyResults.length,
      });

      // Deduplicate by name and brand
      const seen = new Set<string>();
      const combined: DiscoveryProduct[] = [];

      for (const item of [...beautyResults, ...foodResults]) {
        const key = `${(item.brand || '').toLowerCase()}|${item.name.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }

      return combined.slice(0, limit);
    } catch {
      // If food provider fails, gracefully return whatever beauty results we have
      return beautyResults;
    }
  }
}
