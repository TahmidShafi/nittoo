// ==============================================================================
// Nittoo Data Restore Types
// Types for validation, planning, conflict detection, preview, and execution.
// ==============================================================================

import type { NittooExportData } from '../export/types';
import type { ImportExecutionResult } from '../../types';

export interface BackupValidationSuccess {
  valid: true;
  backupData: NittooExportData;
  metadata: {
    exported_at: string;
    version: string;
    original_email: string;
    original_user_id: string;
  };
}

export interface BackupValidationFailure {
  valid: false;
  error: string;
  details?: string;
}

export type BackupValidationResult = BackupValidationSuccess | BackupValidationFailure;

export interface ActiveUsageConflict {
  productName: string;
  backupProductId: string;
  backupUsageId: string;
  action: 'keep_current_active';
  description: string;
}

export interface PossibleProductMatch {
  backupProductId: string;
  productName: string;
  existingProductId: string;
  action: 'preserve_separate';
}

export interface ImportPlanSummary {
  newProductsCount: number;
  existingProductsCount: number;
  newPurchasesCount: number;
  existingPurchasesCount: number;
  historicalCyclesCount: number;
  activeUsageCount: number;
  unopenedPurchasesCount: number;
  activeConflictsCount: number;
  estimatedMonthlyConsumption: number | null;
  invalidRecordsCount: number;
}

export interface ImportPlan {
  isValid: boolean;
  backupMeta: {
    exported_at: string;
    version: string;
    original_email: string;
  };
  summary: ImportPlanSummary;
  productsToCreate: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    size: number | null;
    unit: string | null;
    created_at?: string;
  }[];
  purchasesToCreate: {
    id: string;
    product_id: string;
    purchase_date: string;
    price: number;
    currency: string;
    store_vendor: string | null;
    created_at?: string;
  }[];
  usageToCreate: {
    id: string;
    product_id: string;
    purchase_id: string;
    opened_date: string;
    finished_date: string | null;
    status: 'active' | 'finished';
    created_at?: string;
  }[];
  activeConflicts: ActiveUsageConflict[];
  possibleProductMatches: PossibleProductMatch[];
  warnings: string[];
}

export type { ImportExecutionResult };
