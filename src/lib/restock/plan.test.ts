import { describe, it, expect } from 'vitest';
import {
  calculateExpectedFinishDate,
  calculateRelativeReminderDate,
  isReminderDue,
  getRestockDisplayStatus,
  recalculatePlanReminderDate,
} from './plan';
import { MockDatabase, InMemoryStorageAdapter, DEFAULT_MOCK_USER_ID } from '../mock-db';
import type { RestockPlan } from '../../types';

describe('restock/plan', () => {
  it('computes relative reminder dates across month and leap-year boundaries', () => {
    expect(calculateExpectedFinishDate('2026-09-01', 60)).toBe('2026-10-31');
    expect(calculateExpectedFinishDate('2026-09-01', null)).toBeNull();

    expect(calculateRelativeReminderDate('2026-10-31', 14)).toBe('2026-10-17');
    expect(calculateRelativeReminderDate('2026-01-05', 14)).toBe('2025-12-22');
    expect(calculateRelativeReminderDate('2024-03-05', 14)).toBe('2024-02-20');
  });

  it('evaluates due state, display status, and relative recalculation', () => {
    const plan: RestockPlan = {
      id: 'rp1',
      user_id: 'u1',
      product_id: 'p1',
      usage_period_id: 'up1',
      mode: 'relative',
      days_before_finish: 14,
      reminder_date: '2026-10-17',
      status: 'planned',
      created_at: '2026-09-01T00:00:00Z',
      completed_at: null,
    };

    expect(isReminderDue(plan.reminder_date, '2026-10-16')).toBe(false);
    expect(isReminderDue(plan.reminder_date, '2026-10-17')).toBe(true);
    expect(getRestockDisplayStatus(plan, 'active', '2026-10-17')).toBe('due');
    expect(getRestockDisplayStatus(plan, 'finished', '2026-10-17')).toBe('inactive');

    const recomputed = recalculatePlanReminderDate(plan, '2026-11-15');
    expect(recomputed.reminder_date).toBe('2026-11-01');

    const customPlan: RestockPlan = { ...plan, mode: 'custom', days_before_finish: null };
    expect(recalculatePlanReminderDate(customPlan, '2026-11-15').reminder_date).toBe('2026-10-17');
  });

  it('manages restock plan lifecycle and user isolation in MockDatabase', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const active = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);
    const cerave = active.find((p) => p.name.includes('CeraVe'))!;

    const created = await db.createRestockPlan(DEFAULT_MOCK_USER_ID, {
      product_id: cerave.id,
      usage_period_id: cerave.active_usage!.id,
      mode: 'relative',
      days_before_finish: 14,
      reminder_date: '2026-10-17',
    });
    expect(created.status).toBe('planned');

    // Duplicate create updates existing active plan instead of inserting a second row
    const updated = await db.createRestockPlan(DEFAULT_MOCK_USER_ID, {
      product_id: cerave.id,
      usage_period_id: cerave.active_usage!.id,
      mode: 'custom',
      days_before_finish: null,
      reminder_date: '2026-10-20',
    });
    expect(updated.id).toBe(created.id);
    expect(updated.reminder_date).toBe('2026-10-20');

    // Other user cannot see or mutate the plan
    const otherPlans = await db.getRestockPlans('other-user');
    expect(otherPlans).toHaveLength(0);

    // Finishing usage period auto-completes associated restock plan
    await db.finishUsagePeriod(DEFAULT_MOCK_USER_ID, cerave.active_usage!.id, '2026-10-25');
    const plansAfterFinish = await db.getRestockPlans(DEFAULT_MOCK_USER_ID);
    expect(plansAfterFinish.find((p) => p.id === created.id)?.status).toBe('completed');
  });
});
