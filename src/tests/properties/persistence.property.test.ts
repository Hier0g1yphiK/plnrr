// Feature: stream-prep, Property 2: Persistence Round-Trip
// Feature: stream-prep, Property 10: Schema Migration Forward-Compatibility
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ChecklistStateSchema, OrganizerStateSchema } from '@/lib/schemas';

// **Validates: Requirements 8.4**

// === Arbitraries ===

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const TYPE_TAGS = [
  'stream-day',
  'content-planning',
  'admin-business',
  'editing',
] as const;

const arbId = () => fc.string({ minLength: 1, maxLength: 21 }).filter((s) => s.trim().length > 0);

const arbIsoDate = () =>
  fc
    .date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') })
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toISOString());

const arbCategory = () =>
  fc.record({
    id: arbId(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    order: fc.nat({ max: 100 }),
  });

const arbChecklistItem = (categoryIds: string[]) =>
  fc.record({
    id: arbId(),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: fc.constantFrom(...categoryIds),
  });

const arbTemplate = () =>
  arbCategory()
    .chain((firstCategory) =>
      fc
        .array(arbCategory(), { minLength: 0, maxLength: 9 })
        .map((rest) => [firstCategory, ...rest])
    )
    .chain((categories) => {
      const categoryIds = categories.map((c) => c.id);
      return fc.tuple(
        fc.constant(categories),
        fc.array(arbChecklistItem(categoryIds), { minLength: 0, maxLength: 50 })
      );
    })
    .chain(([categories, items]) =>
      fc.record({
        id: arbId(),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        categories: fc.constant(categories),
        items: fc.constant(items),
        createdAt: arbIsoDate(),
      })
    );

const arbActiveChecklistItem = () =>
  fc.record({
    id: arbId(),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: arbId(),
    checked: fc.boolean(),
  });

const arbActiveChecklist = () =>
  fc.record({
    templateId: arbId(),
    items: fc.array(arbActiveChecklistItem(), { minLength: 0, maxLength: 50 }),
  });

const arbChecklistState = () =>
  fc.record({
    version: fc.nat({ max: 100 }).map((n) => n + 1), // positive integer
    templates: fc.array(arbTemplate(), { minLength: 0, maxLength: 5 }),
    activeChecklist: fc.option(arbActiveChecklist(), { nil: null }),
  });

const arbWeekday = () => fc.constantFrom(...WEEKDAYS);

const arbTypeTag = () =>
  fc.option(fc.constantFrom(...TYPE_TAGS), { nil: null });

const arbTaskCard = () =>
  fc.record({
    id: arbId(),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    weekday: arbWeekday(),
    typeTag: arbTypeTag(),
    completed: fc.boolean(),
    recurring: fc.boolean(),
    createdAt: arbIsoDate(),
  });

const arbOrganizerState = () =>
  fc.record({
    version: fc.nat({ max: 100 }).map((n) => n + 1), // positive integer
    tasks: fc.array(arbTaskCard(), { minLength: 0, maxLength: 20 }),
  });

// === Tests ===

describe('Property 2: Persistence Round-Trip', () => {
  it('ChecklistState survives serialize → deserialize round-trip', () => {
    fc.assert(
      fc.property(arbChecklistState(), (state) => {
        // Serialize (same as writeToStorage)
        const serialized = JSON.stringify(state);

        // Deserialize (same as readFromStorage)
        const parsed = JSON.parse(serialized);
        const result = ChecklistStateSchema.parse(parsed);

        // Assert deep equality
        expect(result).toEqual(state);
      }),
      { numRuns: 100 }
    );
  });

  it('OrganizerState survives serialize → deserialize round-trip', () => {
    fc.assert(
      fc.property(arbOrganizerState(), (state) => {
        // Serialize (same as writeToStorage)
        const serialized = JSON.stringify(state);

        // Deserialize (same as readFromStorage)
        const parsed = JSON.parse(serialized);
        const result = OrganizerStateSchema.parse(parsed);

        // Assert deep equality
        expect(result).toEqual(state);
      }),
      { numRuns: 100 }
    );
  });
});


// **Validates: Requirements 8.7**

// === Helpers for Property 10 ===

/**
 * Generates an arbitrary dictionary of unknown fields (random string keys not colliding
 * with known schema fields or Object prototype keys, random JSON-serializable values).
 */
const OBJECT_PROTO_KEYS = Object.getOwnPropertyNames(Object.prototype);

const arbUnknownFields = (excludeKeys: string[] = []) =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter(
      (k) =>
        !excludeKeys.includes(k) &&
        !OBJECT_PROTO_KEYS.includes(k) &&
        /^[a-zA-Z_]/.test(k)
    ),
    fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.string(), { maxLength: 3 }),
      fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string(), { minKeys: 0, maxKeys: 3 })
    ),
    { minKeys: 1, maxKeys: 5 }
  );

// Known top-level keys for each schema to avoid generating overlapping unknown fields
const CHECKLIST_STATE_KEYS = ['version', 'templates', 'activeChecklist'];
const ORGANIZER_STATE_KEYS = ['version', 'tasks'];
const TEMPLATE_KEYS = ['id', 'name', 'categories', 'items', 'createdAt'];
const TASK_CARD_KEYS = ['id', 'title', 'weekday', 'typeTag', 'completed', 'recurring', 'createdAt'];

