// ==============================================================================
// Nittoo Excel (.xlsx) Exporter
// Primary / Recommended export format.
// Generates a professional, multi-sheet workbook with clean formatting,
// strict observed vs predicted labeling, and spreadsheet-native layout.
// ==============================================================================

import * as XLSX from 'xlsx';
import type { NittooExportData } from './types';

export function generateExcelWorkbook(data: NittooExportData): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------------------------------
  // 1. Summary Sheet
  // ----------------------------------------------------------------------------
  const summaryRows: (string | number | null)[][] = [
    ['NITTOO', ''],
    ['Know What Lasts.', ''],
    ['Export Date', data.exported_at.split('T')[0]],
    ['Account', data.user.email],
    ['', ''],
    ['PORTFOLIO SUMMARY', 'VALUE'],
    ['Total Essentials Tracked', data.summary.total_products],
    ['Total Recorded Purchases', data.summary.total_purchases],
    ['Active Essentials In Daily Use', data.summary.active_essentials],
    ['Unopened Backup Purchases', data.summary.unopened_purchases],
    ['Completed Usage Cycles', data.summary.completed_usage_cycles],
    [
      'Estimated Monthly Consumption',
      data.summary.estimated_monthly_consumption !== null
        ? `৳${data.summary.estimated_monthly_consumption} / month`
        : 'Not enough data',
    ],
    ['', ''],
    ['CATEGORY BREAKDOWN', 'ACTIVE COUNT', 'EST. MONTHLY (BDT)', '% OF SPEND'],
  ];

  if (data.summary.category_breakdown.length === 0) {
    summaryRows.push(['No categories tracked yet', 0, 0, '0%']);
  } else {
    for (const cat of data.summary.category_breakdown) {
      summaryRows.push([cat.category, cat.activeCount, cat.estimatedMonthlyCost, `${cat.percentage}%`]);
    }
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ----------------------------------------------------------------------------
  // 2. Products Sheet
  // ----------------------------------------------------------------------------
  const productRows: (string | number | null)[][] = [
    ['Product ID', 'Product Name', 'Brand', 'Category', 'Size', 'Unit', 'Created At'],
  ];

  for (const p of data.products) {
    productRows.push([
      p.id,
      p.name,
      p.brand || '',
      p.category,
      p.size ?? '',
      p.unit ?? '',
      p.created_at.split('T')[0],
    ]);
  }

  const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
  wsProducts['!cols'] = [
    { wch: 36 },
    { wch: 32 },
    { wch: 20 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // ----------------------------------------------------------------------------
  // 3. Purchases Sheet
  // ----------------------------------------------------------------------------
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
      pu.store_vendor || 'N/A',
    ]);
  }

  const wsPurchases = XLSX.utils.aoa_to_sheet(purchaseRows);
  wsPurchases['!cols'] = [
    { wch: 36 },
    { wch: 36 },
    { wch: 32 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');

  // ----------------------------------------------------------------------------
  // 4. Usage History Sheet (Strict distinction between completed & active)
  // ----------------------------------------------------------------------------
  const usageRows: (string | number | null)[][] = [
    [
      'Usage Period ID',
      'Product Name',
      'Purchase ID',
      'Opened Date',
      'Finished Date',
      'Status',
      'Days Used (Observed)',
      'Purchase Price',
      'Currency',
      'Cost / Day (Observed)',
    ],
  ];

  for (const u of data.usage_history) {
    usageRows.push([
      u.id,
      u.product_name,
      u.purchase_id,
      u.opened_date,
      u.finished_date || 'In Active Use',
      u.status === 'completed' ? 'Completed Cycle' : 'Currently Active',
      u.days_used,
      u.purchase_price,
      u.currency,
      u.cost_per_day !== null ? u.cost_per_day : 'Active / In-flight',
    ]);
  }

  const wsUsage = XLSX.utils.aoa_to_sheet(usageRows);
  wsUsage['!cols'] = [
    { wch: 36 },
    { wch: 32 },
    { wch: 36 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsUsage, 'Usage History');

  // ----------------------------------------------------------------------------
  // 5. Inventory Sheet (Active vs Unopened)
  // ----------------------------------------------------------------------------
  const inventoryRows: (string | number | null)[][] = [
    [
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
      'Unopened Backups',
    ],
  ];

  for (const inv of data.inventory) {
    inventoryRows.push([
      inv.product_name,
      inv.brand,
      inv.category,
      inv.inventory_status,
      inv.purchase_date,
      inv.price,
      inv.currency,
      inv.opened_date || 'N/A (Unopened)',
      inv.days_used !== null ? inv.days_used : 'N/A',
      inv.predicted_remaining_days !== null ? inv.predicted_remaining_days : 'No prediction yet',
      inv.backup_count,
    ]);
  }

  const wsInventory = XLSX.utils.aoa_to_sheet(inventoryRows);
  wsInventory['!cols'] = [
    { wch: 32 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventory');

  // ----------------------------------------------------------------------------
  // 6. Analytics Sheet (Observed vs Predicted vs Estimated)
  // ----------------------------------------------------------------------------
  const analyticsRows: (string | number | null)[][] = [
    [
      'Product Name',
      'Brand',
      'Category',
      'Observed Average Lifespan (Days)',
      'Completed Cycles',
      'Observed Cost / Day (BDT)',
      'Estimated Monthly Consumption (BDT)',
      'Predicted Run-Out Date',
      'Predicted Remaining Days',
      'Prediction Confidence Level',
    ],
  ];

  for (const an of data.analytics) {
    analyticsRows.push([
      an.product_name,
      an.brand,
      an.category,
      an.observed_average_lifespan !== null ? an.observed_average_lifespan : 'Not enough data',
      an.completed_cycles,
      an.observed_cost_per_day !== null ? an.observed_cost_per_day : 'Not enough data',
      an.estimated_monthly_consumption !== null ? an.estimated_monthly_consumption : 'N/A',
      an.predicted_finish_date || 'N/A',
      an.predicted_remaining_days !== null ? an.predicted_remaining_days : 'N/A',
      an.confidence_label,
    ]);
  }

  const wsAnalytics = XLSX.utils.aoa_to_sheet(analyticsRows);
  wsAnalytics['!cols'] = [
    { wch: 32 },
    { wch: 20 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 24 },
    { wch: 32 },
    { wch: 22 },
    { wch: 24 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Analytics');

  // Generate binary output buffer
  const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(raw);
}
