// Feature: multi-user-auth, Property 4: Zod validation rejects invalid payloads with field-level errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// **Validates: Requirements 4.6, 5.3**

// === Mocks ===

// Use vi.hoisted to define mock objects that can be referenced in vi.mock factories
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    checklistTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    checklistCategory: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    checklistItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    activeChecklist: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    taskCard: {
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

// Mock auth to return a valid session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'test-user-id', email: 'test@example.com' },
  }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import Server Actions AFTER mocks are set up
import { saveChecklistState, saveOrganizerState, importUserData } from '@/lib/actions';

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

/** Generates a valid Category object */
const arbValidCategory = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 21 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    order: fc.nat({ max: 100 }),
  });

/** Generates a valid ChecklistItem object */
const arbValidChecklistItem = (categoryIds: string[]) =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 21 }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: categoryIds.length > 0 ? fc.constantFrom(...categoryIds) : fc.string({ minLength: 1, maxLength: 21 }),
    minutesBefore: fc.oneof(fc.constant(null), fc.nat({ max: 480 })),
  });

/** Generates a valid Template object */
const arbValidTemplate = () =>
  fc.array(arbValidCategory(), { minLength: 1, maxLength: 5 }).chain((categories) => {
    const categoryIds = categories.map((c) => c.id);
    return fc.record({
      id: fc.string({ minLength: 1, maxLength: 21 }),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      categories: fc.constant(categories),
      items: fc.array(arbValidChecklistItem(categoryIds), { minLength: 0, maxLength: 10 }),
      createdAt: fc.date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') }).filter((d) => !isNaN(d.getTime())).map((d) => d.toISOString()),
    });
  });

/** Generates a valid ActiveChecklistItem */
const arbValidActiveChecklistItem = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 21 }),
    text: fc.string({ minLength: 1, maxLength: 200 }),
    categoryId: fc.string({ minLength: 1, maxLength: 21 }),
    checked: fc.boolean(),
    minutesBefore: fc.oneof(fc.constant(null), fc.nat({ max: 480 })),
  });

/** Generates a valid ActiveChecklist */
const arbValidActiveChecklist = () =>
  fc.record({
    templateId: fc.string({ minLength: 1, maxLength: 21 }),
    items: fc.array(arbValidActiveChecklistItem(), { minLength: 0, maxLength: 10 }),
    streamTime: fc.oneof(
      fc.constant(null),
      fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(
        ([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      )
    ),
  });

/** Generates a valid ChecklistState */
const arbValidChecklistState = () =>
  fc.record({
    version: fc.constant(1),
    templates: fc.array(arbValidTemplate(), { minLength: 0, maxLength: 3 }),
    activeChecklist: fc.oneof(fc.constant(null), arbValidActiveChecklist()),
  });

/** Generates a valid TaskCard */
const arbValidTaskCard = () =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 21 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    weekday: fc.constantFrom(...WEEKDAYS),
    typeTag: fc.oneof(fc.constant(null), fc.constantFrom(...TYPE_TAGS)),
    completed: fc.boolean(),
    recurring: fc.boolean(),
    createdAt: fc.date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z') }).filter((d) => !isNaN(d.getTime())).map((d) => d.toISOString()),
  });

/** Generates a valid OrganizerState */
const arbValidOrganizerState = () =>
  fc.record({
    version: fc.constant(1),
    tasks: fc.array(arbValidTaskCard(), { minLength: 0, maxLength: 10 }),
  });

// === Mutation Strategies ===

type MutationType = 'remove_required_field' | 'wrong_type' | 'exceed_max_length' | 'invalid_enum';

/** Applies a mutation to a valid ChecklistState to make it invalid */
const mutateChecklistState = (state: Record<string, unknown>, mutation: MutationType): Record<string, unknown> => {
  const copy = JSON.parse(JSON.stringify(state));

  switch (mutation) {
    case 'remove_required_field':
      delete copy.templates;
      return copy;

    case 'wrong_type':
      copy.templates = 'not-an-array';
      return copy;

    case 'exceed_max_length':
      copy.templates = [
        {
          id: 'test-id',
          name: 'x'.repeat(101),
          categories: [{ id: 'cat-1', name: 'Cat', order: 0 }],
          items: [],
          createdAt: new Date().toISOString(),
        },
      ];
      return copy;

    case 'invalid_enum':
      copy.version = 'invalid';
      return copy;
  }
};

/** Applies a mutation to a valid OrganizerState to make it invalid */
const mutateOrganizerState = (state: Record<string, unknown>, mutation: MutationType): Record<string, unknown> => {
  const copy = JSON.parse(JSON.stringify(state));

  switch (mutation) {
    case 'remove_required_field':
      delete copy.tasks;
      return copy;

    case 'wrong_type':
      copy.tasks = 42;
      return copy;

    case 'exceed_max_length':
      copy.tasks = [
        {
          id: 'test-id',
          title: 'x'.repeat(101),
          weekday: 'monday',
          typeTag: null,
          completed: false,
          recurring: false,
          createdAt: new Date().toISOString(),
        },
      ];
      return copy;

    case 'invalid_enum':
      copy.tasks = [
        {
          id: 'test-id',
          title: 'Valid title',
          weekday: 'notaday',
          typeTag: null,
          completed: false,
          recurring: false,
          createdAt: new Date().toISOString(),
        },
      ];
      return copy;
  }
};

