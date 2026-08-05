// Feature: multi-user-auth, Property: Normalize ⇄ Reconstruct Round-Trip
import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// **Validates: Requirements 4.1, 4.6, 3.7**

// === In-Memory Store ===

// Simulates Prisma's relational storage for round-trip testing
interface InMemoryStore {
  checklistTemplates: Map<string, { id: string; name: string; nameLower: string; createdAt: Date; userId: string }>;
  checklistCategories: Map<string, { id: string; name: string; order: number; templateId: string }>;
  checklistItems: Map<string, { id: string; text: string; minutesBefore: number | null; templateId: string; categoryId: string }>;
  activeChecklists: Map<string, { id: string; userId: string; templateId: string; streamTime: string | null; items: unknown }>;
  taskCards: Map<string, { id: string; title: string; weekday: string; typeTag: string | null; completed: boolean; recurring: boolean; createdAt: Date; userId: string }>;
}

function createStore(): InMemoryStore {
  return {
    checklistTemplates: new Map(),
    checklistCategories: new Map(),
    checklistItems: new Map(),
    activeChecklists: new Map(),
    taskCards: new Map(),
  };
}

let store: InMemoryStore;

// === Mocking Setup ===

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

function createInMemoryPrisma(s: InMemoryStore) {
  const model = {
    checklistTemplate: {
      findMany: async ({ where, include }: any) => {
        const results = [...s.checklistTemplates.values()]
          .filter((t) => t.userId === where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return results.map((t) => {
          const result: any = { ...t };
          if (include?.categories) {
            result.categories = [...s.checklistCategories.values()]
              .filter((c) => c.templateId === t.id)
              .sort((a, b) => a.order - b.order);
          }
          if (include?.items) {
            result.items = [...s.checklistItems.values()]
              .filter((i) => i.templateId === t.id);
          }
          return result;
        });
      },
      deleteMany: async ({ where }: any) => {
        const idsToDelete: string[] = [];
        if (where.id?.in && where.userId) {
          for (const id of where.id.in) {
            const t = s.checklistTemplates.get(id);
            if (t && t.userId === where.userId) idsToDelete.push(id);
          }
        } else if (where.userId) {
          for (const [id, t] of s.checklistTemplates) {
            if (t.userId === where.userId) idsToDelete.push(id);
          }
        }
        for (const id of idsToDelete) {
          s.checklistTemplates.delete(id);
          for (const [cid, c] of s.checklistCategories) {
            if (c.templateId === id) s.checklistCategories.delete(cid);
          }
          for (const [iid, i] of s.checklistItems) {
            if (i.templateId === id) s.checklistItems.delete(iid);
          }
          for (const [acid, ac] of s.activeChecklists) {
            if (ac.templateId === id) s.activeChecklists.delete(acid);
          }
        }
        return { count: idsToDelete.length };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = s.checklistTemplates.get(where.id);
        if (existing) {
          Object.assign(existing, update);
          if (update.name) existing.nameLower = update.name.toLowerCase();
          return existing;
        }
        s.checklistTemplates.set(create.id, {
          ...create,
          createdAt: create.createdAt instanceof Date ? create.createdAt : new Date(create.createdAt),
        });
        return s.checklistTemplates.get(create.id);
      },
    },
    checklistCategory: {
      findMany: async ({ where }: any) => {
        return [...s.checklistCategories.values()]
          .filter((c) => c.templateId === where.templateId);
      },
      deleteMany: async ({ where }: any) => {
        const idsToDelete: string[] = [];
        if (where.id?.in && where.templateId) {
          for (const id of where.id.in) {
            const c = s.checklistCategories.get(id);
            if (c && c.templateId === where.templateId) idsToDelete.push(id);
          }
        } else if (where.template?.userId) {
          for (const [id, c] of s.checklistCategories) {
            const t = s.checklistTemplates.get(c.templateId);
            if (t && t.userId === where.template.userId) idsToDelete.push(id);
          }
        }
        for (const id of idsToDelete) s.checklistCategories.delete(id);
        return { count: idsToDelete.length };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = s.checklistCategories.get(where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        s.checklistCategories.set(create.id, { ...create });
        return s.checklistCategories.get(create.id);
      },
    },
    checklistItem: {
      findMany: async ({ where }: any) => {
        return [...s.checklistItems.values()]
          .filter((i) => i.templateId === where.templateId);
      },
      deleteMany: async ({ where }: any) => {
        const idsToDelete: string[] = [];
        if (where.id?.in && where.templateId) {
          for (const id of where.id.in) {
            const i = s.checklistItems.get(id);
            if (i && i.templateId === where.templateId) idsToDelete.push(id);
          }
        } else if (where.template?.userId) {
          for (const [id, i] of s.checklistItems) {
            const t = s.checklistTemplates.get(i.templateId);
            if (t && t.userId === where.template.userId) idsToDelete.push(id);
          }
        }
        for (const id of idsToDelete) s.checklistItems.delete(id);
        return { count: idsToDelete.length };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = s.checklistItems.get(where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        s.checklistItems.set(create.id, { ...create });
        return s.checklistItems.get(create.id);
      },
    },
    activeChecklist: {
      findUnique: async ({ where }: any) => {
        for (const ac of s.activeChecklists.values()) {
          if (ac.userId === where.userId) return ac;
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        let existing: any = null;
        for (const ac of s.activeChecklists.values()) {
          if (ac.userId === where.userId) { existing = ac; break; }
        }
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const id = `ac_${Math.random().toString(36).slice(2)}`;
        const entry = { id, ...create };
        s.activeChecklists.set(id, entry);
        return entry;
      },
      deleteMany: async ({ where }: any) => {
        const idsToDelete: string[] = [];
        for (const [id, ac] of s.activeChecklists) {
          if (ac.userId === where.userId) idsToDelete.push(id);
        }
        for (const id of idsToDelete) s.activeChecklists.delete(id);
        return { count: idsToDelete.length };
      },
    },
    taskCard: {
      findMany: async ({ where }: any) => {
        return [...s.taskCards.values()]
          .filter((t) => t.userId === where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      deleteMany: async ({ where }: any) => {
        const idsToDelete: string[] = [];
        if (where.id?.in && where.userId) {
          for (const id of where.id.in) {
            const t = s.taskCards.get(id);
            if (t && t.userId === where.userId) idsToDelete.push(id);
          }
        } else if (where.userId) {
          for (const [id, t] of s.taskCards) {
            if (t.userId === where.userId) idsToDelete.push(id);
          }
        }
        for (const id of idsToDelete) s.taskCards.delete(id);
        return { count: idsToDelete.length };
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = s.taskCards.get(where.id);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        s.taskCards.set(create.id, {
          ...create,
          createdAt: create.createdAt instanceof Date ? create.createdAt : new Date(create.createdAt),
        });
        return s.taskCards.get(create.id);
      },
    },
    user: {
      update: async () => ({}),
      findUnique: async () => ({ importCompleted: false }),
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      // Create a fresh model reference pointing to same store
      return fn(createInMemoryPrisma(s));
    },
  };
  return model;
}

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return createInMemoryPrisma(store);
  },
}));

// === Generators ===

const WEEKDAYS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

const TYPE_TAGS = [
  "stream-day", "content-planning", "admin-business", "editing",
] as const;

/** Generates a safe alphanumeric ID that won't collide with JS builtins */
const arbId = () =>
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{5,14}$/);

const arbIsoDate = () =>
  fc.date({ min: new Date("2020-01-01T00:00:00.000Z"), max: new Date("2030-12-31T23:59:59.999Z") })
    .filter((d) => !isNaN(d.getTime()))
    .map((d) => d.toISOString());

/**
 * Generates a valid ChecklistState using a pool of unique IDs.
 * All entity IDs are globally unique (primary keys in DB).
 * Items reference existing categories within their template.
 */
const arbChecklistState = () =>
  fc.record({
    numTemplates: fc.nat({ max: 2 }),
    catsPerTemplate: fc.nat({ max: 3 }).map((n) => Math.max(1, n)),
    itemsPerTemplate: fc.nat({ max: 5 }),
    idPool: fc.uniqueArray(arbId(), { minLength: 40, maxLength: 60 }),
    names: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 3, maxLength: 3 }),
    catNames: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 10, maxLength: 10 }),
    itemTexts: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 20, maxLength: 20 }),
    orders: fc.array(fc.nat({ max: 100 }), { minLength: 10, maxLength: 10 }),
    minutesBefores: fc.array(fc.option(fc.nat({ max: 1440 }), { nil: null }), { minLength: 20, maxLength: 20 }),
    dates: fc.array(arbIsoDate(), { minLength: 3, maxLength: 3 }),
    hasActiveChecklist: fc.boolean(),
  }).map(({ numTemplates, catsPerTemplate, itemsPerTemplate, idPool, names, catNames, itemTexts, orders, minutesBefores, dates, hasActiveChecklist }) => {
    let idIdx = 0;
    const nextId = () => idPool[idIdx++] || `fallback_${idIdx}`;

    const templates: any[] = [];
    for (let t = 0; t < numTemplates; t++) {
      const templateId = nextId();
      const categories: any[] = [];
      for (let c = 0; c < catsPerTemplate; c++) {
        categories.push({
          id: nextId(),
          name: catNames[(t * catsPerTemplate + c) % catNames.length],
          order: orders[(t * catsPerTemplate + c) % orders.length],
        });
      }
      const items: any[] = [];
      for (let i = 0; i < itemsPerTemplate; i++) {
        items.push({
          id: nextId(),
          text: itemTexts[(t * itemsPerTemplate + i) % itemTexts.length],
          categoryId: categories[i % categories.length].id,
          minutesBefore: minutesBefores[(t * itemsPerTemplate + i) % minutesBefores.length],
        });
      }
      templates.push({
        id: templateId,
        name: names[t % names.length],
        categories,
        items,
        createdAt: dates[t % dates.length],
      });
    }

    let activeChecklist: any = null;
    if (hasActiveChecklist && templates.length > 0) {
      const targetTemplate = templates[0];
      activeChecklist = {
        templateId: targetTemplate.id,
        items: targetTemplate.items.slice(0, 3).map((item: any) => ({
          id: nextId(),
          text: item.text,
          categoryId: item.categoryId,
          checked: false,
          minutesBefore: item.minutesBefore,
        })),
        streamTime: null,
      };
    }

    return { version: 1, templates, activeChecklist };
  });

