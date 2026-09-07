// ==============================================================================
// Nittoo Backup Validator
// Pure, deterministic validation of uploaded Nittoo JSON backups before mutation.
// Enforces schema versioning, relational integrity, size constraints, and zero-secret safety.
// ==============================================================================

import type { BackupValidationResult } from './types';
import type { NittooExportData } from '../export/types';

export const SUPPORTED_BACKUP_VERSION = '1.0.0';
export const MAX_BACKUP_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /access_token/i,
  /refresh_token/i,
  /service_role/i,
  /secret/i,
  /auth_token/i,
  /api_key/i,
];

function containsSensitiveData(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      if (pattern.test(key)) return true;
    }
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      if (containsSensitiveData(val)) return true;
    }
  }
  return false;
}

function isValidIsoDate(str: any): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  const timestamp = Date.parse(str);
  return !isNaN(timestamp);
}

export function validateBackupFile(
  fileContent: string,
  maxBytes: number = MAX_BACKUP_FILE_SIZE_BYTES
): BackupValidationResult {
  // 1. File Size Protection
  if (!fileContent || typeof fileContent !== 'string') {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'File content is empty or invalid.',
    };
  }

  const byteLength = new TextEncoder().encode(fileContent).length;
  if (byteLength > maxBytes) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: `File size (${(byteLength / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit (${(maxBytes / (1024 * 1024)).toFixed(0)}MB).`,
    };
  }

  // 2. Parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err: any) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Malformed JSON payload.',
    };
  }

  // 3. Root Object Structure
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Root element must be a valid JSON object.',
    };
  }

  // 4. Zero Secrets / Sensitive Payload Protection
  if (containsSensitiveData(parsed)) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Unauthorized security tokens or secrets detected in backup.',
    };
  }

  // 5. Versioning
  if (!parsed.version || typeof parsed.version !== 'string') {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Missing backup schema version.',
    };
  }

  if (parsed.version !== SUPPORTED_BACKUP_VERSION) {
    return {
      valid: false,
      error: "This Nittoo backup version isn't supported by this version of Nittoo.",
      details: `Backup version '${parsed.version}' is not supported. Supported version is ${SUPPORTED_BACKUP_VERSION}.`,
    };
  }

  // 6. Required Top-Level Objects/Arrays
  if (!parsed.products || !Array.isArray(parsed.products)) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Missing or invalid products array.',
    };
  }

  if (!parsed.purchases || !Array.isArray(parsed.purchases)) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Missing or invalid purchases array.',
    };
  }

  const usagePeriods = parsed.usage_periods || parsed.usage_history;
  if (!usagePeriods || !Array.isArray(usagePeriods)) {
    return {
      valid: false,
      error: "That file isn't a valid Nittoo backup.",
      details: 'Missing or invalid usage periods array.',
    };
  }

  // 7. Validate Products
  const productIds = new Set<string>();
  for (const p of parsed.products) {
    if (!p || typeof p !== 'object') {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Invalid product record.' };
    }
    if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Product missing valid ID.' };
    }
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Product missing valid name.' };
    }
    if (!p.category || typeof p.category !== 'string') {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Product missing category.' };
    }
    productIds.add(p.id);
  }

  // 8. Validate Purchases
  const purchaseIds = new Set<string>();
  for (const pu of parsed.purchases) {
    if (!pu || typeof pu !== 'object') {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Invalid purchase record.' };
    }
    if (!pu.id || typeof pu.id !== 'string' || !pu.id.trim()) {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Purchase missing valid ID.' };
    }
    if (!pu.product_id || typeof pu.product_id !== 'string' || !productIds.has(pu.product_id)) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Purchase ${pu.id} references non-existent product ${pu.product_id}.`,
      };
    }
    if (!isValidIsoDate(pu.purchase_date)) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Purchase ${pu.id} has invalid purchase_date: ${pu.purchase_date}.`,
      };
    }
    if (typeof pu.price !== 'number' || !isFinite(pu.price) || pu.price < 0) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Purchase ${pu.id} has invalid price: ${pu.price}.`,
      };
    }
    purchaseIds.add(pu.id);
  }

  // 9. Validate Usage Periods
  for (const u of usagePeriods) {
    if (!u || typeof u !== 'object') {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Invalid usage period record.' };
    }
    if (!u.id || typeof u.id !== 'string' || !u.id.trim()) {
      return { valid: false, error: "That file isn't a valid Nittoo backup.", details: 'Usage period missing valid ID.' };
    }
    if (!u.product_id || typeof u.product_id !== 'string' || !productIds.has(u.product_id)) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Usage period ${u.id} references non-existent product ${u.product_id}.`,
      };
    }
    if (!u.purchase_id || typeof u.purchase_id !== 'string' || !purchaseIds.has(u.purchase_id)) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Usage period ${u.id} references non-existent purchase ${u.purchase_id}.`,
      };
    }
    if (!isValidIsoDate(u.opened_date)) {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Usage period ${u.id} has invalid opened_date: ${u.opened_date}.`,
      };
    }
    const status = u.status;
    if (status !== 'active' && status !== 'completed' && status !== 'finished') {
      return {
        valid: false,
        error: "That file isn't a valid Nittoo backup.",
        details: `Usage period ${u.id} has invalid status: ${status}.`,
      };
    }
    if (u.finished_date) {
      if (!isValidIsoDate(u.finished_date)) {
        return {
          valid: false,
          error: "That file isn't a valid Nittoo backup.",
          details: `Usage period ${u.id} has invalid finished_date: ${u.finished_date}.`,
        };
      }
      if (new Date(u.finished_date) < new Date(u.opened_date)) {
        return {
          valid: false,
          error: "That file isn't a valid Nittoo backup.",
          details: `Usage period ${u.id} finished_date precedes opened_date.`,
        };
      }
    }
  }

  // 10. Extract metadata safely (treating user info strictly as metadata)
  const metadata = {
    exported_at: typeof parsed.exported_at === 'string' ? parsed.exported_at : new Date().toISOString(),
    version: parsed.version,
    original_email: parsed.user && typeof parsed.user.email === 'string' ? parsed.user.email : 'Unknown',
    original_user_id: parsed.user && typeof parsed.user.id === 'string' ? parsed.user.id : 'Unknown',
  };

  // Construct normalized export model for planner
  const normalizedBackupData: NittooExportData = {
    version: parsed.version,
    exported_at: metadata.exported_at,
    user: {
      id: metadata.original_user_id,
      email: metadata.original_email,
    },
    summary: parsed.summary || {
      total_products: parsed.products.length,
      total_purchases: parsed.purchases.length,
      active_essentials: 0,
      unopened_purchases: 0,
      completed_usage_cycles: 0,
      estimated_monthly_consumption: null,
      categories: [],
      category_breakdown: [],
    },
    products: parsed.products,
    purchases: parsed.purchases,
    usage_history: usagePeriods,
    inventory: parsed.inventory || [],
    analytics: parsed.analytics || [],
    insights: parsed.insights || [],
  };

  return {
    valid: true,
    backupData: normalizedBackupData,
    metadata,
  };
}
