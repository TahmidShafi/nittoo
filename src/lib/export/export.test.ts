// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../mock-db';
import { buildExportData } from './normalizer';
import { generateJsonBackup } from './json';
import { generateCsvZip } from './csv';
import { generateExcelWorkbook } from './excel';
import { generatePdfReport } from './pdf';
import { exportUserDataAs } from './index';

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

  afterEach(() => {
    vi.restoreAllMocks();
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
});
