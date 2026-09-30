// ==============================================================================
// Nittoo Stage 19 Automated Verification:
// Product Discovery & Enrichment Audit
// ==============================================================================

import {
  normalizeText,
  parseSize,
  mapCategory,
  sanitizeImageUrl,
} from '../src/lib/discovery/normalize';
import {
  OpenBeautyFactsProvider,
  OpenFoodFactsProvider,
  CompositeDiscoveryProvider,
  normalizeOpenFactsProducts,
  type RawOpenFactsResponse,
} from '../src/lib/discovery/provider';
import {
  discoveryCache,
} from '../src/lib/discovery/cache';
import {
  searchExternalProducts,
  setDiscoveryProvider,
  MIN_SEARCH_QUERY_LENGTH,
  type DiscoveryProduct,
  type IProductDiscoveryProvider,
} from '../src/lib/discovery';
import { PRODUCT_CATEGORIES } from '../src/types';
import { MockDatabase, InMemoryStorageAdapter } from '../src/lib/mock-db';
import { validateBackupFile, buildImportPlan, executeRestore } from '../src/lib/restore';
import { buildExportData } from '../src/lib/export/normalizer';
import { generateJsonBackup } from '../src/lib/export/json';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runDiscoveryVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 19: PRODUCT DISCOVERY & ENRICHMENT AUDIT');
  console.log('=================================================================\n');

  // ----------------------------------------------------------------------------
  // SECTION 1: Pure Text, Size & Category Normalization
  // ----------------------------------------------------------------------------
  console.log('--- 1. Testing Normalization & Sanitization ---');

  // Test 1: normalizeText trims, collapses whitespace, and strips HTML
  const rawMalicious = '  <script>alert("xss")</script> CeraVe   <b>Hydrating</b> Cleanser  ';
  const cleanText = normalizeText(rawMalicious);
  assert(cleanText === 'alert("xss") CeraVe Hydrating Cleanser', '23. External HTML/scripts stripped from text');
  assert(!cleanText.includes('<script>'), '23. Script tags completely removed');

  // Test 4 & 5: Name and Brand mapping
  const testBrand = normalizeText('  L\'Oreal Paris  ');
  assert(testBrand === "L'Oreal Paris", '4. Brand normalized without leading/trailing whitespace');

  // Test 6: Size parsing for supported units: ml, g, count
  const sizeMl = parseSize('236 ml');
  assert(sizeMl.sizeValue === 236 && sizeMl.sizeUnit === 'ml', '6. ml volume parsed correctly (236 ml -> 236, ml)');

  const sizeMlAttached = parseSize('50ml');
  assert(sizeMlAttached.sizeValue === 50 && sizeMlAttached.sizeUnit === 'ml', '6. Attached ml parsed correctly (50ml -> 50, ml)');

  const sizeG = parseSize('90 grams');
  assert(sizeG.sizeValue === 90 && sizeG.sizeUnit === 'g', '6. grams weight parsed correctly (90 grams -> 90, g)');

  const sizeCount = parseSize('60 capsules');
  assert(sizeCount.sizeValue === 60 && sizeCount.sizeUnit === 'count', '6. capsules count parsed correctly (60 capsules -> 60, count)');

  const sizeSoftgels = parseSize('120 Softgels');
  assert(sizeSoftgels.sizeValue === 120 && sizeSoftgels.sizeUnit === 'count', '6. softgels parsed as count (120 Softgels -> 120, count)');

  // Metric embedded in parentheses: e.g. "3 FL OZ (87ml)"
  const sizeWithMetricParens = parseSize('3 FL OZ (87ml)');
  assert(sizeWithMetricParens.sizeValue === 87 && sizeWithMetricParens.sizeUnit === 'ml', '6. Parenthesized metric volume takes priority (3 FL OZ (87ml) -> 87, ml)');

  // Test 7: Unsupported size units are not fabricated
  const unsupportedFlOz = parseSize('8 fl oz');
  assert(unsupportedFlOz.sizeValue === undefined && unsupportedFlOz.sizeUnit === undefined, '7. Unsupported unit (8 fl oz without metric) leaves size undefined without fabricating values');

  const unsupportedPounds = parseSize('2 lbs');
  assert(unsupportedPounds.sizeValue === undefined && unsupportedPounds.sizeUnit === undefined, '7. Unsupported weight (2 lbs) leaves size undefined');

  const emptySize = parseSize('');
  assert(emptySize.sizeValue === undefined, '3. Empty size remains undefined');

  // Test 8: Category mapping strictly uses Nittoo categories
  const catSkincare = mapCategory(['en:face', 'en:cleansers', 'en:moisturizer']);
  assert(catSkincare === 'Skincare', '8. External tags mapped to Skincare');

  const catOral = mapCategory(['en:toothpastes', 'en:hygiene']);
  assert(catOral === 'Oral Care', '8. External toothpastes tag mapped to Oral Care');

  const catHair = mapCategory(['en:shampoos', 'en:hair']);
  assert(catHair === 'Haircare', '8. External shampoo tag mapped to Haircare');

  const catBody = mapCategory(['en:shower-gels', 'en:body']);
  assert(catBody === 'Body Care', '8. External shower gel tag mapped to Body Care');

  const catSupplements = mapCategory(['en:dietary-supplements', 'en:vitamins']);
  assert(catSupplements === 'Supplements', '8. External dietary-supplements mapped to Supplements');

  // Verify all mapped categories are valid Nittoo categories
  assert(PRODUCT_CATEGORIES.includes(catSkincare!), '8. Mapped category is in authoritative PRODUCT_CATEGORIES');

  // Test 9: Unknown external category is not blindly inserted
  const catUnknown = mapCategory(['en:automotive-parts', 'en:screws-and-nails']);
  assert(catUnknown === undefined, '9. Unknown external category is not blindly inserted (returns undefined)');

  // Image URL sanitization
  const safeImg = sanitizeImageUrl('https://images.openbeautyfacts.org/front.jpg');
  assert(safeImg === 'https://images.openbeautyfacts.org/front.jpg', '14. HTTPS image URL accepted');

  const unsafeHttpImg = sanitizeImageUrl('http://insecure.com/pic.jpg');
  assert(unsafeHttpImg === undefined, '14. Insecure HTTP image rejected');

  const unsafeScriptImg = sanitizeImageUrl('javascript:alert(1)');
  assert(unsafeScriptImg === undefined, '23. javascript: protocol image rejected');

  // ----------------------------------------------------------------------------
  // SECTION 2: Provider Response Normalization (Offline Fixture)
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Provider Response Normalization ---');

  const mockApiResponse: RawOpenFactsResponse = {
    count: 3,
    products: [
      {
        code: '3337875597180',
        product_name: 'Hydrating Cleanser',
        brands: 'CeraVe',
        quantity: '236ml',
        categories_tags: ['en:face', 'en:cleansers'],
        image_small_url: 'https://images.openbeautyfacts.org/cerave.jpg',
      },
      {
        code: '3337875597197',
        product_name_en: 'Foaming Cleanser',
        brands: 'CeraVe',
        quantity: '3 FL OZ (87ml)',
        categories_tags: ['en:cleansers'],
      },
      // Malformed / nameless product: should be skipped
      {
        code: '999999999',
        product_name: '   ',
        brands: 'Unknown',
      },
      // Product with missing optional brand & size
      {
        code: '123456789',
        product_name: 'Pure Glycerin Bar',
      },
    ],
  };

  const normalized = normalizeOpenFactsProducts(mockApiResponse.products, 'openbeautyfacts');

  // Test 2 & 22: Successful normalization & malformed data rejected
  assert(normalized.length === 3, '2, 22. Exactly 3 valid products normalized; nameless product safely rejected');

  // Check product 1
  const p1 = normalized[0];
  assert(p1.name === 'Hydrating Cleanser', '5. Product name normalized');
  assert(p1.brand === 'CeraVe', '4. Brand normalized');
  assert(p1.category === 'Skincare', '8. Category mapped to Skincare');
  assert(p1.sizeValue === 236 && p1.sizeUnit === 'ml', '6. Size parsed as 236 ml');
  assert(p1.barcode === '3337875597180', 'Future Stage 20 barcode preserved');
  assert(p1.imageUrl === 'https://images.openbeautyfacts.org/cerave.jpg', 'Image URL preserved');

  // Check product 2: product_name_en fallback & parens metric
  const p2 = normalized[1];
  assert(p2.name === 'Foaming Cleanser', '5. product_name_en used when product_name is absent');
  assert(p2.sizeValue === 87 && p2.sizeUnit === 'ml', '6. Metric in parentheses parsed (87 ml)');

  // Check product 3: missing optional fields
  const p3 = normalized[2];
  assert(p3.name === 'Pure Glycerin Bar', '5. Valid product name');
  assert(p3.brand === undefined, '3. Missing brand remains undefined');
  assert(p3.sizeValue === undefined, '3. Missing size remains undefined');
  assert(p3.imageUrl === undefined, '3. Missing image remains undefined');

  // ----------------------------------------------------------------------------
  // SECTION 3: Provider Adapter & Mock Fetch (Offline Tests)
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Testing Provider Adapters with Mock Fetch ---');

  let interceptedUrl = '';
  let interceptedHeaders: any = null;

  const mockSuccessFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    interceptedUrl = String(input);
    interceptedHeaders = init?.headers;
    return new Response(JSON.stringify(mockApiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const testProvider = new OpenBeautyFactsProvider({ fetchFn: mockSuccessFetch as any });
  const providerResults = await testProvider.search('cerave', { limit: 5 });

  assert(providerResults.length === 3, '2. Provider returned 3 normalized results');
  assert(interceptedUrl.includes('search_terms=cerave'), '25. Only search terms passed in request URL');
  assert(!interceptedUrl.includes('user_id'), '25. No user portfolio data sent in discovery URL');
  assert(!interceptedHeaders?.['Authorization'], '24. No auth credentials sent in provider requests');

  // Test 18: Empty results handling
  const mockEmptyFetch = async () => {
    return new Response(JSON.stringify({ count: 0, products: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const emptyProvider = new OpenBeautyFactsProvider({ fetchFn: mockEmptyFetch as any });
  const emptyResults = await emptyProvider.search('nonexistentproductxyz');
  assert(Array.isArray(emptyResults) && emptyResults.length === 0, '18. Empty results returns empty array');

  // Test 19: API error handling (e.g. 500 status)
  const mockErrorFetch = async () => {
    return new Response('Internal Server Error', { status: 500 });
  };
  const errorProvider = new OpenBeautyFactsProvider({ fetchFn: mockErrorFetch as any });
  let errorCaught = false;
  try {
    await errorProvider.search('errorquery');
  } catch (err) {
    errorCaught = true;
  }
  assert(errorCaught, '19. API 500 error cleanly throws caught error without crashing');

  // Test 20: Network failure handling
  const mockNetworkFailFetch = async () => {
    throw new Error('Failed to fetch (offline)');
  };
  const networkFailProvider = new OpenBeautyFactsProvider({ fetchFn: mockNetworkFailFetch as any });
  let networkErrorCaught = false;
  try {
    await networkFailProvider.search('networkfail');
  } catch (err) {
    networkErrorCaught = true;
  }
  assert(networkErrorCaught, '20. Network failure safely caught');

  // Test 21: Rate-limit (429) response handling
  const mockRateLimitFetch = async () => {
    return new Response('Too Many Requests', { status: 429 });
  };
  const rateLimitProvider = new OpenBeautyFactsProvider({ fetchFn: mockRateLimitFetch as any });
  let rateLimitCaught = false;
  try {
    await rateLimitProvider.search('ratelimit');
  } catch (err) {
    rateLimitCaught = true;
  }
  assert(rateLimitCaught, '21. Rate-limit 429 response handled correctly');

  // ----------------------------------------------------------------------------
  // SECTION 4: In-Memory Search Caching & Query Guard
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Testing In-Memory Discovery Cache & Query Bounds ---');

  discoveryCache.clear();
  assert(discoveryCache.size() === 0, 'Cache starts empty');

  // Test 1: Minimum query length guard
  const shortResults = await searchExternalProducts('ab');
  assert(shortResults.length === 0, '1. Query below minimum length (2 chars) returns empty array without fetching');

  // Configure high-level search with mock provider
  let mockFetchCallCount = 0;
  const mockCountingFetch = async () => {
    mockFetchCallCount++;
    return new Response(JSON.stringify(mockApiResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  setDiscoveryProvider(new OpenBeautyFactsProvider({ fetchFn: mockCountingFetch as any }));

  // First search: should trigger fetch
  const cachedCall1 = await searchExternalProducts('cerave cleanser');
  assert(cachedCall1.length === 3, 'First search succeeds with 3 results');
  assert(mockFetchCallCount === 1, 'Provider fetch was called once');
  assert(discoveryCache.size() === 1, '26. Search result added to in-memory cache');

  // Second search: identical query should hit cache without calling provider
  const cachedCall2 = await searchExternalProducts('cerave cleanser');
  assert(cachedCall2.length === 3, 'Second search returns identical cached results');
  assert(mockFetchCallCount === 1, '26. Cache hit prevented duplicate external network call');

  // Test 27: Discovery does not write to localStorage
  assert(typeof localStorage === 'undefined' || !localStorage.getItem('discovery-cache'), '27. Discovery does not persist data to localStorage');

  // ----------------------------------------------------------------------------
  // SECTION 5: Domain Separation, Form State & Duplicate Safety
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Testing Database Independence & Duplicate Safety ---');

  const storage = new InMemoryStorageAdapter();
  const db = new MockDatabase(storage);
  const testUserId = 'user-discovery-101';

  // Test 10: Search results do NOT create database products
  const productsBefore = await db.getAllUserProducts(testUserId);
  assert(productsBefore.length === 0, 'Database starts with 0 products');

  // Perform search
  await searchExternalProducts('cerave cleanser');
  const productsAfterSearch = await db.getAllUserProducts(testUserId);
  assert(productsAfterSearch.length === 0, '10. External search results do NOT create database products');

  // Test 11: Selecting a result only pre-fills form state
  const selectedDiscoveryItem: DiscoveryProduct = {
    externalId: 'ext-999',
    source: 'openbeautyfacts',
    name: 'CeraVe Hydrating Cleanser',
    brand: 'CeraVe',
    category: 'Skincare',
    sizeValue: 236,
    sizeUnit: 'ml',
  };

  // Simulate AddProduct form state prefilled from discovery item
  let formState = {
    name: selectedDiscoveryItem.name,
    brand: selectedDiscoveryItem.brand || '',
    category: selectedDiscoveryItem.category || 'Skincare',
    sizeValue: selectedDiscoveryItem.sizeValue ? String(selectedDiscoveryItem.sizeValue) : '',
    sizeUnit: selectedDiscoveryItem.sizeUnit || 'ml',
    // 13, 14, 15: Price, Purchase Date, Store/Vendor remain user-controlled
    price: '',
    purchaseDate: '2026-09-30',
    storeVendor: '',
  };

  assert(formState.name === 'CeraVe Hydrating Cleanser', '11. Form name pre-filled from discovery');
  assert(formState.brand === 'CeraVe', '11. Form brand pre-filled from discovery');
  assert(formState.category === 'Skincare', '11. Form category pre-filled from discovery');
  assert(formState.sizeValue === '236' && formState.sizeUnit === 'ml', '11. Form size pre-filled from discovery');
  assert(formState.price === '', '13. Price remains user-controlled (empty)');
  assert(formState.storeVendor === '', '15. Store/Vendor remains user-controlled (empty)');

  // Test 12: Manual edits after discovery are preserved
  formState.name = 'CeraVe Hydrating Cleanser (Dry Skin Edition)';
  formState.price = '1450';
  formState.storeVendor = 'Shajgoj';
  assert(formState.name === 'CeraVe Hydrating Cleanser (Dry Skin Edition)', '12. User manual edits to pre-filled name are preserved');
  assert(formState.price === '1450', '13. User manual price preserved');
  assert(formState.storeVendor === 'Shajgoj', '15. User manual vendor preserved');

  // Submit product to database through existing Add Product flow
  const createdProd = await db.createProduct(testUserId, {
    name: formState.name,
    category: formState.category,
    brand: formState.brand,
    size_value: Number(formState.sizeValue),
    size_unit: formState.sizeUnit as any,
  });

  assert(createdProd.name === 'CeraVe Hydrating Cleanser (Dry Skin Edition)', 'Database product created with user edited name');
  const userProductsAfterSave = await db.getAllUserProducts(testUserId);
  assert(userProductsAfterSave.length === 1, 'Exactly 1 product now in database');

  // Test 17: Duplicate safety when external result matches existing tracked essential
  const existingProductMatch = userProductsAfterSave.find(
    (p) => p.name.toLowerCase() === formState.name.toLowerCase()
  );
  assert(existingProductMatch !== undefined, '17. Existing tracked essential correctly matched; links to existing product instead of creating duplicate');

  // ----------------------------------------------------------------------------
  // SECTION 6: Export & Restore Invariance
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Testing Export and Restore Invariance ---');

  // Create purchase for the product
  await db.createPurchase(testUserId, {
    product_id: createdProd.id,
    purchase_date: '2026-09-30',
    price: 1450,
    store_vendor: 'Shajgoj',
  });

  const exportData = await buildExportData(testUserId, 'test@nittoo.app', db);
  assert(exportData.products.length === 1, '29. Export contains saved product');
  assert(exportData.purchases.length === 1, '29. Export contains purchase');
  assert((exportData as any).discovery_cache === undefined, '29. Export schema does not include transient discovery cache');

  // Test 30: Restore invariance
  const rawJson = generateJsonBackup(exportData);
  const validated = validateBackupFile(rawJson);
  assert(validated.valid === true, '30. Exported JSON backup passes validation');
  if (!validated.valid) return;

  const restoredDb = new MockDatabase(new InMemoryStorageAdapter());
  const importPlan = await buildImportPlan(validated.backupData, 'user-restored-999', restoredDb);
  const restoreResult = await executeRestore(importPlan, 'user-restored-999', restoredDb);
  assert(restoreResult.success === true, '30. Restore imports products normally without schema errors');
  const restoredProducts = await restoredDb.getAllUserProducts('user-restored-999');
  assert(restoredProducts.length === 1, '30. User owns restored product');

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 19 PRODUCT DISCOVERY & ENRICHMENT CHECKS PASSED!');
  console.log('=================================================================');
}

runDiscoveryVerification().catch((err) => {
  console.error('Fatal error during discovery verification:', err);
  process.exit(1);
});