/**
 * Generates a valid OrganizerState with unique task IDs.
 */
const arbOrganizerState = () =>
  fc.record({
    numTasks: fc.nat({ max: 8 }),
    idPool: fc.uniqueArray(arbId(), { minLength: 10, maxLength: 15 }),
    titles: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 10, maxLength: 10 }),
    weekdays: fc.array(fc.constantFrom(...WEEKDAYS), { minLength: 10, maxLength: 10 }),
    typeTags: fc.array(fc.option(fc.constantFrom(...TYPE_TAGS), { nil: null }), { minLength: 10, maxLength: 10 }),
    completeds: fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
    recurrings: fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
    dates: fc.array(arbIsoDate(), { minLength: 10, maxLength: 10 }),
  }).map(({ numTasks, idPool, titles, weekdays, typeTags, completeds, recurrings, dates }) => {
    const tasks: any[] = [];
    for (let i = 0; i < Math.min(numTasks, idPool.length); i++) {
      tasks.push({
        id: idPool[i],
        title: titles[i % titles.length],
        weekday: weekdays[i % weekdays.length],
        typeTag: typeTags[i % typeTags.length],
        completed: completeds[i % completeds.length],
        recurring: recurrings[i % recurrings.length],
        createdAt: dates[i % dates.length],
      });
    }
    return { version: 1, tasks };
  });

