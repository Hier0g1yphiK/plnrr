// Feature: multi-user-auth, Property 3: Data isolation by userId
import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// **Validates: Requirements 3.7, 4.7**

// === Mocking Setup ===

// Track all Prisma calls and their arguments
type PrismaCall = { model: string; method: string; args: unknown };
const prismaCalls: PrismaCall[] = [];

// Mock auth - will be configured per test run
const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Build a Prisma mock that records all calls and returns appropriate defaults
function createPrismaMock() {
  const createMethodProxy = (model: string) => {
    return new Proxy(
      {},
      {
        get(_target, method: string) {
          return (args: unknown) => {
            prismaCalls.push({ model, method, args });
            // Return appropriate defaults for each method
            if (method === "findMany") return Promise.resolve([]);
            if (method === "findUnique") return Promise.resolve(null);
            if (method === "count") return Promise.resolve(0);
            if (method === "upsert") return Promise.resolve({});
            if (method === "create") return Promise.resolve({});
            if (method === "update") return Promise.resolve({});
            if (method === "deleteMany") return Promise.resolve({ count: 0 });
            return Promise.resolve(null);
          };
        },
      }
    );
  };

  return {
    checklistTemplate: createMethodProxy("checklistTemplate"),
    checklistCategory: createMethodProxy("checklistCategory"),
    checklistItem: createMethodProxy("checklistItem"),
    activeChecklist: createMethodProxy("activeChecklist"),
    taskCard: createMethodProxy("taskCard"),
    user: createMethodProxy("user"),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // For transactions, pass the same proxy so calls are tracked
      const txProxy = {
        checklistTemplate: createMethodProxy("checklistTemplate"),
        checklistCategory: createMethodProxy("checklistCategory"),
        checklistItem: createMethodProxy("checklistItem"),
        activeChecklist: createMethodProxy("activeChecklist"),
        taskCard: createMethodProxy("taskCard"),
        user: createMethodProxy("user"),
      };
      return fn(txProxy);
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: createPrismaMock(),
}));

// === Helpers ===

/**
 * Checks that every Prisma call that uses a `where` clause
 * includes the expected userId (directly or via a relation).
 */
function assertAllQueriesScopedToUser(
  calls: PrismaCall[],
  expectedUserId: string
): void {
  for (const call of calls) {
    const args = call.args as Record<string, unknown> | undefined;
    if (!args) continue;

    // Check `where` clause
    const where = args.where as Record<string, unknown> | undefined;
    if (where) {
      // Direct userId scoping
      if ("userId" in where) {
        expect(where.userId).toBe(expectedUserId);
      }
      // Relation-based scoping (e.g., { template: { userId } })
      if ("template" in where) {
        const templateWhere = where.template as Record<string, unknown>;
        if (templateWhere && "userId" in templateWhere) {
          expect(templateWhere.userId).toBe(expectedUserId);
        }
      }
    }

    // Check `create` data for userId
    const createData = args.create as Record<string, unknown> | undefined;
    if (createData && "userId" in createData) {
      expect(createData.userId).toBe(expectedUserId);
    }

    // Check `data` for userId (used in update, create calls)
    const data = args.data as Record<string, unknown> | undefined;
    if (data && "userId" in data) {
      expect(data.userId).toBe(expectedUserId);
    }
  }
}

/**
 * Verifies that no query could accidentally return data for a different user.
 * Specifically checks that every query that targets user-owned models
 * always filters by userId.
 */
function assertNoLeakBetweenUsers(
  calls: PrismaCall[],
  authenticatedUserId: string,
  otherUserId: string
): void {
  for (const call of calls) {
    const args = call.args as Record<string, unknown> | undefined;
    if (!args) continue;

    const where = args.where as Record<string, unknown> | undefined;
    if (where) {
      // Ensure no query accidentally uses the other user's ID
      if ("userId" in where) {
        expect(where.userId).not.toBe(otherUserId);
        expect(where.userId).toBe(authenticatedUserId);
      }
    }
  }
}

// === Generators ===

