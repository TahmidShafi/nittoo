// ==============================================================================
// Nittoo Restore Executor
// Safely executes a confirmed ImportPlan against the configured IDataSource.
// Guarantees strictly current-user ownership and relational integrity.
// ==============================================================================

import type { IDataSource, ImportUserDataInput, ImportExecutionResult } from '../../types';
import type { ImportPlan } from './types';

export async function executeRestore(
  plan: ImportPlan,
  currentUserId: string,
  dataSource: IDataSource
): Promise<ImportExecutionResult> {
  if (!currentUserId) {
    throw new Error('Current user authentication is required for restore.');
  }

  const input: ImportUserDataInput = {
    products: plan.productsToCreate,
    purchases: plan.purchasesToCreate,
    usage_periods: plan.usageToCreate,
  };

  try {
    const result = await dataSource.importUserData(currentUserId, input);
    return result;
  } catch (err: any) {
    return {
      success: false,
      restoredProducts: 0,
      restoredPurchases: 0,
      restoredCycles: 0,
      restoredUnopened: 0,
      skippedConflicts: plan.activeConflicts.length,
      error: err?.message || 'Failed to restore backup data.',
    };
  }
}