// === Tests ===

describe("Round-trip: normalize ⇄ reconstruct", () => {
  const TEST_USER_ID = "testUserRoundTrip001";

  beforeEach(() => {
    store = createStore();
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_ID } });
  });

  it("ChecklistState survives saveChecklistState → loadUserData round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(arbChecklistState(), async (state) => {
        // Reset store for each iteration
        store = createStore();

        const { saveChecklistState, loadUserData } = await import("@/lib/actions");

        // Save the state
        const saveResult = await saveChecklistState(state);
        expect(saveResult.error).toBeUndefined();

        // Load the state back
        const loaded = await loadUserData();

        // Compare templates (loadUserData returns templates sorted by createdAt asc)
        expect(loaded.checklistState.templates.length).toBe(state.templates.length);
        const sortedTemplates = [...state.templates].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        for (let i = 0; i < sortedTemplates.length; i++) {
          const original = sortedTemplates[i];
          const reconstructed = loaded.checklistState.templates[i];

          expect(reconstructed.id).toBe(original.id);
          expect(reconstructed.name).toBe(original.name);
          expect(reconstructed.createdAt).toBe(original.createdAt);

          // Categories should match (sorted by order)
          const sortedOriginalCats = [...original.categories].sort((a, b) => a.order - b.order);
          expect(reconstructed.categories).toEqual(sortedOriginalCats);

          // Items should match (order may differ, compare as sets by id)
          const sortedOriginalItems = [...original.items].sort((a, b) => a.id.localeCompare(b.id));
          const sortedReconstructedItems = [...reconstructed.items].sort((a, b) => a.id.localeCompare(b.id));
          expect(sortedReconstructedItems).toEqual(sortedOriginalItems);
        }

        // Compare active checklist
        if (state.activeChecklist) {
          expect(loaded.checklistState.activeChecklist).not.toBeNull();
          expect(loaded.checklistState.activeChecklist!.templateId).toBe(state.activeChecklist.templateId);
          expect(loaded.checklistState.activeChecklist!.streamTime).toBe(state.activeChecklist.streamTime);
          expect(loaded.checklistState.activeChecklist!.items).toEqual(state.activeChecklist.items);
        } else {
          expect(loaded.checklistState.activeChecklist).toBeNull();
        }
      }),
      { numRuns: 50 }
    );
  });

  it("OrganizerState survives saveOrganizerState → loadUserData round-trip", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrganizerState(), async (state) => {
        // Reset store for each iteration
        store = createStore();

        const { saveOrganizerState, loadUserData } = await import("@/lib/actions");

        // Save the state
        const saveResult = await saveOrganizerState(state);
        expect(saveResult.error).toBeUndefined();

        // Load the state back
        const loaded = await loadUserData();

        // Compare tasks (sorted by createdAt from loadUserData)
        expect(loaded.organizerState.tasks.length).toBe(state.tasks.length);

        // Sort both by createdAt for comparison
        const sortedOriginal = [...state.tasks].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        for (let i = 0; i < sortedOriginal.length; i++) {
          const original = sortedOriginal[i];
          const reconstructed = loaded.organizerState.tasks[i];

          expect(reconstructed.id).toBe(original.id);
          expect(reconstructed.title).toBe(original.title);
          expect(reconstructed.weekday).toBe(original.weekday);
          expect(reconstructed.typeTag).toBe(original.typeTag);
          expect(reconstructed.completed).toBe(original.completed);
          expect(reconstructed.recurring).toBe(original.recurring);
          expect(reconstructed.createdAt).toBe(original.createdAt);
        }
      }),
      { numRuns: 50 }
    );
  });

  it("Deleted items/categories/cards do not reappear after save-load cycle", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbChecklistState().filter((s) =>
          s.templates.some((t: any) => t.items.length > 0 && t.categories.length > 1)
        ),
        arbOrganizerState().filter((s) => s.tasks.length >= 2),
        async (checklistState, organizerState) => {
          // Reset store for each iteration
          store = createStore();

          const { saveChecklistState, saveOrganizerState, loadUserData } =
            await import("@/lib/actions");

          // Initial save with full data
          await saveChecklistState(checklistState);
          await saveOrganizerState(organizerState);

          // Remove some items from checklist state
          const reducedChecklist = {
            ...checklistState,
            templates: checklistState.templates.map((t: any) => {
              if (t.items.length > 0 && t.categories.length > 1) {
                // Remove the last item
                const reducedItems = t.items.slice(0, -1);
                // Remove the last category only if no remaining items reference it
                const lastCat = t.categories[t.categories.length - 1];
                const catInUse = reducedItems.some((i: any) => i.categoryId === lastCat.id);
                const reducedCategories = catInUse
                  ? t.categories
                  : t.categories.slice(0, -1);
                return { ...t, items: reducedItems, categories: reducedCategories };
              }
              return t;
            }),
          };

          // Remove last task from organizer state
          const reducedOrganizer = {
            ...organizerState,
            tasks: organizerState.tasks.slice(0, -1),
          };

          // Track what was removed
          const removedItemIds = new Set<string>();
          const removedCategoryIds = new Set<string>();
          for (let i = 0; i < checklistState.templates.length; i++) {
            const origTemplate = checklistState.templates[i];
            const reducedTemplate = reducedChecklist.templates[i];
            for (const item of origTemplate.items) {
              if (!reducedTemplate.items.find((ri: any) => ri.id === item.id)) {
                removedItemIds.add(item.id);
              }
            }
            for (const cat of origTemplate.categories) {
              if (!reducedTemplate.categories.find((rc: any) => rc.id === cat.id)) {
                removedCategoryIds.add(cat.id);
              }
            }
          }
          const removedTaskId = organizerState.tasks[organizerState.tasks.length - 1].id;

          // Save the reduced state
          await saveChecklistState(reducedChecklist);
          await saveOrganizerState(reducedOrganizer);

          // Load back
          const loaded = await loadUserData();

          // Verify removed items don't reappear
          for (const template of loaded.checklistState.templates) {
            for (const item of template.items) {
              expect(removedItemIds.has(item.id)).toBe(false);
            }
            for (const cat of template.categories) {
              expect(removedCategoryIds.has(cat.id)).toBe(false);
            }
          }

          // Verify removed task doesn't reappear
          const loadedTaskIds = loaded.organizerState.tasks.map((t) => t.id);
          expect(loadedTaskIds).not.toContain(removedTaskId);
        }
      ),
      { numRuns: 30 }
    );
  });
});