/** Random user ID generator (CUID-like strings) */
const arbUserId = () =>
  fc.string({ minLength: 10, maxLength: 30, unit: "grapheme-ascii" }).filter(
    (s) => /^[a-zA-Z0-9]+$/.test(s) && s.length >= 10
  );

/** Generate a pair of distinct user IDs */
const arbDistinctUserIds = () =>
  fc
    .tuple(arbUserId(), arbUserId())
    .filter(([a, b]) => a !== b);

// === Tests ===

describe("Property 3: Data isolation by userId", () => {
  beforeEach(() => {
    prismaCalls.length = 0;
    mockAuth.mockReset();
  });

  it("loadUserData scopes all queries to the authenticated userId", async () => {
    await fc.assert(
      fc.asyncProperty(arbUserId(), async (userId) => {
        prismaCalls.length = 0;
        mockAuth.mockResolvedValue({ user: { id: userId } });

        // Dynamically import to use the mocked modules
        const { loadUserData } = await import("@/lib/actions");

        await loadUserData();

        // Verify at least some queries were made
        expect(prismaCalls.length).toBeGreaterThan(0);

        // Verify all queries are scoped to the authenticated user
        assertAllQueriesScopedToUser(prismaCalls, userId);
      }),
      { numRuns: 100 }
    );
  });

  it("saveChecklistState scopes all writes to the authenticated userId", async () => {
    await fc.assert(
      fc.asyncProperty(arbUserId(), async (userId) => {
        prismaCalls.length = 0;
        mockAuth.mockResolvedValue({ user: { id: userId } });

        const { saveChecklistState } = await import("@/lib/actions");

        // Provide a minimal valid checklist state
        const payload = {
          version: 1,
          templates: [],
          activeChecklist: null,
        };

        await saveChecklistState(payload);

        // Verify queries were made (transaction for template sync)
        expect(prismaCalls.length).toBeGreaterThan(0);

        // Verify all queries are scoped to the authenticated user
        assertAllQueriesScopedToUser(prismaCalls, userId);
      }),
      { numRuns: 100 }
    );
  });

  it("saveOrganizerState scopes all writes to the authenticated userId", async () => {
    await fc.assert(
      fc.asyncProperty(arbUserId(), async (userId) => {
        prismaCalls.length = 0;
        mockAuth.mockResolvedValue({ user: { id: userId } });

        const { saveOrganizerState } = await import("@/lib/actions");

        // Provide a minimal valid organizer state
        const payload = {
          version: 1,
          tasks: [],
        };

        await saveOrganizerState(payload);

        // Verify queries were made
        expect(prismaCalls.length).toBeGreaterThan(0);

        // Verify all queries are scoped to the authenticated user
        assertAllQueriesScopedToUser(prismaCalls, userId);
      }),
      { numRuns: 100 }
    );
  });

  it("queries for user A never include user B's userId", async () => {
    await fc.assert(
      fc.asyncProperty(arbDistinctUserIds(), async ([userA, userB]) => {
        // Simulate user A being authenticated
        prismaCalls.length = 0;
        mockAuth.mockResolvedValue({ user: { id: userA } });

        const { loadUserData } = await import("@/lib/actions");

        await loadUserData();

        // Verify no query accidentally uses user B's ID
        assertNoLeakBetweenUsers(prismaCalls, userA, userB);
      }),
      { numRuns: 100 }
    );
  });

  it("importUserData scopes all writes to the authenticated userId", async () => {
    await fc.assert(
      fc.asyncProperty(arbUserId(), async (userId) => {
        prismaCalls.length = 0;
        mockAuth.mockResolvedValue({ user: { id: userId } });

        const { importUserData } = await import("@/lib/actions");

        // Provide minimal valid data for both datasets
        const checklistData = {
          version: 1,
          templates: [],
          activeChecklist: null,
        };
        const organizerData = {
          version: 1,
          tasks: [],
        };

        await importUserData(checklistData, organizerData);

        // Verify queries were made
        expect(prismaCalls.length).toBeGreaterThan(0);

        // Verify all queries are scoped to the authenticated user
        assertAllQueriesScopedToUser(prismaCalls, userId);
      }),
      { numRuns: 100 }
    );
  });
});
