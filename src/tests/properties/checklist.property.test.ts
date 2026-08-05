// Feature: stream-prep, Property 1: Progress Indicator Invariant
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checklistReducer, formatProgress, type CheckItemAction, type UncheckItemAction } from '@/lib/checklist-reducer';
import type { ChecklistState, ActiveChecklist, ActiveChecklistItem } from '@/lib/types';

// **Validates: Requirements 3.2, 3.3, 3.4, 3.9**

// === Arbitraries ===

const arbId = () => fc.string({ minLength: 1, maxLength: 21 }).filter((s) => s.trim().length > 0);

const arbActiveChecklistItem = () =>
  fc.record({
    id: arbId(),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: arbId(),
    checked: fc.boolean(),
    minutesBefore: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 480 })),
  });

/**
 * Generates an ActiveChecklist with 1–50 items, each with a random checked state.
 */
const arbActiveChecklist = (): fc.Arbitrary<ActiveChecklist> =>
  fc.record({
    templateId: arbId(),
    items: fc.array(arbActiveChecklistItem(), { minLength: 1, maxLength: 50 }),
    streamTime: fc.oneof(fc.constant(null), fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)),
  });

/**
 * Generates a random sequence of CHECK_ITEM / UNCHECK_ITEM operations
 * targeting items from the given ActiveChecklist.
 */
const arbCheckUncheckOperations = (items: ActiveChecklistItem[]): fc.Arbitrary<(CheckItemAction | UncheckItemAction)[]> => {
  if (items.length === 0) return fc.constant([]);

  const itemIds = items.map((item) => item.id);
  const arbOp = fc.record({
    type: fc.constantFrom('CHECK_ITEM' as const, 'UNCHECK_ITEM' as const),
    itemId: fc.constantFrom(...itemIds),
  }).map(({ type, itemId }) => ({ type, payload: { itemId } }));

  return fc.array(arbOp, { minLength: 1, maxLength: 30 });
};

// === Tests ===