// === Tests ===

describe('Property 4: Zod validation rejects invalid payloads with field-level errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveChecklistState rejects invalid payloads without invoking the Data Layer', () => {
    it('mutated ChecklistState payloads are rejected with field-level errors and Prisma is never called', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidChecklistState(),
          fc.constantFrom<MutationType>('remove_required_field', 'wrong_type', 'exceed_max_length', 'invalid_enum'),
          async (validState, mutationType) => {
            vi.clearAllMocks();

            const mutated = mutateChecklistState(validState as unknown as Record<string, unknown>, mutationType);
            const result = await saveChecklistState(mutated);

            // The action must return an error
            expect(result.error).toBeDefined();
            expect(result.error!.fields).toBeDefined();
            expect(Array.isArray(result.error!.fields)).toBe(true);
            expect(result.error!.fields.length).toBeGreaterThan(0);

            // Each field entry must have a path (string) and message (non-empty string)
            for (const field of result.error!.fields) {
              expect(typeof field.path).toBe('string');
              expect(typeof field.message).toBe('string');
              expect(field.message.length).toBeGreaterThan(0);
            }

            // Prisma must NEVER be called when validation fails
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('saveOrganizerState rejects invalid payloads without invoking the Data Layer', () => {
    it('mutated OrganizerState payloads are rejected with field-level errors and Prisma is never called', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidOrganizerState(),
          fc.constantFrom<MutationType>('remove_required_field', 'wrong_type', 'exceed_max_length', 'invalid_enum'),
          async (validState, mutationType) => {
            vi.clearAllMocks();

            const mutated = mutateOrganizerState(validState as unknown as Record<string, unknown>, mutationType);
            const result = await saveOrganizerState(mutated);

            // The action must return an error
            expect(result.error).toBeDefined();
            expect(result.error!.fields).toBeDefined();
            expect(Array.isArray(result.error!.fields)).toBe(true);
            expect(result.error!.fields.length).toBeGreaterThan(0);

            // Each field entry must have a path (string) and message (non-empty string)
            for (const field of result.error!.fields) {
              expect(typeof field.path).toBe('string');
              expect(typeof field.message).toBe('string');
              expect(field.message.length).toBeGreaterThan(0);
            }

            // Prisma must NEVER be called when validation fails
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('importUserData rejects invalid checklist data without invoking the Data Layer', () => {
    it('invalid checklist data causes rejection with field-level errors and Prisma is never called', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidChecklistState(),
          arbValidOrganizerState(),
          fc.constantFrom<MutationType>('remove_required_field', 'wrong_type', 'exceed_max_length', 'invalid_enum'),
          async (validChecklist, validOrganizer, mutationType) => {
            vi.clearAllMocks();

            const mutatedChecklist = mutateChecklistState(
              validChecklist as unknown as Record<string, unknown>,
              mutationType
            );

            const result = await importUserData(mutatedChecklist, validOrganizer);

            // The action must return an error indicating the checklist dataset failed
            expect(result.error).toBeDefined();
            expect(result.dataset).toBe('checklist');
            expect(result.error!.fields).toBeDefined();
            expect(Array.isArray(result.error!.fields)).toBe(true);
            expect(result.error!.fields.length).toBeGreaterThan(0);

            // Each field entry must have a path (string) and message (non-empty string)
            for (const field of result.error!.fields) {
              expect(typeof field.path).toBe('string');
              expect(typeof field.message).toBe('string');
              expect(field.message.length).toBeGreaterThan(0);
            }

            // Prisma must NEVER be called when validation fails
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('importUserData rejects invalid organizer data without invoking the Data Layer', () => {
    it('invalid organizer data causes rejection with field-level errors and Prisma is never called', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbValidChecklistState(),
          arbValidOrganizerState(),
          fc.constantFrom<MutationType>('remove_required_field', 'wrong_type', 'exceed_max_length', 'invalid_enum'),
          async (validChecklist, validOrganizer, mutationType) => {
            vi.clearAllMocks();

            const mutatedOrganizer = mutateOrganizerState(
              validOrganizer as unknown as Record<string, unknown>,
              mutationType
            );

            const result = await importUserData(validChecklist, mutatedOrganizer);

            // The action must return an error indicating the organizer dataset failed
            expect(result.error).toBeDefined();
            expect(result.dataset).toBe('organizer');
            expect(result.error!.fields).toBeDefined();
            expect(Array.isArray(result.error!.fields)).toBe(true);
            expect(result.error!.fields.length).toBeGreaterThan(0);

            // Each field entry must have a path (string) and message (non-empty string)
            for (const field of result.error!.fields) {
              expect(typeof field.path).toBe('string');
              expect(typeof field.message).toBe('string');
              expect(field.message.length).toBeGreaterThan(0);
            }

            // Prisma must NEVER be called when validation fails
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
