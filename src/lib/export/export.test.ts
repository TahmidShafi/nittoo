// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../mock-db';
import { buildExportData } from './normalizer';
import { generateJsonBackup } from './json';
import { generateCsvZip } from './csv';
import { generateExcelWorkbook } from './excel';
import { generatePdfReport } from './pdf';
import { exportUserDataAs } from './index';

describe('export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds normalized export data with schema version, summary, and category breakdown', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);

    expect(data.version).toBe('1.1.0');
    expect(data.user.email).toBe('demo@nittoo.local');
    expect(data.products.length).toBe(3);
    expect(data.purchases.length).toBeGreaterThan(0);
    expect(data.usage_history.length).toBeGreaterThan(0);
    expect(data.summary.total_products).toBe(3);
    expect(data.summary.category_breakdown.length).toBeGreaterThan(0);
    expect(Array.isArray(data.restock_plans)).toBe(true);
  });

  it('generates valid JSON backup preserving schema version and products', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
    const parsed = JSON.parse(generateJsonBackup(data));

    expect(parsed.version).toBe('1.1.0');
    expect(parsed.products).toHaveLength(3);
    expect(parsed.summary.total_products).toBe(3);
  });

  it('generates Excel workbook (.xlsx) with expected worksheets and brand/header rows', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
    const xlsxBytes = generateExcelWorkbook(data);
    const wb = XLSX.read(xlsxBytes, { type: 'array' });

    expect(xlsxBytes.byteLength).toBeGreaterThan(1000);
    expect(wb.SheetNames).toEqual(
      expect.arrayContaining(['Summary', 'Products', 'Purchases', 'Usage History', 'Analytics'])
    );
    const summaryRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Summary'], { header: 1 });
    expect(summaryRows[0][0]).toBe('NITTOO');
    expect(summaryRows[1][0]).toBe('Know What Lasts.');

    const productRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Products'], { header: 1 });
    expect(productRows[0][0]).toBe('Product ID');
    expect(productRows[0][1]).toBe('Product Name');
    expect(productRows.length).toBeGreaterThanOrEqual(4);
  });

  it('generates CSV ZIP archive containing all 7 CSV files', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
    const csvZip = await generateCsvZip(data);
    const zip = await JSZip.loadAsync(csvZip);

    expect(csvZip.byteLength).toBeGreaterThan(100);
    for (const file of [
      'summary.csv',
      'products.csv',
      'purchases.csv',
      'usage-history.csv',
      'inventory.csv',
      'analytics.csv',
      'restock-plans.csv',
    ]) {
      expect(zip.file(file)).not.toBeNull();
    }
    const productsCsv = await zip.file('products.csv')!.async('string');
    expect(productsCsv).toContain('Product ID');
  });

  it('generates a valid PDF report with %PDF- header', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
    const pdfBytes = generatePdfReport(data);
    const header = new TextDecoder().decode(pdfBytes.slice(0, 5));

    expect(pdfBytes.byteLength).toBeGreaterThan(500);
    expect(header).toBe('%PDF-');
  });

  it('exports all 4 formats via exportUserDataAs and triggers browser download', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    for (const fmt of ['excel', 'csv', 'json', 'pdf'] as const) {
      const res = await exportUserDataAs(fmt, DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
      expect(res.filename).toContain('nittoo-');
      expect(res.data.products).toHaveLength(3);
    }
    expect(URL.createObjectURL).toHaveBeenCalledTimes(4);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
  });

  it('includes raw purchase size in JSON and effective size + Size Override in CSV/Excel', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const prod = await db.createProduct(DEFAULT_MOCK_USER_ID, {
      name: 'Refill Cleanser',
      category: 'Skincare',
      brand: 'CeraVe',
      size_value: 236,
      size_unit: 'ml',
    });
    await db.createPurchase(DEFAULT_MOCK_USER_ID, {
      product_id: prod.id,
      purchase_date: '2026-09-01',
      price: 2950,
      size_value: 473,
      size_unit: 'ml',
    });

    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);
    const jsonParsed = JSON.parse(generateJsonBackup(data));
    const overrideJson = jsonParsed.purchases.find((p: { product_id: string }) => p.product_id === prod.id);
    expect(overrideJson.size_value).toBe(473);
    expect(overrideJson.size_unit).toBe('ml');

    const zipBytes = await generateCsvZip(data);
    const zip = await JSZip.loadAsync(zipBytes);
    const purchasesCsv = await zip.file('purchases.csv')!.async('string');
    expect(purchasesCsv).toContain('Pack Size,Unit,Size Override');
    expect(purchasesCsv).toContain('473,ml,Yes');

    const xlsxBytes = await generateExcelWorkbook(data);
    const wb = XLSX.read(xlsxBytes, { type: 'array' });
    const purchaseRows = XLSX.utils.sheet_to_json(wb.Sheets['Purchases'], { header: 1 }) as unknown[][];
    expect(purchaseRows[0]).toEqual(expect.arrayContaining(['Pack Size', 'Unit', 'Size Override']));
    expect(purchaseRows.some((r) => r.includes(473) && r.includes('ml') && r.includes('Yes'))).toBe(true);
  });
});
