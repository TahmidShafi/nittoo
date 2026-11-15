import { describe, it, expect } from 'vitest';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../mock-db';
import { buildExportData } from './normalizer';
import { generateJsonBackup } from './json';
import { generateCsvZip } from './csv';
import { generateExcelWorkbook } from './excel';
import { generatePdfReport } from './pdf';

describe('export', () => {
  it('builds normalized export data and generates valid JSON, CSV ZIP, Excel, and PDF outputs', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const data = await buildExportData(DEFAULT_MOCK_USER_ID, 'demo@nittoo.local', db);

    expect(data.products.length).toBe(3);
    expect(data.purchases.length).toBeGreaterThan(0);
    expect(data.usage_history.length).toBeGreaterThan(0);
    expect(Array.isArray(data.restock_plans)).toBe(true);

    const json = generateJsonBackup(data);
    const parsed = JSON.parse(json);
    expect(parsed.products).toHaveLength(3);

    const csvZip = await generateCsvZip(data);
    expect(csvZip.byteLength).toBeGreaterThan(100);

    const xlsxBytes = generateExcelWorkbook(data);
    expect(xlsxBytes.byteLength).toBeGreaterThan(1000);

    const pdfBytes = generatePdfReport(data);
    expect(pdfBytes.byteLength).toBeGreaterThan(500);
  });
});
