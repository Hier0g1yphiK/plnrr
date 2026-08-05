/**
 * Schema versioning and migration logic for the persistence layer.
 *
 * Each domain (checklist, organizer) maintains its own migration registry.
 * Migrations are functions that transform data from one schema version to the next.
 * They run sequentially: v1→v2, v2→v3, etc.
 *
 * Validates: Requirements 8.7
 */

// === Types ===

/**
 * A migration function takes data from version N and returns data for version N+1.
 * The input and output are loosely typed (unknown) because the shape changes between versions.
 */
export type MigrationFn = (data: unknown) => unknown;

/**
 * A migration entry pairs a target version with its migration function.
 * The function transforms data FROM (targetVersion - 1) TO targetVersion.
 */
export interface MigrationEntry {
  toVersion: number;
  migrate: MigrationFn;
}

/**
 * A migration registry holds an ordered list of migrations for a domain.
 */
export interface MigrationRegistry {
  currentVersion: number;
  migrations: MigrationEntry[];
}

// === Checklist Migrations ===

/**
 * Migration registry for ChecklistState.
 * Current version: 1. No migrations yet — the array is empty.
 * Future migrations should be added in order: { toVersion: 2, migrate: v1ToV2 }, etc.
 */
export const checklistMigrations: MigrationRegistry = {
  currentVersion: 1,
  migrations: [
    // Example for future use:
    // { toVersion: 2, migrate: (data) => ({ ...data, newField: 'default', version: 2 }) },
  ],
};

// === Organizer Migrations ===

/**
 * Migration registry for OrganizerState.
 * Current version: 1. No migrations yet — the array is empty.
 * Future migrations should be added in order: { toVersion: 2, migrate: v1ToV2 }, etc.
 */
export const organizerMigrations: MigrationRegistry = {
  currentVersion: 1,
  migrations: [
    // Example for future use:
    // { toVersion: 2, migrate: (data) => ({ ...data, newField: [], version: 2 }) },
  ],
};

// === Migration Runner ===

/**
 * Runs the migration chain for a given registry, starting from `fromVersion`
 * up to the registry's current version.
 *
 * If fromVersion >= currentVersion, returns data unchanged.
 * If fromVersion < 1 or no matching migrations exist, returns data unchanged.
 *
 * @param data - The stored data to migrate
 * @param fromVersion - The version the stored data is at
 * @param registry - The migration registry for this domain
 * @returns The migrated data at the current version
 */
export function runMigrations(
  data: unknown,
  fromVersion: number,
  registry: MigrationRegistry
): unknown {
  if (fromVersion >= registry.currentVersion) {
    return data;
  }

  let current = data;

  // Run each migration whose target version is > fromVersion and <= currentVersion
  const applicableMigrations = registry.migrations
    .filter((m) => m.toVersion > fromVersion && m.toVersion <= registry.currentVersion)
    .sort((a, b) => a.toVersion - b.toVersion);

  for (const migration of applicableMigrations) {
    current = migration.migrate(current);
  }

  return current;
}

/**
 * Creates a migrate function suitable for use in PersistenceConfig.
 * This wraps runMigrations with the appropriate registry.
 *
 * @param registry - The migration registry for the domain
 * @returns A function compatible with PersistenceConfig.migrate
 */
export function createMigrateFn(
  registry: MigrationRegistry
): (data: unknown, fromVersion: number) => unknown {
  return (data: unknown, fromVersion: number) =>
    runMigrations(data, fromVersion, registry);
}
