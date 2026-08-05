import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getMostRecentMonday, shouldResetRecurringTasks } from '@/lib/recurrence';

describe('getMostRecentMonday', () => {
  it('for a Monday date, should return that same Monday at 00:00:00', () => {
    // Monday, June 16, 2025
    const monday = new Date(2025, 5, 16, 10, 30, 0);
    const result = getMostRecentMonday(monday);
    expect(result).toEqual(new Date(2025, 5, 16, 0, 0, 0, 0));
  });

  it('for a Tuesday, should return the previous Monday at 00:00:00', () => {
    // Tuesday, June 17, 2025
    const tuesday = new Date(2025, 5, 17, 14, 0, 0);
    const result = getMostRecentMonday(tuesday);
    expect(result).toEqual(new Date(2025, 5, 16, 0, 0, 0, 0));
  });

  it('for a Sunday, should return the previous Monday at 00:00:00 (6 days back)', () => {
    // Sunday, June 22, 2025
    const sunday = new Date(2025, 5, 22, 18, 0, 0);
    const result = getMostRecentMonday(sunday);
    expect(result).toEqual(new Date(2025, 5, 16, 0, 0, 0, 0));
  });

  it('for a Saturday, should return the previous Monday at 00:00:00 (5 days back)', () => {
    // Saturday, June 21, 2025
    const saturday = new Date(2025, 5, 21, 9, 0, 0);
    const result = getMostRecentMonday(saturday);
    expect(result).toEqual(new Date(2025, 5, 16, 0, 0, 0, 0));
  });

  it('for a Wednesday with a time component, should strip time and return Monday 00:00:00', () => {
    // Wednesday, June 18, 2025 at 15:45:30.123
    const wednesday = new Date(2025, 5, 18, 15, 45, 30, 123);
    const result = getMostRecentMonday(wednesday);
    expect(result).toEqual(new Date(2025, 5, 16, 0, 0, 0, 0));
  });
});

describe('shouldResetRecurringTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('with null lastResetTimestamp, should return true (first load)', () => {
    // Wednesday, June 18, 2025 at 10:00
    vi.setSystemTime(new Date(2025, 5, 18, 10, 0, 0));
    expect(shouldResetRecurringTasks(null)).toBe(true);
  });

  it('with timestamp from last Monday (before most recent Monday), should return true', () => {
    // Current time: Wednesday, June 18, 2025
    vi.setSystemTime(new Date(2025, 5, 18, 10, 0, 0));
    // Last reset: Monday, June 9, 2025 (the Monday before last)
    const lastReset = new Date(2025, 5, 9, 8, 0, 0).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(true);
  });

  it('with timestamp from earlier today (if today is after Monday), should return false', () => {
    // Current time: Wednesday, June 18, 2025 at 14:00
    vi.setSystemTime(new Date(2025, 5, 18, 14, 0, 0));
    // Last reset: Wednesday, June 18, 2025 at 08:00 (earlier today)
    const lastReset = new Date(2025, 5, 18, 8, 0, 0).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(false);
  });

  it('with timestamp from this Monday, should return false (already reset this week)', () => {
    // Current time: Wednesday, June 18, 2025 at 10:00
    vi.setSystemTime(new Date(2025, 5, 18, 10, 0, 0));
    // Last reset: Monday, June 16, 2025 at 09:00 (this Monday)
    const lastReset = new Date(2025, 5, 16, 9, 0, 0).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(false);
  });

  it('with timestamp from 2 weeks ago, should return true', () => {
    // Current time: Wednesday, June 18, 2025 at 10:00
    vi.setSystemTime(new Date(2025, 5, 18, 10, 0, 0));
    // Last reset: Wednesday, June 4, 2025 (2 weeks ago)
    const lastReset = new Date(2025, 5, 4, 10, 0, 0).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(true);
  });
});

describe('Edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('app opened on Monday at 00:00 exactly', () => {
    // Current time: Monday, June 16, 2025 at 00:00:00.000
    vi.setSystemTime(new Date(2025, 5, 16, 0, 0, 0, 0));
    // Last reset: Sunday, June 15, 2025 at 23:59 (just before Monday)
    const lastReset = new Date(2025, 5, 15, 23, 59, 59).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(true);
  });

  it('app opened on Sunday evening (reset should use the Monday before)', () => {
    // Current time: Sunday, June 22, 2025 at 21:00
    vi.setSystemTime(new Date(2025, 5, 22, 21, 0, 0));
    // Most recent Monday from Sunday is June 16
    // Last reset: Sunday, June 15, 2025 (before June 16 Monday)
    const lastReset = new Date(2025, 5, 15, 10, 0, 0).toISOString();
    expect(shouldResetRecurringTasks(lastReset)).toBe(true);
  });
});
