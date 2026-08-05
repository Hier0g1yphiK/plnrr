/**
 * Unit tests for schema versioning and migration logic (src/lib/migrations.ts)
 * Validates: Requirements 8.7
 */
import { describe, it, expect } from 'vitest';
import {
  runMigrations,
  createMigrateFn,
  checklistMigrations,
  organizerMigrations,
  type MigrationRegistry,
} from '@/lib/migrations';

describe('Schema Versioning and Migration Logic', () => {
  describe('runMigrations', () => {
    it('returns data unchanged when fromVersion >= currentVersion', () => {
      const data = { version: 1, templates: [], activeChecklist: null };
      const registry: MigrationRegistry = {
        currentVersion: 1,
        migrations: [],
      };

      const result = runMigrations(data, 1, registry);
      expect(result).toBe(data); // same reference, no transformation
    });

    it('returns data unchanged when fromVersion > currentVersion', () => {
      const data = { version: 2, templates: [] };
      const registry: MigrationRegistry = {
        currentVersion: 1,
        migrations: [],
      };

      const result = runMigrations(data, 2, registry);
      expect(result).toBe(data);
    });

    it('runs a single migration from v1 to v2', () => {
      const data = { version: 1, templates: [] };
      const registry: MigrationRegistry = {
        currentVersion: 2,
        migrations: [
          {
            toVersion: 2,
            migrate: (d) => ({ ...(d as object), newField: 'default', version: 2 }),
          },
        ],
      };

      const result = runMigrations(data, 1, registry) as Record<string, unknown>;
      expect(result.version).toBe(2);
      expect(result.newField).toBe('default');
      expect(result.templates).toEqual([]);
    });

    it('runs sequential migrations from v1 to v3', () => {
      const data = { version: 1, name: 'test' };
      const registry: MigrationRegistry = {
        currentVersion: 3,
        migrations: [
          {
            toVersion: 2,
            migrate: (d) => ({ ...(d as object), fieldA: 'added-in-v2', version: 2 }),
          },
          {
            toVersion: 3,
            migrate: (d) => ({ ...(d as object), fieldB: 'added-in-v3', version: 3 }),
          },
        ],
      };

      const result = runMigrations(data, 1, registry) as Record<string, unknown>;
      expect(result.version).toBe(3);
      expect(result.name).toBe('test');
      expect(result.fieldA).toBe('added-in-v2');
      expect(result.fieldB).toBe('added-in-v3');
    });

    it('runs only applicable migrations when starting from v2 to v4', () => {
      const data = { version: 2, existing: true };
      const registry: MigrationRegistry = {
        currentVersion: 4,
        migrations: [
          {
            toVersion: 2,
            migrate: (d) => ({ ...(d as object), shouldNotRun: true, version: 2 }),
          },
          {
            toVersion: 3,
            migrate: (d) => ({ ...(d as object), fromV2ToV3: true, version: 3 }),
          },
          {
            toVersion: 4,
            migrate: (d) => ({ ...(d as object), fromV3ToV4: true, version: 4 }),
          },
        ],
      };

      const result = runMigrations(data, 2, registry) as Record<string, unknown>;
      expect(result.version).toBe(4);
      expect(result.existing).toBe(true);
      expect(result.shouldNotRun).toBeUndefined(); // v1→v2 migration should NOT run
      expect(result.fromV2ToV3).toBe(true);
      expect(result.fromV3ToV4).toBe(true);
    });

    it('handles migrations in any order in the registry (sorts by toVersion)', () => {
      const data = { version: 1 };
      const registry: MigrationRegistry = {
        currentVersion: 3,
        migrations: [
          // Intentionally out of order
          {
            toVersion: 3,
            migrate: (d) => {
              const obj = d as Record<string, unknown>;
              return { ...obj, order: (obj.order as string) + ',3', version: 3 };
            },
          },
          {
            toVersion: 2,
            migrate: (d) => ({ ...(d as object), order: '2', version: 2 }),
          },
        ],
      };

      const result = runMigrations(data, 1, registry) as Record<string, unknown>;
      expect(result.version).toBe(3);
      expect(result.order).toBe('2,3'); // v2 ran first, then v3
    });

    it('returns data unchanged when no migrations are applicable', () => {
      const data = { version: 1 };
      const registry: MigrationRegistry = {
        currentVersion: 2,
        migrations: [], // No migrations defined even though version gap exists
      };

      const result = runMigrations(data, 1, registry);
      expect(result).toBe(data);
    });
  });

  describe('createMigrateFn', () => {
    it('returns a function compatible with PersistenceConfig.migrate', () => {
      const registry: MigrationRegistry = {
        currentVersion: 2,
        migrations: [
          {
            toVersion: 2,
            migrate: (d) => ({ ...(d as object), migrated: true, version: 2 }),
          },
        ],
      };

      const migrateFn = createMigrateFn(registry);
      expect(typeof migrateFn).toBe('function');

      const result = migrateFn({ version: 1, data: 'hello' }, 1) as Record<string, unknown>;
      expect(result.migrated).toBe(true);
      expect(result.data).toBe('hello');
      expect(result.version).toBe(2);
    });

    it('passes through data unchanged when versions match', () => {
      const registry: MigrationRegistry = {
        currentVersion: 1,
        migrations: [],
      };

      const migrateFn = createMigrateFn(registry);
      const data = { version: 1, stuff: 'things' };
      const result = migrateFn(data, 1);
      expect(result).toBe(data);
    });
  });

  describe('Default registries', () => {
    it('checklistMigrations has currentVersion 2 with one migration', () => {
      expect(checklistMigrations.currentVersion).toBe(2);
      expect(checklistMigrations.migrations).toHaveLength(1);
      expect(checklistMigrations.migrations[0].toVersion).toBe(2);
    });

    it('organizerMigrations has currentVersion 1 and no migrations', () => {
      expect(organizerMigrations.currentVersion).toBe(1);
      expect(organizerMigrations.migrations).toEqual([]);
    });

    it('checklistMigrations migrate fn upgrades data from v1 to v2', () => {
      const migrateFn = createMigrateFn(checklistMigrations);
      const data = { version: 1, templates: [], activeChecklist: null };
      const result = migrateFn(data, 1) as Record<string, unknown>;
      // v1 data at currentVersion 2: fromVersion (1) < currentVersion (2), so migration runs
      // But since fromVersion >= currentVersion check uses >=, and 1 < 2, migration applies
      expect(result.version).toBe(2);
      expect(result.templates).toEqual([]);
      expect(result.activeChecklist).toBeNull();
    });

    it('checklistMigrations migrate fn passes data through for v2', () => {
      const migrateFn = createMigrateFn(checklistMigrations);
      const data = { version: 2, templates: [], activeChecklist: null };
      expect(migrateFn(data, 2)).toBe(data);
    });

    it('organizerMigrations migrate fn passes data through for v1', () => {
      const migrateFn = createMigrateFn(organizerMigrations);
      const data = { version: 1, tasks: [] };
      expect(migrateFn(data, 1)).toBe(data);
    });
  });
});
