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
  status?: number;
  status_verbose?: string;
  product?: RawOpenFactsProduct;
  code?: string;
}

export interface OpenFactsProviderOptions {
  fetchFn?: FetchFunction;
  baseUrl?: string;
  productBaseUrl?: string;
}

export type FetchInput = string | URL | any;
export type FetchFunction = (input: FetchInput, init?: any) => Promise<Response>;

const defaultFetch: FetchFunction = (input, init) => {
  return fetch(input, init);
};

export const DEFAULT_PROVIDER_TIMEOUT_MS = 7000;

export async function fetchWithTimeout(
  fetchFn: FetchFunction,
  url: FetchInput,
  init?: any,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let signal = controller.signal;
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    const res = await fetchFn(url, { ...init, signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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
  private productBaseUrl: string;

  constructor(options?: OpenFactsProviderOptions) {
    this.fetchFn = options?.fetchFn || defaultFetch;
    this.baseUrl = options?.baseUrl || 'https://world.openbeautyfacts.org/cgi/search.pl';
    this.productBaseUrl = options?.productBaseUrl || 'https://world.openbeautyfacts.org/api/v2/product';
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

    const response = await fetchWithTimeout(this.fetchFn, url, {
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

  async lookupByBarcode(barcode: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct | null> {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return null;

    const url = `${this.productBaseUrl}/${encodeURIComponent(cleanBarcode)}.json`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const response = await fetchWithTimeout(this.fetchFn, url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`OpenBeautyFacts lookup failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawOpenFactsResponse;
    if (!data || data.status === 0 || !data.product) {
      return null;
    }

    const normalized = normalizeOpenFactsProducts([data.product], 'openbeautyfacts');
    return normalized[0] || null;
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
  private productBaseUrl: string;

  constructor(options?: OpenFactsProviderOptions) {
    this.fetchFn = options?.fetchFn || defaultFetch;
    this.baseUrl = options?.baseUrl || 'https://world.openfoodfacts.org/cgi/search.pl';
    this.productBaseUrl = options?.productBaseUrl || 'https://world.openfoodfacts.org/api/v2/product';
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

    const response = await fetchWithTimeout(this.fetchFn, url, {
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

  async lookupByBarcode(barcode: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct | null> {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return null;

    const url = `${this.productBaseUrl}/${encodeURIComponent(cleanBarcode)}.json`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const response = await fetchWithTimeout(this.fetchFn, url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`OpenFoodFacts lookup failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawOpenFactsResponse;
    if (!data || data.status === 0 || !data.product) {
      return null;
    }

    const normalized = normalizeOpenFactsProducts([data.product], 'openfoodfacts');
    return normalized[0] || null;
  }
}

export interface RawUpcItemDbItem {
  ean?: string;
  title?: string;
  description?: string;
  upc?: string;
  brand?: string;
  model?: string;
  color?: string;
  size?: string;
  dimension?: string;
  weight?: string;
  category?: string;
  lowest_recorded_price?: number;
  highest_recorded_price?: number;
  images?: string[];
}

export interface RawUpcItemDbResponse {
  code?: string;
  total?: number;
  offset?: number;
  message?: string;
  items?: RawUpcItemDbItem[];
}

export interface UpcItemDbProviderOptions {
  fetchFn?: FetchFunction;
  baseUrl?: string;
  endpoint?: string;
}

/**
 * Normalizes raw UPCitemdb response items into Nittoo's provider-agnostic DiscoveryProduct model.
 * Preserves the exact requested barcode (including leading zeros).
 */
export function normalizeUpcItemDbProducts(
  rawItems: RawUpcItemDbItem[] | undefined,
  source: string,
  requestedBarcode: string
): DiscoveryProduct[] {
  if (!Array.isArray(rawItems)) return [];
  const results: DiscoveryProduct[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const name = normalizeText(item.title);
    if (!name) continue;

    const brand = normalizeText(item.brand) || undefined;
    const rawCategory = item.category ? normalizeText(item.category) : undefined;
    const category = mapCategory(item.category);

    const parsedSizeFromRaw = parseSize(item.size);
    const parsedSizeFromTitle = parseSize(item.title);
    const sizeValue = parsedSizeFromRaw.sizeValue ?? parsedSizeFromTitle.sizeValue;
    const sizeUnit = parsedSizeFromRaw.sizeUnit ?? parsedSizeFromTitle.sizeUnit;
    const rawSize = item.size ? normalizeText(item.size) : undefined;

    const firstImage = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : undefined;
    const imageUrl = sanitizeImageUrl(firstImage);

    // Strictly preserve original requested barcode string (including leading zeros)
    const barcode = requestedBarcode || (item.ean ? normalizeText(item.ean) : undefined) || (item.upc ? normalizeText(item.upc) : undefined);
    const externalId = item.ean || item.upc || `${source}-${results.length}-${name.toLowerCase()}`;

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
 * UPCitemdb Provider
 * Commercial CPG barcode database fallback.
 * Uses Nittoo's server-side proxy endpoint (/api/discovery/barcode) in browser environments
 * to avoid CORS restrictions while keeping API credentials strictly server-side.
 */
export class UpcItemDbProvider implements IProductDiscoveryProvider {
  readonly name = 'UPCitemdb';
  private fetchFn: FetchFunction;
  private endpoint: string;

  constructor(options?: UpcItemDbProviderOptions) {
    this.fetchFn = options?.fetchFn || defaultFetch;
    this.endpoint = options?.endpoint || options?.baseUrl || '/api/discovery/barcode';
  }

  async search(_query: string, _options?: DiscoverySearchOptions): Promise<DiscoveryProduct[]> {
    return [];
  }

  private async fetchUpc(code: string, signal?: AbortSignal): Promise<RawUpcItemDbResponse | null> {
    const url = `${this.endpoint}?upc=${encodeURIComponent(code)}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const response = await fetchWithTimeout(this.fetchFn, url, {
      method: 'GET',
      headers,
      signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`UPCitemdb lookup failed with status ${response.status}`);
    }

    const data = (await response.json()) as RawUpcItemDbResponse;
    return data;
  }

  async lookupByBarcode(barcode: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct | null> {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return null;

    // Use Nittoo server endpoint if configured with /api path
    if (this.endpoint.startsWith('/api/') || this.endpoint.includes('/api/discovery/barcode')) {
      const response = await fetchWithTimeout(this.fetchFn, this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ barcode: cleanBarcode }),
        signal: options?.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`UPCitemdb server lookup failed with status ${response.status}`);
      }

      const data = (await response.json()) as { product?: DiscoveryProduct | null; items?: RawUpcItemDbItem[] } | null;
      if (data && typeof data === 'object' && 'product' in data) {
        return (data.product as DiscoveryProduct) ?? null;
      }
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        const normalized = normalizeUpcItemDbProducts(data.items, 'upcitemdb', cleanBarcode);
        return normalized[0] || null;
      }
      return null;
    }

    // Direct endpoint (used when custom baseUrl is specified or for backward compatibility)
    let data = await this.fetchUpc(cleanBarcode, options?.signal);

    // If 13-digit barcode starting with 0 yielded no results, also check 12-digit UPC
    if (
      (!data || data.total === 0 || !data.items || data.items.length === 0) &&
      cleanBarcode.length === 13 &&
      cleanBarcode.startsWith('0')
    ) {
      const upc12 = cleanBarcode.slice(1);
      const fallbackData = await this.fetchUpc(upc12, options?.signal);
      if (fallbackData && fallbackData.total && fallbackData.total > 0 && fallbackData.items && fallbackData.items.length > 0) {
        data = fallbackData;
      }
    }

    if (!data || data.total === 0 || !data.items || data.items.length === 0) {
      return null;
    }

    const normalized = normalizeUpcItemDbProducts(data.items, 'upcitemdb', cleanBarcode);
    return normalized[0] || null;
  }
}

export interface CompositeDiscoveryProviderOptions {
  beautyProvider?: IProductDiscoveryProvider;
  foodProvider?: IProductDiscoveryProvider;
  upcItemDbProvider?: IProductDiscoveryProvider;
}

/**
 * Composite Provider
 * Searches Open Beauty Facts first. If results are sparse (< 3),
 * queries Open Food Facts to support supplements & grocery consumables.
 * For barcode lookups: executes sequential fallback (Open Beauty Facts -> Open Food Facts -> UPCitemdb).
 */
export class CompositeDiscoveryProvider implements IProductDiscoveryProvider {
  readonly name = 'CompositeProvider';
  private beautyProvider: IProductDiscoveryProvider;
  private foodProvider: IProductDiscoveryProvider;
  private upcItemDbProvider?: IProductDiscoveryProvider;

  constructor(options?: CompositeDiscoveryProviderOptions) {
    this.beautyProvider = options?.beautyProvider || new OpenBeautyFactsProvider();
    this.foodProvider = options?.foodProvider || new OpenFoodFactsProvider();
    if (options && (options.beautyProvider || options.foodProvider) && options.upcItemDbProvider === undefined) {
      this.upcItemDbProvider = undefined;
    } else {
      this.upcItemDbProvider = options?.upcItemDbProvider || new UpcItemDbProvider();
    }
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

  async lookupByBarcode(barcode: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct | null> {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return null;

    const providers: IProductDiscoveryProvider[] = [
      this.beautyProvider,
      this.foodProvider,
      ...(this.upcItemDbProvider ? [this.upcItemDbProvider] : []),
    ];

    let lastError: unknown = null;
    let notFoundCount = 0;

    for (const provider of providers) {
      try {
        const result = await provider.lookupByBarcode(cleanBarcode, options);
        if (result) {
          return result;
        }
        notFoundCount++;
      } catch (err) {
        lastError = err;
      }
    }

    // If every provider legitimately searched and reported not found, return null
    if (notFoundCount === providers.length) {
      return null;
    }

    // If an error occurred on any provider and no result was found, propagate the error
    if (lastError) {
      throw lastError;
    }

    return null;
  }
}
