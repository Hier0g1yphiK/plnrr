import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { resetRecurringTasks } from '@/lib/recurrence';
import { organizerReducer } from '@/lib/organizer-reducer';
import type { OrganizerState, TaskCard, Weekday, TypeTag } from '@/lib/types';

// === Generators ===

const weekdays: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const typeTags: (TypeTag | null)[] = [
  'stream-day',
  'content-planning',
  'admin-business',
  'editing',
  null,
];

const arbWeekday = fc.constantFrom(...weekdays);
const arbTypeTag = fc.constantFrom(...typeTags);

const arbTaskCard: fc.Arbitrary<TaskCard> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  weekday: arbWeekday,
  typeTag: arbTypeTag,
  completed: fc.boolean(),
  recurring: fc.boolean(),
  createdAt: fc
    .integer({ min: 1577836800000, max: 1924991999000 }) // 2020-01-01 to 2030-12-31
    .map((ts) => new Date(ts).toISOString()),
});

const arbOrganizerState: fc.Arbitrary<OrganizerState> = fc.record({
  version: fc.constant(1),
  tasks: fc.array(arbTaskCard, { minLength: 1, maxLength: 30 }),
});

// === Property Tests ===

// Feature: stream-prep, Property 5: Task Count Metamorphic
describe('Property 5: Task Count Metamorphic', () => {
  /**
   * Validates: Requirements 4.1, 4.4, 6.1
   */

  test('ADD increases total task count by exactly 1', () => {
    fc.assert(
      fc.property(
        arbOrganizerState,
        arbWeekday,
        fc.string({ minLength: 1, maxLength: 100 }),
        (state, weekday, title) => {
          // Ensure the target weekday has fewer than 50 tasks so the reducer accepts the add
          const tasksOnDay = state.tasks.filter((t) => t.weekday === weekday).length;
          fc.pre(tasksOnDay < 50);
          // Ensure title is valid (non-whitespace-only)
          fc.pre(title.trim().length >= 1);

          const countBefore = state.tasks.length;
          const result = organizerReducer(state, {
            type: 'ADD_TASK',
            payload: { title, weekday },
          });
          expect(result.tasks.length).toBe(countBefore + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('DELETE decreases total task count by exactly 1', () => {
    fc.assert(
      fc.property(arbOrganizerState, (state) => {
        // State already has at least 1 task (minLength: 1 in generator)
        // Pick a random task to delete
        const randomIndex = Math.floor(Math.random() * state.tasks.length);
        const taskId = state.tasks[randomIndex].id;

        const countBefore = state.tasks.length;
        const result = organizerReducer(state, {
          type: 'DELETE_TASK',
          payload: { id: taskId },
        });
        expect(result.tasks.length).toBe(countBefore - 1);
      }),
      { numRuns: 100 },
    );
  });

  test('filtered count for any single weekday <= total count', () => {
    fc.assert(
      fc.property(arbOrganizerState, arbWeekday, (state, weekday) => {
        const totalCount = state.tasks.length;
        const filteredCount = state.tasks.filter((t) => t.weekday === weekday).length;
        expect(filteredCount).toBeLessThanOrEqual(totalCount);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: stream-prep, Property 7: Recurring Task Reset
describe('Property 7: Recurring Task Reset', () => {
  /**
   * Validates: Requirements 7.2, 7.5
   *
   * For any set of tasks where some subset has `recurring === true` in any
   * completion state, executing the recurring reset operation SHALL set
   * `completed` to `false` on all recurring tasks while leaving non-recurring
   * tasks unchanged.
   */
  test('reset sets completed=false on all recurring tasks and leaves non-recurring unchanged', () => {
    fc.assert(
      fc.property(arbOrganizerState, (state) => {
        const result = resetRecurringTasks(state);

        // All recurring tasks must have completed === false after reset
        for (const task of result.tasks) {
          if (task.recurring) {
            expect(task.completed).toBe(false);
          }
        }

        // All non-recurring tasks retain their original completed value
        for (let i = 0; i < state.tasks.length; i++) {
          const original = state.tasks[i];
          const after = result.tasks[i];
          if (!original.recurring) {
            expect(after.completed).toBe(original.completed);
          }
        }

        // Task count remains the same (no tasks added or removed)
        expect(result.tasks.length).toBe(state.tasks.length);
      }),
      { numRuns: 100 },
    );
  });
});
