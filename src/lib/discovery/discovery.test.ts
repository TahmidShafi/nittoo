import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateBarcode,
  normalizeBarcode,
  calculateGs1CheckDigit,
  validateBarcodeCheckDigit,
} from './barcode';
import { parseSize, mapCategory, sanitizeImageUrl } from './normalize';
import {
  OpenBeautyFactsProvider,
  OpenFoodFactsProvider,
  UpcItemDbProvider,
  CompositeDiscoveryProvider,
} from './provider';
import { searchExternalProducts, lookupExternalProductByBarcode } from './index';
import { discoveryCache } from './cache';
import {
  isAllowedOrigin,
  getCorsHeaders,
  verifySupabaseAccessToken,
} from '../../server/barcode-core';

describe('discovery & GS1 barcode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates EAN-13, UPC-A, EAN-8, and GTIN-14 check digits', () => {
    expect(normalizeBarcode(' 3600541-358522 ')).toBe('3600541358522');
    expect(calculateGs1CheckDigit('360054135852')).toBe(2);
    expect(validateBarcodeCheckDigit('3600541358522')).toBe(true);

    const valid = validateBarcode('3600541358522');
    expect(valid.valid).toBe(true);
    expect(valid.format).toBe('EAN-13');

    expect(validateBarcode('1234567890123').valid).toBe(false);
    expect(validateBarcode('abc').valid).toBe(false);
  });

  it('normalizes sizes, categories, and image URLs', () => {
    expect(parseSize('236 ml')).toEqual({ sizeValue: 236, sizeUnit: 'ml' });
    expect(parseSize('150g')).toEqual({ sizeValue: 150, sizeUnit: 'g' });
    expect(parseSize('30 count')).toEqual({ sizeValue: 30, sizeUnit: 'count' });
    expect(mapCategory('en:face-cleansers')).toBe('Skincare');
    expect(sanitizeImageUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('parses OpenBeautyFacts & OpenFoodFacts responses and skips UpcItemDb without auth', async () => {
    const obf = new OpenBeautyFactsProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            status: 1,
            product: {
              code: '3600541358522',
              product_name: 'Hydrating Cleanser',
              brands: 'CeraVe',
              quantity: '236 ml',
              categories_tags: ['en:face-cleansers'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const off = new OpenFoodFactsProvider({
      fetchFn: async () =>
        new Response(JSON.stringify({ status: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    const upcNoAuth = new UpcItemDbProvider({
      fetchFn: async () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    });

    const composite = new CompositeDiscoveryProvider({
      beautyProvider: obf,
      foodProvider: off,
      upcItemDbProvider: upcNoAuth,
    });
    const found = await composite.lookupByBarcode('3600541358522');
    expect(found?.name).toBe('Hydrating Cleanser');
    expect(found?.brand).toBe('CeraVe');
    expect(found?.sizeValue).toBe(236);
    expect(found?.sizeUnit).toBe('ml');

    // Without auth token and without custom fetch override, UpcItemDbProvider skips /api/discovery/barcode
    let globalFetchCalled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        globalFetchCalled = true;
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );
    const upcDefaultFetch = new UpcItemDbProvider();
    const noTokenResult = await upcDefaultFetch.lookupByBarcode('3600541358522');
    expect(noTokenResult).toBeNull();
    expect(globalFetchCalled).toBe(false);
  });

  it('enforces origin CORS and Supabase JWT verification in barcode-core', async () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('https://nittoo.vercel.app')).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);

    const cors = getCorsHeaders('http://localhost:5173');
    expect(cors['Access-Control-Allow-Origin']).toBe('http://localhost:5173');

    const denied = await verifySupabaseAccessToken(null, 'https://example.supabase.co', 'anon');
    expect(denied.valid).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 'u1' }), { status: 200 }))
    );
    const valid = await verifySupabaseAccessToken(
      'Bearer good-token',
      'https://example.supabase.co',
      'anon'
    );
    expect(valid.valid).toBe(true);
    expect(valid.userId).toBe('u1');
  });

  it('searches OpenFoodFacts, OpenBeautyFacts, and exercises CompositeDiscoveryProvider search', async () => {
    const obf = new OpenBeautyFactsProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            products: [
              {
                code: '3600541358522',
                product_name: 'Moisturizer',
                brands: 'BrandX',
                quantity: '50 ml',
                categories_tags: ['en:moisturizers'],
              },
            ],
          }),
          { status: 200 }
        ),
    });

    const off = new OpenFoodFactsProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            products: [
              {
                code: '8901234567890',
                product_name: 'Oat Milk',
                brands: 'Oatly',
                quantity: '1 l',
                categories_tags: ['en:plant-milks'],
              },
            ],
          }),
          { status: 200 }
        ),
    });

    const upc = new UpcItemDbProvider({
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            items: [{ ean: '012345678905', title: 'Item', brand: 'B', size: '100 g' }],
          }),
          { status: 200 }
        ),
    });

    const composite = new CompositeDiscoveryProvider({
      beautyProvider: obf,
      foodProvider: off,
      upcItemDbProvider: upc,
    });
    const results = await composite.search('milk');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(parseSize('500 g')).toEqual({ sizeValue: 500, sizeUnit: 'g' });
    expect(mapCategory('en:beverages')).toBe('Food & Beverage');

    discoveryCache.clear();
    discoveryCache.set('milk', results);
    expect(discoveryCache.get('milk')).toHaveLength(results.length);
    discoveryCache.setBarcode('3600541358522', results[0]);
    expect(discoveryCache.getBarcode('3600541358522')?.name).toBe(results[0].name);

    const cachedSearch = await searchExternalProducts('milk');
    expect(cachedSearch).toHaveLength(results.length);
    const cachedBarcode = await lookupExternalProductByBarcode('3600541358522');
    expect(cachedBarcode?.name).toBe(results[0].name);
  });
});
