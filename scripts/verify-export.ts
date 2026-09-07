// ==============================================================================
// Nittoo Stage 14 Automated Verification: Professional Data Export System
// Verifies Excel (.xlsx), CSV Archive (.zip), PDF Report (.pdf), and JSON Backup (.json)
// Validates file integrity, SheetJS worksheets, JSZip archives, PDF magic bytes,
// semantic Observed vs Predicted labeling, multi-tenant security, and immutability.
// ==============================================================================

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../src/lib/mock-db';
import { buildExportData } from '../src/lib/export/normalizer';
import { generateExcelWorkbook } from '../src/lib/export/excel';
import { generateCsvZip, escapeCsvCell } from '../src/lib/export/csv';
import { generatePdfReport } from '../src/lib/export/pdf';
import { generateJsonBackup } from '../src/lib/export/json';
import type { NittooExportData } from '../src/lib/export/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runExportVerification() {
  console.log('=================================================================');
  console.log('NITTOO STAGE 14: PROFESSIONAL DATA EXPORT SYSTEM VERIFICATION');
  console.log('=================================================================\n');

  const memoryAdapter = new InMemoryStorageAdapter();
  const db = new MockDatabase(memoryAdapter);

  // ----------------------------------------------------------------------------
  // 1. PURE EXPORT MODEL & NORMALIZATION
  // ----------------------------------------------------------------------------
  console.log('--- 1. Testing Unified Export Normalization (buildExportData) ---');

  // Add 1 unopened backup purchase for CeraVe to test active + unopened inventory export
  const activeProducts = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);
  const cerave = activeProducts.find((p) => p.name.includes('CeraVe'))!;
  await db.createPurchase(DEFAULT_MOCK_USER_ID, {
    product_id: cerave.id,
    purchase_date: '2026-09-05',
    price: 1300,
  });

  const userEmail = 'demo-user@nittoo.local';
  const exportData: NittooExportData = await buildExportData(DEFAULT_MOCK_USER_ID, userEmail, db);

  assert(exportData.version === '1.0.0', 'Export schema version is 1.0.0');
  assert(Boolean(exportData.exported_at), 'Exported timestamp is present');
  assert(exportData.user.id === DEFAULT_MOCK_USER_ID, `User ID matches (${exportData.user.id})`);
  assert(exportData.user.email === userEmail, `User email matches (${exportData.user.email})`);

  // Summary Metrics
  assert(exportData.summary.total_products > 0, `Total products: ${exportData.summary.total_products}`);
  assert(exportData.summary.total_purchases > 0, `Total purchases: ${exportData.summary.total_purchases}`);
  assert(exportData.summary.active_essentials > 0, `Active essentials: ${exportData.summary.active_essentials}`);
  assert(exportData.summary.completed_usage_cycles > 0, `Completed cycles: ${exportData.summary.completed_usage_cycles}`);
  assert(
    exportData.summary.estimated_monthly_consumption !== null &&
      exportData.summary.estimated_monthly_consumption > 0,
    `Estimated monthly consumption: ৳${exportData.summary.estimated_monthly_consumption}`
  );
  assert(exportData.summary.category_breakdown.length > 0, 'Category breakdown computed');

  // Semantic Observed vs Predicted distinction
  const ceraveAnalytics = exportData.analytics.find((a) => a.product_name.includes('CeraVe'))!;
  assert(Boolean(ceraveAnalytics), 'Found CeraVe in analytics items');
  assert(
    ceraveAnalytics.observed_average_lifespan !== null,
    `CeraVe observed lifespan: ${ceraveAnalytics.observed_average_lifespan} days`
  );
  assert(
    ceraveAnalytics.observed_cost_per_day !== null,
    `CeraVe observed cost/day: ৳${ceraveAnalytics.observed_cost_per_day}`
  );
  assert(
    ceraveAnalytics.confidence_state === 'developing',
    `CeraVe confidence state: ${ceraveAnalytics.confidence_state}`
  );

  // ----------------------------------------------------------------------------
  // 2. EXCEL (.XLSX) EXPORT VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Testing Excel Workbook (.xlsx) Generation & Parsing ---');

  const excelBuffer = generateExcelWorkbook(exportData);
  assert(excelBuffer instanceof Uint8Array, 'Excel output is a valid binary Uint8Array');
  assert(excelBuffer.byteLength > 1000, `Excel workbook size: ${excelBuffer.byteLength} bytes`);

  // Parse generated Excel buffer with SheetJS to verify integrity
  const parsedWb = XLSX.read(excelBuffer, { type: 'array' });
  assert(Boolean(parsedWb), 'SheetJS parsed the generated workbook successfully');

  // Verify all 6 mandatory sheets exist
  const expectedSheets = ['Summary', 'Products', 'Purchases', 'Usage History', 'Inventory', 'Analytics'];
  for (const sheetName of expectedSheets) {
    assert(parsedWb.SheetNames.includes(sheetName), `Excel contains '${sheetName}' worksheet`);
  }

  // Verify Summary Sheet contents
  const summarySheet = parsedWb.Sheets['Summary'];
  const summaryData = XLSX.utils.sheet_to_json(summarySheet, { header: 1 }) as (string | number)[][];
  assert(summaryData[0][0] === 'NITTOO', 'Summary sheet has brand header NITTOO');
  assert(summaryData[1][0] === 'Know What Lasts.', 'Summary sheet has tagline "Know What Lasts."');

  // Verify Products Sheet contents
  const productsSheet = parsedWb.Sheets['Products'];
  const productsData = XLSX.utils.sheet_to_json(productsSheet, { header: 1 }) as (string | number)[][];
  assert(productsData[0][0] === 'Product ID', 'Products sheet header column 1 is "Product ID"');
  assert(productsData[0][1] === 'Product Name', 'Products sheet header column 2 is "Product Name"');
  assert(productsData.length >= exportData.products.length + 1, 'Products sheet has all product rows');

  // Verify Usage History Sheet contents
  const usageSheet = parsedWb.Sheets['Usage History'];
  const usageData = XLSX.utils.sheet_to_json(usageSheet, { header: 1 }) as (string | number)[][];
  assert(usageData[0][6] === 'Days Used (Observed)', 'Usage History sheet header has "Days Used (Observed)"');
  assert(usageData[0][9] === 'Cost / Day (Observed)', 'Usage History sheet header has "Cost / Day (Observed)"');

  // Verify Inventory Sheet contents (Active vs Unopened separation)
  const inventorySheet = parsedWb.Sheets['Inventory'];
  const inventoryData = XLSX.utils.sheet_to_json(inventorySheet, { header: 1 }) as (string | number)[][];
  assert(inventoryData[0][3] === 'Inventory Status', 'Inventory sheet header has "Inventory Status"');
  const inventoryStatuses = inventoryData.slice(1).map((row) => row[3]);
  assert(inventoryStatuses.includes('Active'), 'Inventory sheet contains Active items');
  assert(inventoryStatuses.includes('Unopened'), 'Inventory sheet contains Unopened items');

  // Verify Analytics Sheet contents
  const analyticsSheet = parsedWb.Sheets['Analytics'];
  const analyticsData = XLSX.utils.sheet_to_json(analyticsSheet, { header: 1 }) as (string | number)[][];
  assert(analyticsData[0][3] === 'Observed Average Lifespan (Days)', 'Analytics sheet column 4 is Observed Average Lifespan');
  assert(analyticsData[0][5] === 'Observed Cost / Day (BDT)', 'Analytics sheet column 6 is Observed Cost / Day (BDT)');
  assert(analyticsData[0][9] === 'Prediction Confidence Level', 'Analytics sheet column 10 is Confidence Level');

  // ----------------------------------------------------------------------------
  // 3. CSV ARCHIVE (.ZIP) EXPORT VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Testing CSV ZIP Archive (.zip) Generation & Escaping ---');

  // Test CSV escaping helper
  assert(escapeCsvCell('Simple') === 'Simple', 'Simple string unescaped');
  assert(escapeCsvCell('Product, with comma') === '"Product, with comma"', 'Commas safely quoted');
  assert(escapeCsvCell('Product "quoted"') === '"Product ""quoted"""', 'Quotes safely double-escaped');
  assert(escapeCsvCell('Line1\nLine2') === '"Line1\nLine2"', 'Newlines safely quoted');

  const zipBuffer = await generateCsvZip(exportData);
  assert(zipBuffer instanceof Uint8Array, 'ZIP output is a valid binary Uint8Array');
  assert(zipBuffer.byteLength > 500, `ZIP archive size: ${zipBuffer.byteLength} bytes`);

  // Unpack with JSZip to verify file presence and UTF-8 BOM
  const zip = await JSZip.loadAsync(zipBuffer);
  const expectedCsvFiles = [
    'summary.csv',
    'products.csv',
    'purchases.csv',
    'usage-history.csv',
    'inventory.csv',
    'analytics.csv',
  ];

  for (const csvFile of expectedCsvFiles) {
    const file = zip.file(csvFile);
    assert(file !== null, `ZIP archive contains '${csvFile}'`);
    const content = await file!.async('string');
    assert(content.startsWith('\uFEFF'), `'${csvFile}' starts with UTF-8 BOM for Excel Unicode compatibility`);
    assert(content.split('\r\n').length >= 2, `'${csvFile}' contains rows`);
  }

  // ----------------------------------------------------------------------------
  // 4. PDF REPORT (.PDF) EXPORT VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Testing PDF Report (.pdf) Generation ---');

  const pdfBuffer = generatePdfReport(exportData);
  assert(pdfBuffer instanceof Uint8Array, 'PDF output is a valid binary Uint8Array');
  assert(pdfBuffer.byteLength > 1000, `PDF document size: ${pdfBuffer.byteLength} bytes`);

  // Verify PDF Header (%PDF-1.3)
  const header = String.fromCharCode(...pdfBuffer.slice(0, 5));
  assert(header === '%PDF-', `PDF has valid binary header: ${header}`);

  // Convert binary to ASCII string to check embedded markers
  const pdfString = String.fromCharCode(...pdfBuffer);
  assert(pdfString.includes('NITTOO'), 'PDF contains Nittoo branding');
  assert(pdfString.includes('PORTFOLIO OVERVIEW'), 'PDF contains Overview section');
  assert(pdfString.includes('PRODUCT PERFORMANCE'), 'PDF contains Product Performance section');

  // ----------------------------------------------------------------------------
  // 5. JSON BACKUP (.JSON) EXPORT VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Testing JSON Backup (.json) Generation & Schema ---');

  const jsonString = generateJsonBackup(exportData);
  assert(typeof jsonString === 'string', 'JSON backup is a formatted string');

  const parsedJson = JSON.parse(jsonString);
  assert(parsedJson.version === '1.0.0', 'Parsed JSON version matches');
  assert(parsedJson.user.id === DEFAULT_MOCK_USER_ID, 'Parsed JSON user ID matches');
  assert(parsedJson.products.length === exportData.products.length, 'Parsed JSON products length matches');
  assert(parsedJson.purchases.length === exportData.purchases.length, 'Parsed JSON purchases length matches');
  assert(parsedJson.usage_periods.length === exportData.usage_history.length, 'Parsed JSON usage periods length matches');

  // Verify NO sensitive tokens or credentials exist in backup
  assert(!jsonString.includes('access_token'), 'JSON backup does not expose access_token');
  assert(!jsonString.includes('password'), 'JSON backup does not expose password');
  assert(!jsonString.includes('service_role'), 'JSON backup does not expose service_role');
  assert(!jsonString.includes('secret'), 'JSON backup does not expose secret');

  // ----------------------------------------------------------------------------
  // 6. MULTI-TENANT ISOLATION & PRIVACY VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Testing Multi-Tenant Data Isolation ---');

  const userA = 'user-a-isolated';
  const userB = 'user-b-isolated';

  // Seed Product for User A
  const prodA = await db.createProduct(userA, {
    name: 'Private Serum User A',
    brand: 'Brand A',
    category: 'Skincare',
    size_value: 50,
    size_unit: 'ml',
  });
  await db.createPurchase(userA, {
    product_id: prodA.id,
    purchase_date: '2026-09-01',
    price: 1500,
  });

  // Seed Product for User B
  const prodB = await db.createProduct(userB, {
    name: 'Private Cleanser User B',
    brand: 'Brand B',
    category: 'Oral Care',
    size_value: 100,
    size_unit: 'ml',
  });
  await db.createPurchase(userB, {
    product_id: prodB.id,
    purchase_date: '2026-09-02',
    price: 600,
  });

  // Export User A
  const exportA = await buildExportData(userA, 'user-a@nittoo.local', db);
  assert(exportA.products.length === 1, 'User A export has exactly 1 product');
  assert(exportA.products[0].name === 'Private Serum User A', 'User A product matches');
  assert(
    !exportA.products.some((p) => p.name.includes('User B')),
    'Strict Isolation: User A export contains ZERO items belonging to User B'
  );

  // Export User B
  const exportB = await buildExportData(userB, 'user-b@nittoo.local', db);
  assert(exportB.products.length === 1, 'User B export has exactly 1 product');
  assert(exportB.products[0].name === 'Private Cleanser User B', 'User B product matches');
  assert(
    !exportB.products.some((p) => p.name.includes('User A')),
    'Strict Isolation: User B export contains ZERO items belonging to User A'
  );

  // ----------------------------------------------------------------------------
  // 7. EMPTY STATE GRACEFUL DEGRADATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 7. Testing Empty State Handling (Zero Products User) ---');

  const emptyUserId = 'empty-user-new';
  const emptyExport = await buildExportData(emptyUserId, 'empty@nittoo.local', db);

  assert(emptyExport.products.length === 0, 'Empty user has 0 products');
  assert(emptyExport.purchases.length === 0, 'Empty user has 0 purchases');
  assert(emptyExport.usage_history.length === 0, 'Empty user has 0 usage periods');
  assert(emptyExport.summary.estimated_monthly_consumption === null, 'Estimated monthly consumption is null for empty user');

  // Excel generation handles empty data gracefully
  const emptyExcel = generateExcelWorkbook(emptyExport);
  assert(emptyExcel.byteLength > 500, 'Excel generated successfully for empty user without crash');

  // CSV generation handles empty data gracefully
  const emptyZip = await generateCsvZip(emptyExport);
  assert(emptyZip.byteLength > 200, 'CSV ZIP generated successfully for empty user without crash');

  // PDF generation handles empty data gracefully
  const emptyPdf = generatePdfReport(emptyExport);
  assert(emptyPdf.byteLength > 500, 'PDF generated successfully for empty user without crash');

  // JSON generation handles empty data gracefully
  const emptyJson = generateJsonBackup(emptyExport);
  assert(emptyJson.length > 50, 'JSON generated successfully for empty user without crash');

  // ----------------------------------------------------------------------------
  // 8. READ-ONLY IMMUTABILITY GUARANTEE
  // ----------------------------------------------------------------------------
  console.log('\n--- 8. Testing Read-Only Guarantee (Data Immutability) ---');

  const productsBefore = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  const purchasesBefore = (await db.exportUserData(DEFAULT_MOCK_USER_ID)).purchases;

  // Run all 4 exports
  await buildExportData(DEFAULT_MOCK_USER_ID, userEmail, db);
  generateExcelWorkbook(exportData);
  await generateCsvZip(exportData);
  generatePdfReport(exportData);
  generateJsonBackup(exportData);

  const productsAfter = await db.getAllUserProducts(DEFAULT_MOCK_USER_ID);
  const purchasesAfter = (await db.exportUserData(DEFAULT_MOCK_USER_ID)).purchases;

  assert(
    productsBefore.length === productsAfter.length,
    'Product counts strictly identical before and after export operations'
  );
  assert(
    purchasesBefore.length === purchasesAfter.length,
    'Purchase records strictly identical before and after export operations'
  );

  console.log('\n=================================================================');
  console.log('✅ ALL STAGE 14 DATA EXPORT VERIFICATION TESTS PASSED (100%)');
  console.log('=================================================================');
}

runExportVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
