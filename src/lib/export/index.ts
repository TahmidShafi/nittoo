// ==============================================================================
// Nittoo Export Engine Entry Point
// Coordinates unified data normalization and triggers format-specific file generation.
// ==============================================================================

import type { IDataSource } from '../../types';
import type { ExportFormat, NittooExportData } from './types';
import { buildExportData } from './normalizer';
import { generateExcelWorkbook } from './excel';
import { generateCsvZip } from './csv';
import { generatePdfReport } from './pdf';
import { generateJsonBackup } from './json';

export * from './types';
export * from './normalizer';
export * from './excel';
export * from './csv';
export * from './pdf';
export * from './json';

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportUserDataAs(
  format: ExportFormat,
  userId: string,
  userEmail: string,
  dataSource: IDataSource
): Promise<{ filename: string; data: NittooExportData }> {
  // 1. Build unified normalized export data
  const exportData = await buildExportData(userId, userEmail, dataSource);

  // 2. Format file timestamp (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  let blob: Blob;
  let filename: string;

  switch (format) {
    case 'excel': {
      filename = `nittoo-data-export-${today}.xlsx`;
      const buffer = generateExcelWorkbook(exportData);
      blob = new Blob([buffer as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      break;
    }

    case 'csv': {
      filename = `nittoo-data-export-${today}.zip`;
      const buffer = await generateCsvZip(exportData);
      blob = new Blob([buffer as unknown as BlobPart], {
        type: 'application/zip',
      });
      break;
    }

    case 'pdf': {
      filename = `nittoo-consumption-report-${today}.pdf`;
      const buffer = generatePdfReport(exportData);
      blob = new Blob([buffer as unknown as BlobPart], {
        type: 'application/pdf',
      });
      break;
    }

    case 'json': {
      filename = `nittoo-data-backup-${today}.json`;
      const jsonString = generateJsonBackup(exportData);
      blob = new Blob([jsonString], {
        type: 'application/json;charset=utf-8;',
      });
      break;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // 3. Trigger client-side browser download
  triggerBrowserDownload(blob, filename);

  return { filename, data: exportData };
}
