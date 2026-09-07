// ==============================================================================
// Nittoo JSON Backup Exporter
// Generates a complete, structured machine-readable backup of user data.
// Designed for technical portability, backup, and future import compatibility.
// ==============================================================================

import type { NittooExportData } from './types';

export function generateJsonBackup(data: NittooExportData): string {
  // Ensure no sensitive or internal tokens are accidentally included
  const sanitizedBackup = {
    version: data.version,
    exported_at: data.exported_at,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    summary: data.summary,
    products: data.products,
    purchases: data.purchases,
    usage_periods: data.usage_history,
    inventory: data.inventory,
    analytics: data.analytics,
    insights: data.insights,
  };

  return JSON.stringify(sanitizedBackup, null, 2);
}