describe('Property 1: Progress Indicator Invariant', () => {
  it('formatProgress always equals actual checked count over total after any sequence of check/uncheck operations', () => {
    fc.assert(
      fc.property(
        arbActiveChecklist().chain((checklist) =>
          fc.tuple(fc.constant(checklist), arbCheckUncheckOperations(checklist.items))
        ),
        ([activeChecklist, operations]) => {
          // Build an initial state with this active checklist
          let state: ChecklistState = {
            version: 1,
            templates: [],
            activeChecklist: activeChecklist,
          };

          // Apply each operation via the reducer and verify invariant after each
          for (const action of operations) {
            state = checklistReducer(state, action);

            // Compute actual checked count
            const checkedCount = state.activeChecklist!.items.filter((i) => i.checked).length;
            const totalCount = state.activeChecklist!.items.length;

            // Assert progress indicator matches actual state
            const progress = formatProgress(state.activeChecklist);
            expect(progress).toBe(`${checkedCount}/${totalCount} complete`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: stream-prep, Property 3: Reset Idempotence

// **Validates: Requirements 3.6**

describe('Property 3: Reset Idempotence', () => {
  it('reset(checklist) deep-equals reset(reset(checklist))', () => {
    fc.assert(
      fc.property(arbActiveChecklist(), (activeChecklist) => {
        // Build state with random active checklist (items have random checked states)
        const state: ChecklistState = {
          version: 1,
          templates: [],
          activeChecklist,
        };

        // Apply RESET_CHECKLIST once
        const afterFirstReset = checklistReducer(state, { type: 'RESET_CHECKLIST' });

        // Apply RESET_CHECKLIST a second time
        const afterSecondReset = checklistReducer(afterFirstReset, { type: 'RESET_CHECKLIST' });

        // Assert single reset equals double reset (idempotence)
        expect(afterSecondReset).toEqual(afterFirstReset);
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: stream-prep, Property 8: Name Validation Boundary
// **Validates: Requirements 1.1, 1.2, 1.5, 4.1, 4.2**

import { organizerReducer } from '@/lib/organizer-reducer';
import type { OrganizerState, Weekday } from '@/lib/types';

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const emptyChecklistState: ChecklistState = {
  version: 1,
  templates: [],
  activeChecklist: null,
};

const emptyOrganizerState: OrganizerState = {
  version: 1,
  tasks: [],
};

describe('Property 8: Name Validation Boundary', () => {
  it('template creation succeeds iff 1 <= name.trim().length <= 100 and no duplicate name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (name) => {
          const state = checklistReducer(emptyChecklistState, {
            type: 'CREATE_TEMPLATE',
            payload: { name },
          });

          const trimmedLength = name.trim().length;
          const shouldSucceed = trimmedLength >= 1 && trimmedLength <= 100;

          if (shouldSucceed) {
            expect(state.templates.length).toBe(1);
            expect(state.templates[0].name).toBe(name.trim());
          } else {
            expect(state.templates.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('template creation rejects duplicate names (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 100),
        (name) => {
          // Create the first template
          const stateAfterFirst = checklistReducer(emptyChecklistState, {
            type: 'CREATE_TEMPLATE',
            payload: { name },
          });

          expect(stateAfterFirst.templates.length).toBe(1);

          // Try to create a duplicate (same name, different case)
          const duplicateName = name.toUpperCase() === name ? name.toLowerCase() : name.toUpperCase();
          const stateAfterDuplicate = checklistReducer(stateAfterFirst, {
            type: 'CREATE_TEMPLATE',
            payload: { name: duplicateName },
          });

          // Should still be 1 template — duplicate was rejected
          expect(stateAfterDuplicate.templates.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('task creation succeeds iff 1 <= title.trim().length <= 100', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.constantFrom(...WEEKDAYS),
        (title, weekday) => {
          const state = organizerReducer(emptyOrganizerState, {
            type: 'ADD_TASK',
            payload: { title, weekday },
          });

          const trimmedLength = title.trim().length;
          const shouldSucceed = trimmedLength >= 1 && trimmedLength <= 100;

          if (shouldSucceed) {
            expect(state.tasks.length).toBe(1);
            expect(state.tasks[0].title).toBe(title);
            expect(state.tasks[0].weekday).toBe(weekday);
          } else {
            expect(state.tasks.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: stream-prep, Property 4: Template Isolation

// **Validates: Requirements 3.6, 3.8**

// === Template Isolation Arbitraries ===

const arbCategoryForTemplate = (index: number) =>
  fc.record({
    id: arbId(),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((n) => n !== 'Other'),
    order: fc.constant(index),
  });

/**
 * Generates a random template with 1–4 named categories + an "Other" category,
 * and 1–10 items distributed across those categories.
 */
const arbTemplateWithItems = () =>
  fc
    .array(arbId(), { minLength: 1, maxLength: 4 })
    .chain((categoryIds) =>
      fc
        .tuple(
          ...categoryIds.map((id, i) =>
            fc.record({
              id: fc.constant(id),
              name: fc.string({ minLength: 1, maxLength: 50 }).filter((n) => n !== 'Other'),
              order: fc.constant(i),
            })
          )
        )
        .chain((cats) =>
          arbId().map((otherId) => [
            ...cats,
            { id: otherId, name: 'Other', order: cats.length },
          ])
        )
    )
    .chain((categories) => {
      const categoryIds = categories.map((c) => c.id);
      const items = fc.array(
        fc.record({
          id: arbId(),
          text: fc.string({ minLength: 1, maxLength: 100 }),
          categoryId: fc.constantFrom(...categoryIds),
          minutesBefore: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 480 })),
        }),
        { minLength: 1, maxLength: 10 }
      );
      return fc.tuple(fc.constant(categories), items);
    })
    .chain(([categories, items]) =>
      fc.tuple(arbId(), fc.date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') }).filter((d) => !isNaN(d.getTime())).map((d) => d.toISOString()))
        .map(([id, createdAt]) => ({
          id,
          name: `Template-${id}`,
          categories,
          items,
          createdAt,
        }))
    );

/**
 * Generates a random active checklist operation (CHECK_ITEM, UNCHECK_ITEM, or RESET_CHECKLIST).
 */
const arbActiveChecklistOperation = (itemIds: string[]) => {
  if (itemIds.length === 0) {
    return fc.constant({ type: 'RESET_CHECKLIST' as const });
  }

  return fc.oneof(
    fc.constantFrom(...itemIds).map((itemId) => ({
      type: 'CHECK_ITEM' as const,
      payload: { itemId },
    })),
    fc.constantFrom(...itemIds).map((itemId) => ({
      type: 'UNCHECK_ITEM' as const,
      payload: { itemId },
    })),
    fc.constant({ type: 'RESET_CHECKLIST' as const })
  );
};

describe('Property 4: Template Isolation', () => {
  it('template remains unchanged after active checklist operations', () => {
    fc.assert(
      fc.property(
        arbTemplateWithItems().chain((template) => {
          const itemIds = template.items.map((item) => item.id);
          const operations = fc.array(arbActiveChecklistOperation(itemIds), {
            minLength: 1,
            maxLength: 20,
          });
          return fc.tuple(fc.constant(template), operations);
        }),
        ([template, operations]) => {
          // Create initial state with the template
          const initialState: ChecklistState = {
            version: 1,
            templates: [template],
            activeChecklist: null,
          };

          // Deep-copy the template for comparison
          const templateSnapshot = JSON.parse(JSON.stringify(template));

          // Load the template as an active checklist
          let state = checklistReducer(initialState, {
            type: 'LOAD_TEMPLATE',
            payload: { templateId: template.id },
          });

          // Apply random sequence of CHECK_ITEM, UNCHECK_ITEM, RESET_CHECKLIST
          for (const operation of operations) {
            state = checklistReducer(state, operation as any);
          }

          // Assert the template in state still deep-equals the original copy
          const templateAfter = state.templates.find((t) => t.id === template.id);
          expect(templateAfter).toEqual(templateSnapshot);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: stream-prep, Property 6: Category Deletion Item Preservation
// **Validates: Requirements 2.6**

describe('Property 6: Category Deletion Item Preservation', () => {
  it('deleting a non-"Other" category preserves total item count and moves items to "Other"', () => {
    // Generator for item text values
    const arbItemText = fc.string({ minLength: 1, maxLength: 100 }).filter(
      (s) => s.trim().length >= 1 && s.trim().length <= 100
    );

    // Generator for a list of items to add, each assigned to a category index
    const arbItemAssignments = fc.array(
      fc.record({
        text: arbItemText,
        categoryIndex: fc.nat({ max: 3 }), // 0=Software, 1=Physical Setup, 2=Content, 3=Other
      }),
      { minLength: 1, maxLength: 20 }
    );

    // Generator for which non-"Other" category to delete (index 0, 1, or 2)
    const arbCategoryToDelete = fc.nat({ max: 2 }); // 0=Software, 1=Physical Setup, 2=Content

    fc.assert(
      fc.property(arbItemAssignments, arbCategoryToDelete, (itemAssignments, deleteCategoryIndex) => {
        // Step 1: Create a template (gives us default categories: Software, Physical Setup, Content, Other)
        let state: ChecklistState = {
          version: 1,
          templates: [],
          activeChecklist: null,
        };
        state = checklistReducer(state, {
          type: 'CREATE_TEMPLATE',
          payload: { name: 'Test Template' },
        });

        expect(state.templates).toHaveLength(1);
        const template = state.templates[0];
        const templateId = template.id;

        // Verify default categories exist
        expect(template.categories).toHaveLength(4);
        const categories = template.categories;
        const otherCategory = categories.find((c) => c.name === 'Other')!;
        expect(otherCategory).toBeDefined();

        // Step 2: Add items distributed across categories
        for (const assignment of itemAssignments) {
          const targetCategory = categories[assignment.categoryIndex];
          state = checklistReducer(state, {
            type: 'ADD_ITEM',
            payload: {
              templateId,
              categoryId: targetCategory.id,
              text: assignment.text,
            },
          });
        }

        // Get state before deletion
        const templateBefore = state.templates[0];
        const totalItemsBefore = templateBefore.items.length;
        const categoryToDelete = categories[deleteCategoryIndex];
        const itemsInDeletedCategory = templateBefore.items.filter(
          (item) => item.categoryId === categoryToDelete.id
        );

        // Step 3: Delete the non-"Other" category
        state = checklistReducer(state, {
          type: 'DELETE_CATEGORY',
          payload: { templateId, categoryId: categoryToDelete.id },
        });

        // Step 4: Assert total item count is preserved
        const templateAfter = state.templates[0];
        const totalItemsAfter = templateAfter.items.length;
        expect(totalItemsAfter).toBe(totalItemsBefore);

        // Step 5: Assert items from deleted category are now in "Other"
        const otherCategoryAfter = templateAfter.categories.find((c) => c.name === 'Other')!;
        expect(otherCategoryAfter).toBeDefined();

        const itemsInOtherAfter = templateAfter.items.filter(
          (item) => item.categoryId === otherCategoryAfter.id
        );

        // Items originally in "Other" + items moved from deleted category should all be in "Other" now
        const itemsOriginallyInOther = templateBefore.items.filter(
          (item) => item.categoryId === otherCategory.id
        );

        expect(itemsInOtherAfter.length).toBe(
          itemsOriginallyInOther.length + itemsInDeletedCategory.length
        );

        // Verify each item that was in the deleted category now has the "Other" categoryId
        for (const item of itemsInDeletedCategory) {
          const movedItem = templateAfter.items.find((i) => i.id === item.id);
          expect(movedItem).toBeDefined();
          expect(movedItem!.categoryId).toBe(otherCategoryAfter.id);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: stream-prep, Property 9: Active Checklist Loading
// **Validates: Requirements 3.1, 3.8**

describe('Property 9: Active Checklist Loading', () => {
  /**
   * Arbitrary for a category with a given order index.
   */
  const arbCategory = (order: number) =>
    fc.record({
      id: arbId(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      order: fc.constant(order),
    });

  /**
   * Arbitrary for a list of 1–10 unique categories.
   */
  const arbCategories = () =>
    fc.integer({ min: 1, max: 10 }).chain((count) =>
      fc.tuple(...Array.from({ length: count }, (_, i) => arbCategory(i)))
    );

  /**
   * Arbitrary for a complete template with 1–50 items distributed across 1–10 categories.
   */
  const arbTemplateForLoading = () =>
    arbCategories().chain((categories) => {
      const categoryIds = categories.map((c) => c.id);
      const arbItem = fc.record({
        id: arbId(),
        text: fc.string({ minLength: 1, maxLength: 200 }),
        categoryId: fc.constantFrom(...categoryIds),
        minutesBefore: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 480 })),
      });
      return fc.tuple(
        fc.constant(categories),
        fc.array(arbItem, { minLength: 1, maxLength: 50 })
      );
    }).chain(([categories, items]) =>
      fc.tuple(
        arbId(),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1),
        fc.integer({ min: 1577836800000, max: 1924905600000 }).map((ms) => new Date(ms).toISOString())
      ).map(([id, name, createdAt]) => ({
        id,
        name: name.trim(),
        categories,
        items,
        createdAt,
      }))
    );

  it('loading a template produces an ActiveChecklist where all items are unchecked, count matches, and text values match', () => {
    fc.assert(
      fc.property(arbTemplateForLoading(), (template) => {
        // Build state with this template
        const initialState: ChecklistState = {
          version: 1,
          templates: [template],
          activeChecklist: null,
        };

        // Load the template as an active checklist
        const state = checklistReducer(initialState, {
          type: 'LOAD_TEMPLATE',
          payload: { templateId: template.id },
        });

        // Assert active checklist was created
        expect(state.activeChecklist).not.toBeNull();
        const active = state.activeChecklist!;

        // Assert templateId reference is correct
        expect(active.templateId).toBe(template.id);

        // Assert item count matches template item count
        expect(active.items.length).toBe(template.items.length);

        // Assert all items have checked === false
        for (const item of active.items) {
          expect(item.checked).toBe(false);
        }

        // Assert text values match template items exactly (in order)
        for (let i = 0; i < template.items.length; i++) {
          expect(active.items[i].id).toBe(template.items[i].id);
          expect(active.items[i].text).toBe(template.items[i].text);
          expect(active.items[i].categoryId).toBe(template.items[i].categoryId);
        }
      }),
      { numRuns: 100 }
    );
  });
});
