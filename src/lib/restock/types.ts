// ==============================================================================
// Nittoo Restock Planning Types (Stage 21)
// Relative timing options, display statuses, and option interfaces.
// ==============================================================================

import type { RestockPlan, RestockPlanMode, RestockPlanStatus } from '../../types';

export const RELATIVE_REMINDER_OPTIONS = [30, 21, 14, 7, 0] as const;
export type RelativeReminderDays = (typeof RELATIVE_REMINDER_OPTIONS)[number];

export type RestockDisplayStatus = 'planned' | 'due' | 'completed' | 'dismissed' | 'inactive';

export interface RestockStatusInfo {
  status: RestockDisplayStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
}

export type { RestockPlan, RestockPlanMode, RestockPlanStatus };
