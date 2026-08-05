// Feature: multi-user-auth, Property 5: Migration chain version correctness (import-time only)
// Feature: multi-user-auth, Property 7: Import data migration + validation round-trip
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  runMigrations,
  checklistMigrations,
  organizerMigrations,
} from '@/lib/migrations';
import { ChecklistStateSchema, OrganizerStateSchema } from '@/lib/schemas';

// **Validates: Requirements 6.1, 6.5, 7.3**

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

/**
 * Generator for checklist items at v1 (WITHOUT minutesBefore field).
 * This is the old schema shape before migration v1→v2.
 */
const arbChecklistItemV1 = (categoryIds: string[]) =>
  fc.record({
    id: arbId(),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: fc.constantFrom(...categoryIds),
  });

/**
 * Generator for checklist items at v2 (WITH minutesBefore field).
 */
const arbChecklistItemV2 = (categoryIds: string[]) =>
  fc.record({
    id: arbId(),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: fc.constantFrom(...categoryIds),
    minutesBefore: fc.option(fc.nat({ max: 1440 }), { nil: null }),
  });

/**
 * Generator for a template at v1 (items lack minutesBefore).
 */
const arbTemplateV1 = () =>
  arbCategory()
    .chain((firstCategory) =>
      fc
        .array(arbCategory(), { minLength: 0, maxLength: 4 })
        .map((rest) => [firstCategory, ...rest])
    )
    .chain((categories) => {
      const categoryIds = categories.map((c) => c.id);
      return fc.tuple(
        fc.constant(categories),
        fc.array(arbChecklistItemV1(categoryIds), { minLength: 0, maxLength: 10 })
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

/**
 * Generator for a template at v2 (items have minutesBefore).
 */
const arbTemplateV2 = () =>
  arbCategory()
    .chain((firstCategory) =>
      fc
        .array(arbCategory(), { minLength: 0, maxLength: 4 })
        .map((rest) => [firstCategory, ...rest])
    )
    .chain((categories) => {
      const categoryIds = categories.map((c) => c.id);
      return fc.tuple(
        fc.constant(categories),
        fc.array(arbChecklistItemV2(categoryIds), { minLength: 0, maxLength: 10 })
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

/**
 * Generator for active checklist at v1 (no streamTime, items lack minutesBefore).
 */
const arbActiveChecklistV1 = () =>
  fc.record({
    templateId: arbId(),
    items: fc.array(
      fc.record({
        id: arbId(),
        text: fc.string({ minLength: 1, maxLength: 200 }),
        categoryId: arbId(),
        checked: fc.boolean(),
      }),
      { minLength: 0, maxLength: 10 }
    ),
  });

/**
 * Generator for active checklist at v2 (with streamTime, items have minutesBefore).
 */
const arbActiveChecklistV2 = () =>
  fc.record({
    templateId: arbId(),
    items: fc.array(
      fc.record({
        id: arbId(),
        text: fc.string({ minLength: 1, maxLength: 200 }),
        categoryId: arbId(),
        checked: fc.boolean(),
        minutesBefore: fc.option(fc.nat({ max: 1440 }), { nil: null }),
      }),
      { minLength: 0, maxLength: 10 }
    ),
    streamTime: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  });

/**
 * Generator for ChecklistState at v1 (old schema without minutesBefore/streamTime).
 */
const arbChecklistStateV1 = () =>
  fc.record({
    version: fc.constant(1),
    templates: fc.array(arbTemplateV1(), { minLength: 0, maxLength: 3 }),
    activeChecklist: fc.option(arbActiveChecklistV1(), { nil: null }),
  });

/**
 * Generator for ChecklistState at v2 (current schema with minutesBefore/streamTime).
 */
const arbChecklistStateV2 = () =>
  fc.record({
    version: fc.constant(2),
    templates: fc.array(arbTemplateV2(), { minLength: 0, maxLength: 3 }),
    activeChecklist: fc.option(arbActiveChecklistV2(), { nil: null }),
  });

/**
 * Generator for OrganizerState at v1 (current version, no migrations needed).
 */
const arbOrganizerStateV1 = () =>
  fc.record({
    version: fc.constant(1),
    tasks: fc.array(
      fc.record({
        id: arbId(),
        title: fc.string({ minLength: 1, maxLength: 100 }),
        weekday: fc.constantFrom(...WEEKDAYS),
        typeTag: fc.option(fc.constantFrom(...TYPE_TAGS), { nil: null }),
        completed: fc.boolean(),
        recurring: fc.boolean(),
        createdAt: arbIsoDate(),
      }),
      { minLength: 0, maxLength: 10 }
    ),
  });

// === Property 5: Migration chain version correctness (import-time only) ===

describe('Property 5: Migration chain version correctness (import-time only)', () => {
  it('checklist data at v1 migrates to current version (v2)', () => {
    fc.assert(
      fc.property(arbChecklistStateV1(), (state) => {
        const result = runMigrations(state, 1, checklistMigrations) as Record<string, unknown>;
        // fromVersion (1) < currentVersion (2), so output should be at version 2
        expect(result.version).toBe(checklistMigrations.currentVersion);
      }),
      { numRuns: 100 }
    );
  });

  it('checklist data at v2 (current version) is returned unchanged', () => {
    fc.assert(
      fc.property(arbChecklistStateV2(), (state) => {
        const result = runMigrations(state, 2, checklistMigrations);
        // fromVersion (2) >= currentVersion (2), output is identical to input
        expect(result).toBe(state);
      }),
      { numRuns: 100 }
    );
  });

  it('checklist data at version higher than current is returned unchanged', () => {
    fc.assert(
      fc.property(
        arbChecklistStateV2(),
        fc.integer({ min: 3, max: 100 }),
        (state, futureVersion) => {
          const futureState = { ...state, version: futureVersion };
          const result = runMigrations(futureState, futureVersion, checklistMigrations);
          // fromVersion >= currentVersion, output identical to input
          expect(result).toBe(futureState);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('organizer data at v1 (current version) is returned unchanged', () => {
    fc.assert(
      fc.property(arbOrganizerStateV1(), (state) => {
        const result = runMigrations(state, 1, organizerMigrations);
        // fromVersion (1) >= currentVersion (1), output identical to input
        expect(result).toBe(state);
      }),
      { numRuns: 100 }
    );
  });

  it('organizer data at version higher than current is returned unchanged', () => {
    fc.assert(
      fc.property(
        arbOrganizerStateV1(),
        fc.integer({ min: 2, max: 100 }),
        (state, futureVersion) => {
          const futureState = { ...state, version: futureVersion };
          const result = runMigrations(futureState, futureVersion, organizerMigrations);
          // fromVersion >= currentVersion, output identical to input
          expect(result).toBe(futureState);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// === Property 7: Import data migration + validation round-trip ===

describe('Property 7: Import data migration + validation round-trip', () => {
  it('checklist state at v1 migrates and validates against current ChecklistStateSchema', () => {
    fc.assert(
      fc.property(arbChecklistStateV1(), (stateV1) => {
        // Apply migration chain from v1 → v2
        const migrated = runMigrations(stateV1, 1, checklistMigrations);

        // Validate against current Zod schema
        const parseResult = ChecklistStateSchema.safeParse(migrated);
        expect(parseResult.success).toBe(true);

        if (parseResult.success) {
          const validated = parseResult.data;

          // Version should be at current
          expect(validated.version).toBe(checklistMigrations.currentVersion);

          // All original templates preserved
          expect(validated.templates.length).toBe(stateV1.templates.length);
          for (let i = 0; i < stateV1.templates.length; i++) {
            const original = stateV1.templates[i];
            const result = validated.templates[i];

            expect(result.id).toBe(original.id);
            expect(result.name).toBe(original.name);
            expect(result.categories).toEqual(original.categories);
            expect(result.createdAt).toBe(original.createdAt);

            // Items preserved with minutesBefore defaulting to null
            expect(result.items.length).toBe(original.items.length);
            for (let j = 0; j < original.items.length; j++) {
              expect(result.items[j].id).toBe(original.items[j].id);
              expect(result.items[j].text).toBe(original.items[j].text);
              expect(result.items[j].categoryId).toBe(original.items[j].categoryId);
              expect(result.items[j].minutesBefore).toBe(null);
            }
          }

          // Active checklist preserved if present
          if (stateV1.activeChecklist) {
            expect(validated.activeChecklist).not.toBeNull();
            const origAc = stateV1.activeChecklist;
            const resAc = validated.activeChecklist!;

            expect(resAc.templateId).toBe(origAc.templateId);
            expect(resAc.streamTime).toBe(null); // additive default
            expect(resAc.items.length).toBe(origAc.items.length);

            for (let k = 0; k < origAc.items.length; k++) {
              expect(resAc.items[k].id).toBe(origAc.items[k].id);
              expect(resAc.items[k].text).toBe(origAc.items[k].text);
              expect(resAc.items[k].categoryId).toBe(origAc.items[k].categoryId);
              expect(resAc.items[k].checked).toBe(origAc.items[k].checked);
              expect(resAc.items[k].minutesBefore).toBe(null); // additive default
            }
          } else {
            expect(validated.activeChecklist).toBeNull();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('checklist state at v2 validates without modification', () => {
    fc.assert(
      fc.property(arbChecklistStateV2(), (stateV2) => {
        // No migration needed — already at current version
        const migrated = runMigrations(stateV2, 2, checklistMigrations);

        const parseResult = ChecklistStateSchema.safeParse(migrated);
        expect(parseResult.success).toBe(true);

        if (parseResult.success) {
          expect(parseResult.data.version).toBe(2);
          expect(parseResult.data.templates).toEqual(stateV2.templates);
          expect(parseResult.data.activeChecklist).toEqual(stateV2.activeChecklist);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('organizer state at v1 validates without modification (no migrations needed)', () => {
    fc.assert(
      fc.property(arbOrganizerStateV1(), (stateV1) => {
        // No migration needed — organizer is already at v1 (current)
        const migrated = runMigrations(stateV1, 1, organizerMigrations);

        const parseResult = OrganizerStateSchema.safeParse(migrated);
        expect(parseResult.success).toBe(true);

        if (parseResult.success) {
          expect(parseResult.data.version).toBe(1);
          expect(parseResult.data.tasks).toEqual(stateV1.tasks);
        }
      }),
      { numRuns: 100 }
    );
  });
});
