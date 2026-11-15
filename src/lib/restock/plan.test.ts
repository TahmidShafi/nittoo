import { describe, it, expect } from 'vitest';
import {
  calculateExpectedFinishDate,
  calculateRelativeReminderDate,
  isReminderDue,
  getRestockDisplayStatus,
  recalculatePlanReminderDate,
  getRelativeOptionLabel,
  getRestockStatusInfo,
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

  it.each([
    [null, ''],
    [0, 'On expected finish'],
    [7, '7 days before'],
  ] as const)('formats relative option label for %s -> %s', (days, expected) => {
    expect(getRelativeOptionLabel(days)).toBe(expected);
  });

  it('formats restock status display info for each status and mode', () => {
    expect(getRestockStatusInfo('due').label).toBe('Restock Due');
    expect(getRestockStatusInfo('planned', '2026-10-17', 7, 'relative').description).toContain(
      '7 days before'
    );
    expect(getRestockStatusInfo('planned', '2026-10-17', null, 'custom').description).toContain(
      '2026-10-17'
    );
    expect(getRestockStatusInfo('completed').label).toBe('Restock Completed');
    expect(getRestockStatusInfo('dismissed').label).toBe('Restock Dismissed');
    expect(getRestockStatusInfo('inactive').label).toBe('No Restock Plan');
  });

  it.each([
    ['2026-10-16', 'active', 'planned', 'planned', false],
    ['2026-10-17', 'active', 'planned', 'due', true],
    ['2026-10-20', 'active', 'planned', 'due', true],
    ['2026-10-17', 'active', 'completed', 'completed', false],
    ['2026-10-17', 'active', 'dismissed', 'dismissed', false],
    ['2026-10-17', 'finished', 'planned', 'inactive', false],
  ] as const)(
    'evaluates display status & due state on %s (%s, %s) -> %s',
    (refDate, usageStatus, planStatus, expectedDisplay, expectedDue) => {
      const plan: RestockPlan = {
        id: 'rp',
        user_id: 'u1',
        product_id: 'p1',
        usage_period_id: 'up1',
        mode: 'relative',
        days_before_finish: 7,
        reminder_date: '2026-10-17',
        status: planStatus,
        created_at: '2026-09-01T00:00:00Z',
        completed_at: null,
      };
      expect(getRestockDisplayStatus(plan, usageStatus, refDate)).toBe(expectedDisplay);
      if (planStatus === 'planned' && usageStatus === 'active') {
        expect(isReminderDue(plan.reminder_date, refDate)).toBe(expectedDue);
      }
    }
  );

  it('rejects restock plan on finished usage period and supports complete/dismiss/delete', async () => {
    const db = new MockDatabase(new InMemoryStorageAdapter());
    const active = await db.getActiveProducts(DEFAULT_MOCK_USER_ID);
    const cerave = active.find((p) => p.name.includes('CeraVe'))!;

    const plan = await db.createRestockPlan(DEFAULT_MOCK_USER_ID, {
      product_id: cerave.id,
      usage_period_id: cerave.active_usage!.id,
      mode: 'relative',
      days_before_finish: 7,
      reminder_date: '2026-10-17',
    });
    expect((await db.getRestockPlanForUsagePeriod(DEFAULT_MOCK_USER_ID, cerave.active_usage!.id))?.id).toBe(
      plan.id
    );

    const dismissed = await db.dismissRestockPlan(DEFAULT_MOCK_USER_ID, plan.id);
    expect(dismissed.status).toBe('dismissed');

    await db.deleteRestockPlan(DEFAULT_MOCK_USER_ID, plan.id);
    expect(await db.getRestockPlanForUsagePeriod(DEFAULT_MOCK_USER_ID, cerave.active_usage!.id)).toBeNull();

    // Cannot attach to finished period
    const finishedId = cerave.finished_periods![0].id;
    await expect(
      db.createRestockPlan(DEFAULT_MOCK_USER_ID, {
        product_id: cerave.id,
        usage_period_id: finishedId,
        mode: 'custom',
        days_before_finish: null,
        reminder_date: '2026-11-01',
      })
    ).rejects.toThrow(/active/i);
  });
});
