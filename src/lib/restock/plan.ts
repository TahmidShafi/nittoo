// ==============================================================================
// Nittoo Restock Planning Calculation Engine (Stage 21)
// Pure, deterministic calculations for expected finish, relative reminder dates,
// custom date validation, and reminder due states.
// Never fabricates predictions or alters existing prediction formulas.
// ==============================================================================

import { addDays, getTodayUTC, parseISODateToUTC } from '../dateUtils';
import type { RestockPlan } from '../../types';
import type { RestockDisplayStatus, RestockStatusInfo } from './types';

/**
 * Calculates deterministic expected finish date for an active usage period
 * based on its opened date and historical average lifespan.
 * Returns null if averageLifespan is null or <= 0 (e.g. 0 completed cycles).
 */
export function calculateExpectedFinishDate(
  openedDate: string,
  averageLifespan: number | null
): string | null {
  if (averageLifespan === null || averageLifespan <= 0 || !openedDate) {
    return null;
  }
  return addDays(openedDate, Math.round(averageLifespan));
}

/**
 * Calculates a relative reminder date:
 * reminderDate = expectedFinishDate - daysBefore
 * e.g. 14 days before Jan 5 -> Dec 22
 */
export function calculateRelativeReminderDate(
  expectedFinishDate: string,
  daysBefore: number
): string {
  if (!expectedFinishDate) {
    throw new Error('Expected finish date is required to calculate relative reminder date.');
  }
  if (daysBefore < 0) {
    throw new Error('daysBefore must be non-negative.');
  }
  return addDays(expectedFinishDate, -daysBefore);
}

/**
 * Validates whether a string is a valid ISO calendar date (YYYY-MM-DD).
 * Accurately detects non-existent calendar days (e.g. Feb 30, April 31, non-leap year Feb 29).
 */
export function isValidISODate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  try {
    const timestamp = parseISODateToUTC(dateStr);
    const date = new Date(timestamp);
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether a reminder date has arrived or passed relative to a reference date (default: today UTC).
 */
export function isReminderDue(
  reminderDate: string,
  referenceDate: string = getTodayUTC()
): boolean {
  if (!reminderDate || !referenceDate) return false;
  return reminderDate <= referenceDate;
}

/**
 * Derives the active display status of a restock plan.
 * If usage period is finished, the plan is marked 'inactive'.
 */
export function getRestockDisplayStatus(
  plan: RestockPlan | null | undefined,
  usagePeriodStatus?: 'active' | 'finished',
  referenceDate: string = getTodayUTC()
): RestockDisplayStatus {
  if (!plan) return 'inactive';
  if (usagePeriodStatus === 'finished') return 'inactive';
  if (plan.status === 'completed') return 'completed';
  if (plan.status === 'dismissed') return 'dismissed';
  if (plan.status === 'planned') {
    return isReminderDue(plan.reminder_date, referenceDate) ? 'due' : 'planned';
  }
  return 'inactive';
}

/**
 * Returns human-readable label for relative reminder options.
 */
export function getRelativeOptionLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'On expected finish';
  return `${days} days before`;
}

/**
 * Recalculates relative reminder date if historical prediction changes.
 * Custom reminder dates are STRICTLY PRESERVED and never moved.
 */
export function recalculatePlanReminderDate(
  plan: RestockPlan,
  newExpectedFinishDate: string | null
): RestockPlan {
  // Custom date never moves when prediction changes
  if (plan.mode !== 'relative') {
    return plan;
  }

  // If relative mode and new expected finish exists, recompute deterministically
  if (
    newExpectedFinishDate &&
    plan.days_before_finish !== null &&
    plan.days_before_finish !== undefined
  ) {
    const newReminderDate = calculateRelativeReminderDate(
      newExpectedFinishDate,
      plan.days_before_finish
    );
    return {
      ...plan,
      reminder_date: newReminderDate,
    };
  }

  return plan;
}

/**
 * Returns calm, semantic visual styling and labels for restock states.
 */
export function getRestockStatusInfo(
  status: RestockDisplayStatus,
  reminderDate?: string,
  daysBefore?: number | null,
  mode?: 'relative' | 'custom'
): RestockStatusInfo {
  switch (status) {
    case 'due':
      return {
        status: 'due',
        label: 'Restock Due',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
        dotClass: 'bg-amber-500',
        description: 'Reminder date is today or has passed.',
      };
    case 'planned':
      return {
        status: 'planned',
        label: 'Restock Planned',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
        dotClass: 'bg-emerald-500',
        description:
          mode === 'relative' && daysBefore !== undefined && daysBefore !== null
            ? `${getRelativeOptionLabel(daysBefore)} estimated finish`
            : `Reminder scheduled for ${reminderDate || ''}`,
      };
    case 'completed':
      return {
        status: 'completed',
        label: 'Restock Completed',
        badgeClass: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20',
        dotClass: 'bg-neutral-400',
        description: 'User marked restock as complete.',
      };
    case 'dismissed':
      return {
        status: 'dismissed',
        label: 'Restock Dismissed',
        badgeClass: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-500 border border-neutral-500/20',
        dotClass: 'bg-neutral-400',
        description: 'Reminder dismissed by user.',
      };
    case 'inactive':
    default:
      return {
        status: 'inactive',
        label: 'No Restock Plan',
        badgeClass: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
        dotClass: 'bg-neutral-300',
        description: 'No active restock plan set.',
      };
  }
}
