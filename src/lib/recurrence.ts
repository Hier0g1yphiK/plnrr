import type { OrganizerState } from './types';

/**
 * Returns the most recent Monday at 00:00:00.000 local time
 * relative to the given date.
 */
export function getMostRecentMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since last Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Determines whether recurring tasks should be reset.
 * Returns true if lastResetTimestamp is null (first load)
 * or if it's before the most recent Monday 00:00 local time.
 */
export function shouldResetRecurringTasks(
  lastResetTimestamp: string | null
): boolean {
  const now = new Date();
  const lastReset = lastResetTimestamp ? new Date(lastResetTimestamp) : null;

  if (!lastReset) return true; // First load ever — reset everything

  // Find the most recent Monday 00:00:00 local time
  const mostRecentMonday = getMostRecentMonday(now);

  // If the last reset was before the most recent Monday, we need to reset
  return lastReset < mostRecentMonday;
}

/**
 * Resets all recurring tasks to incomplete.
 * Non-recurring tasks are left unchanged.
 */
export function resetRecurringTasks(state: OrganizerState): OrganizerState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.recurring ? { ...task, completed: false } : task
    ),
  };
}