describe('Property 10: Schema Migration Forward-Compatibility', () => {
  it('ChecklistState with unknown top-level fields: discards unknown, preserves recognized, applies defaults', () => {
    fc.assert(
      fc.property(
        arbChecklistState(),
        arbUnknownFields(CHECKLIST_STATE_KEYS),
        (state, unknownFields) => {
          // Add unknown fields at top level
          const polluted = { ...state, ...unknownFields };

          // Simulate persistence: serialize → parse → validate with Zod
          const serialized = JSON.stringify(polluted);
          const parsed = JSON.parse(serialized);
          const result = ChecklistStateSchema.parse(parsed);

          // Unknown fields should be stripped
          for (const key of Object.keys(unknownFields)) {
            expect(Object.hasOwn(result, key)).toBe(false);
          }

          // Recognized fields should be preserved
          expect(result.version).toBe(state.version);
          expect(result.templates).toEqual(state.templates);
          expect(result.activeChecklist).toEqual(state.activeChecklist);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ChecklistState with unknown fields nested in templates: discards unknown, preserves recognized', () => {
    fc.assert(
      fc.property(
        arbChecklistState().filter((s) => s.templates.length > 0),
        arbUnknownFields(TEMPLATE_KEYS),
        (state, unknownFields) => {
          // Add unknown fields to each template
          const pollutedTemplates = state.templates.map((t) => ({ ...t, ...unknownFields }));
          const polluted = { ...state, templates: pollutedTemplates };

          const serialized = JSON.stringify(polluted);
          const parsed = JSON.parse(serialized);
          const result = ChecklistStateSchema.parse(parsed);

          // Templates should have unknown fields stripped
          for (const template of result.templates) {
            for (const key of Object.keys(unknownFields)) {
              expect(Object.hasOwn(template, key)).toBe(false);
            }
          }

          // Recognized template fields should be preserved
          expect(result.templates.length).toBe(state.templates.length);
          for (let i = 0; i < result.templates.length; i++) {
            expect(result.templates[i].id).toBe(state.templates[i].id);
            expect(result.templates[i].name).toBe(state.templates[i].name);
            expect(result.templates[i].categories).toEqual(state.templates[i].categories);
            expect(result.templates[i].items).toEqual(state.templates[i].items);
            expect(result.templates[i].createdAt).toBe(state.templates[i].createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OrganizerState with unknown top-level fields: discards unknown, preserves recognized, applies defaults', () => {
    fc.assert(
      fc.property(
        arbOrganizerState(),
        arbUnknownFields(ORGANIZER_STATE_KEYS),
        (state, unknownFields) => {
          // Add unknown fields at top level
          const polluted = { ...state, ...unknownFields };

          const serialized = JSON.stringify(polluted);
          const parsed = JSON.parse(serialized);
          const result = OrganizerStateSchema.parse(parsed);

          // Unknown fields should be stripped
          for (const key of Object.keys(unknownFields)) {
            expect(Object.hasOwn(result, key)).toBe(false);
          }

          // Recognized fields should be preserved
          expect(result.version).toBe(state.version);
          expect(result.tasks).toEqual(state.tasks);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OrganizerState with unknown fields nested in tasks: discards unknown, preserves recognized', () => {
    fc.assert(
      fc.property(
        arbOrganizerState().filter((s) => s.tasks.length > 0),
        arbUnknownFields(TASK_CARD_KEYS),
        (state, unknownFields) => {
          // Add unknown fields to each task
          const pollutedTasks = state.tasks.map((t) => ({ ...t, ...unknownFields }));
          const polluted = { ...state, tasks: pollutedTasks };

          const serialized = JSON.stringify(polluted);
          const parsed = JSON.parse(serialized);
          const result = OrganizerStateSchema.parse(parsed);

          // Tasks should have unknown fields stripped
          for (const task of result.tasks) {
            for (const key of Object.keys(unknownFields)) {
              expect(Object.hasOwn(task, key)).toBe(false);
            }
          }

          // Recognized task fields should be preserved
          expect(result.tasks.length).toBe(state.tasks.length);
          for (let i = 0; i < result.tasks.length; i++) {
            expect(result.tasks[i].id).toBe(state.tasks[i].id);
            expect(result.tasks[i].title).toBe(state.tasks[i].title);
            expect(result.tasks[i].weekday).toBe(state.tasks[i].weekday);
            expect(result.tasks[i].typeTag).toBe(state.tasks[i].typeTag);
            expect(result.tasks[i].completed).toBe(state.tasks[i].completed);
            expect(result.tasks[i].recurring).toBe(state.tasks[i].recurring);
            expect(result.tasks[i].createdAt).toBe(state.tasks[i].createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ChecklistState with missing optional version field: applies default value', () => {
    fc.assert(
      fc.property(
        arbChecklistState(),
        (state) => {
          // Remove version field (it has a .default(1) in schema)
          const { version: _, ...stateWithoutVersion } = state;

          const serialized = JSON.stringify(stateWithoutVersion);
          const parsed = JSON.parse(serialized);
          const result = ChecklistStateSchema.parse(parsed);

          // Default value should be applied
          expect(result.version).toBe(1);

          // Other recognized fields should be preserved
          expect(result.templates).toEqual(state.templates);
          expect(result.activeChecklist).toEqual(state.activeChecklist);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OrganizerState with missing optional version field: applies default value', () => {
    fc.assert(
      fc.property(
        arbOrganizerState(),
        (state) => {
          // Remove version field (it has a .default(1) in schema)
          const { version: _, ...stateWithoutVersion } = state;

          const serialized = JSON.stringify(stateWithoutVersion);
          const parsed = JSON.parse(serialized);
          const result = OrganizerStateSchema.parse(parsed);

          // Default value should be applied
          expect(result.version).toBe(1);

          // Other recognized fields should be preserved
          expect(result.tasks).toEqual(state.tasks);
        }
      ),
      { numRuns: 100 }
    );
  });
});
