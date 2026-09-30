// ==============================================================================
// Nittoo Product Discovery & Enrichment Types
// Provider-agnostic domain contracts for external catalog lookup & pre-filling
// ==============================================================================

import type { ProductCategory, SizeUnit } from '../../types';

export interface DiscoveryProduct {
  externalId: string;
  source: string;
  name: string;
  brand?: string;
  category?: ProductCategory;
  rawCategory?: string;
  sizeValue?: number;
  sizeUnit?: SizeUnit;
  rawSize?: string;
  imageUrl?: string;
  barcode?: string;
}

export interface DiscoverySearchOptions {
  limit?: number;
  signal?: AbortSignal;
}

export interface IProductDiscoveryProvider {
  readonly name: string;
  search(query: string, options?: DiscoverySearchOptions): Promise<DiscoveryProduct[]>;
}

export interface DiscoveryCacheEntry {
  timestamp: number;
  results: DiscoveryProduct[];
}
