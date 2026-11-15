import { describe, it, expect } from 'vitest';
import {
  getTodayUTC,
  getTodayLocal,
  getDaysBetween,
  addDays,
  getDaysUsed,
  parseISODateToUTC,
} from './dateUtils';

describe('dateUtils', () => {
  it('parses valid ISO YYYY-MM-DD dates and rejects malformed strings', () => {
    expect(parseISODateToUTC('2026-09-01')).toBe(Date.UTC(2026, 8, 1));
    expect(() => parseISODateToUTC('invalid')).toThrow();
  });

  it('computes pure calendar-date differences in days', () => {
    expect(getDaysBetween('2026-09-01', '2026-09-10')).toBe(9);
    expect(getDaysBetween('2026-09-10', '2026-09-01')).toBe(-9);
    expect(getDaysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(getDaysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('adds and subtracts days across month, year, and leap-year boundaries', () => {
    expect(addDays('2026-10-31', -14)).toBe('2026-10-17');
    expect(addDays('2026-01-05', -14)).toBe('2025-12-22');
    expect(addDays('2024-03-05', -14)).toBe('2024-02-20');
    expect(addDays('2026-09-01', 30)).toBe('2026-10-01');
  });

  it('uses local calendar date in Asia/Dhaka at 02:00 AM (20:00Z prev day)', () => {
    const dhaka2am = new Date('2026-11-14T20:00:00.000Z');
    expect(getTodayLocal(dhaka2am, 'UTC')).toBe('2026-11-14');
    expect(getTodayLocal(dhaka2am, 'Asia/Dhaka')).toBe('2026-11-15');
    expect(getDaysUsed('2026-11-14', getTodayLocal(dhaka2am, 'Asia/Dhaka'))).toBe(1);
    expect(getTodayUTC()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
