// ==============================================================================
// Nittoo CSV Exporter
// Generates portable UTF-8 CSV datasets packaged inside a structured ZIP archive.
// RFC 4180 compliant with UTF-8 BOM for universal spreadsheet and text editor support.
// ==============================================================================

import JSZip from 'jszip';
import type { NittooExportData } from './types';

/**
 * Escapes an individual cell value according to RFC 4180 rules.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a 2D array of rows into a UTF-8 CSV string with BOM.
 */
export function rowsToCsv(rows: (string | number | null | undefined)[][]): string {
  const BOM = '\uFEFF';
  const body = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return BOM + body;
}

export async function generateCsvZip(data: NittooExportData): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. summary.csv
  const summaryRows: (string | number | null)[][] = [
    ['Metric', 'Value'],
    ['Nittoo Export Version', data.version],
    ['Export Date', data.exported_at],
    ['Account ID', data.user.id],
    ['Account Email', data.user.email],
    ['Total Essentials', data.summary.total_products],
    ['Total Purchases', data.summary.total_purchases],
    ['Active Essentials', data.summary.active_essentials],
    ['Unopened Purchases', data.summary.unopened_purchases],
    ['Completed Usage Cycles', data.summary.completed_usage_cycles],
    [
      'Estimated Monthly Consumption (BDT)',
      data.summary.estimated_monthly_consumption !== null
        ? data.summary.estimated_monthly_consumption
        : 'Not enough data',
    ],
  ];

  if (data.summary.category_breakdown.length > 0) {
    summaryRows.push(['', '']);
    summaryRows.push(['Category', 'Active Count', 'Estimated Monthly Cost (BDT)', 'Percentage of Run Rate']);
    for (const cat of data.summary.category_breakdown) {
      summaryRows.push([cat.category, cat.activeCount, cat.estimatedMonthlyCost, `${cat.percentage}%`]);
    }
  }

  zip.file('summary.csv', rowsToCsv(summaryRows));

  // 2. products.csv
  const productRows: (string | number | null)[][] = [
    ['Product ID', 'Product Name', 'Brand', 'Category', 'Size', 'Unit', 'Created At'],
  ];
  for (const p of data.products) {
    productRows.push([p.id, p.name, p.brand, p.category, p.size, p.unit, p.created_at]);
  }
  zip.file('products.csv', rowsToCsv(productRows));

  // 3. purchases.csv
  const purchaseRows: (string | number | null)[][] = [
    [
      'Purchase ID',
      'Product ID',
      'Product Name',
      'Brand',
      'Category',
      'Purchase Date',
      'Price',
      'Currency',
      'Store / Vendor',
    ],
  ];
  for (const pu of data.purchases) {
    purchaseRows.push([
      pu.id,
      pu.product_id,
      pu.product_name,
      pu.brand,
      pu.category,
      pu.purchase_date,
      pu.price,
      pu.currency,
      pu.store_vendor,
    ]);
  }
  zip.file('purchases.csv', rowsToCsv(purchaseRows));

  // 4. usage-history.csv
  const usageRows: (string | number | null)[][] = [
    [
      'Usage Period ID',
      'Product ID',
      'Product Name',
      'Purchase ID',
      'Opened Date',
      'Finished Date',
      'Status',
      'Days Used',
      'Purchase Price',
      'Currency',
      'Cost / Day (Observed)',
    ],
  ];
  for (const u of data.usage_history) {
    usageRows.push([
      u.id,
      u.product_id,
      u.product_name,
      u.purchase_id,
      u.opened_date,
      u.finished_date,
      u.status,
      u.days_used,
      u.purchase_price,
      u.currency,
      u.cost_per_day,
    ]);
  }
  zip.file('usage-history.csv', rowsToCsv(usageRows));

  // 5. inventory.csv
  const inventoryRows: (string | number | null)[][] = [
    [
      'Product ID',
      'Product Name',
      'Brand',
      'Category',
      'Inventory Status',
      'Purchase Date',
      'Price',
      'Currency',
      'Opened Date',
      'Days Used',
      'Predicted Remaining Days',
      'Backup Count',
    ],
  ];
  for (const inv of data.inventory) {
    inventoryRows.push([
      inv.product_id,
      inv.product_name,
      inv.brand,
      inv.category,
      inv.inventory_status,
      inv.purchase_date,
      inv.price,
      inv.currency,
      inv.opened_date,
      inv.days_used,
      inv.predicted_remaining_days,
      inv.backup_count,
    ]);
  }
  zip.file('inventory.csv', rowsToCsv(inventoryRows));

  // 6. analytics.csv
  const analyticsRows: (string | number | null)[][] = [
    [
      'Product ID',
      'Product Name',
      'Brand',
      'Category',
      'Observed Average Lifespan (Days)',
      'Completed Cycles',
      'Observed Cost / Day (BDT)',
      'Estimated Monthly Consumption (BDT)',
      'Predicted Finish Date',
      'Predicted Remaining Days',
      'Prediction Confidence State',
      'Prediction Confidence Label',
    ],
  ];
  for (const an of data.analytics) {
    analyticsRows.push([
      an.product_id,
      an.product_name,
      an.brand,
      an.category,
      an.observed_average_lifespan,
      an.completed_cycles,
      an.observed_cost_per_day,
      an.estimated_monthly_consumption,
      an.predicted_finish_date,
      an.predicted_remaining_days,
      an.confidence_state,
      an.confidence_label,
    ]);
  }
  zip.file('analytics.csv', rowsToCsv(analyticsRows));

  const zipBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return zipBuffer;
}
