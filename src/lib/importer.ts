'use client';

import { STORAGE_KEYS } from '@/lib/persistence';
import {
  runMigrations,
  checklistMigrations,
  organizerMigrations,
} from '@/lib/migrations';
import { ChecklistStateSchema, OrganizerStateSchema } from '@/lib/schemas';
import { importUserData, checkImportEligibility } from '@/lib/actions';

// === Types ===

export interface ImportResult {
  success: boolean;
  checklistImported: boolean;
  organizerImported: boolean;
  errors: Array<{ dataset: 'checklist' | 'organizer'; message: string }>;
}

// === Default States ===

const DEFAULT_CHECKLIST_STATE = {
  version: checklistMigrations.currentVersion,
  templates: [],
  activeChecklist: null,
};

const DEFAULT_ORGANIZER_STATE = {
  version: organizerMigrations.currentVersion,
  tasks: [],
};

// === Public API ===

/**
 * Check if user is eligible for import (has no server data, import not completed).
 * Calls the checkImportEligibility server action.
 */
export async function isImportEligible(): Promise<boolean> {
  try {
    const { eligible } = await checkImportEligibility();
    return eligible;
  } catch {
    return false;
  }
}

/**
 * Check if there's importable data in localStorage.
 * Returns true if at least one key contains non-default data
 * (at least one template or at least one task).
 */
export function hasLocalStorageData(): boolean {
  try {
    const checklistRaw = localStorage.getItem(STORAGE_KEYS.checklist);
    const organizerRaw = localStorage.getItem(STORAGE_KEYS.organizer);

    const hasChecklistData = hasNonDefaultChecklist(checklistRaw);
    const hasOrganizerData = hasNonDefaultOrganizer(organizerRaw);

    return hasChecklistData || hasOrganizerData;
  } catch {
    return false;
  }
}

/**
 * Run the import: read localStorage, migrate, validate, write to server.
 * Handles partial success — if one dataset is valid and the other isn't,
 * the valid one is still imported.
 */
export async function runImport(): Promise<ImportResult> {
  const errors: ImportResult['errors'] = [];
  let checklistImported = false;
  let organizerImported = false;

  // Step 1: Read and process checklist data
  const checklistResult = processLocalStorageData(
    STORAGE_KEYS.checklist,
    'checklist',
    checklistMigrations,
    ChecklistStateSchema
  );

  if (!checklistResult.success) {
    errors.push({ dataset: 'checklist', message: checklistResult.error });
  }

  // Step 2: Read and process organizer data
  const organizerResult = processLocalStorageData(
    STORAGE_KEYS.organizer,
    'organizer',
    organizerMigrations,
    OrganizerStateSchema
  );

  if (!organizerResult.success) {
    errors.push({ dataset: 'organizer', message: organizerResult.error });
  }

  // Step 3: Determine what to send to the server
  // If both fail, nothing to import
  if (!checklistResult.success && !organizerResult.success) {
    return {
      success: false,
      checklistImported: false,
      organizerImported: false,
      errors,
    };
  }

  // Use validated data or defaults for failed datasets
  const checklistPayload = checklistResult.success
    ? checklistResult.data
    : DEFAULT_CHECKLIST_STATE;
  const organizerPayload = organizerResult.success
    ? organizerResult.data
    : DEFAULT_ORGANIZER_STATE;

  // Step 4: Call importUserData server action
  try {
    const serverResult = await importUserData(checklistPayload, organizerPayload);

    if (serverResult.error) {
      const failedDataset = serverResult.dataset ?? 'checklist';
      errors.push({
        dataset: failedDataset,
        message: `Server validation failed: ${serverResult.error.fields.map((f) => `${f.path}: ${f.message}`).join(', ')}`,
      });

      // If server rejected due to one dataset, the other may still have been valid
      // but since importUserData is transactional, nothing was written
      return {
        success: false,
        checklistImported: false,
        organizerImported: false,
        errors,
      };
    }

    // Success
    checklistImported = checklistResult.success;
    organizerImported = organizerResult.success;

    return {
      success: true,
      checklistImported,
      organizerImported,
      errors,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown server error during import';
    errors.push({ dataset: 'checklist', message: `Server write failed: ${message}` });

    return {
      success: false,
      checklistImported: false,
      organizerImported: false,
      errors,
    };
  }
}

// === Internal Helpers ===

interface ProcessSuccess {
  success: true;
  data: unknown;
}

interface ProcessFailure {
  success: false;
  error: string;
}

type ProcessResult = ProcessSuccess | ProcessFailure;

/**
 * Read a localStorage key, parse JSON, run migrations, validate with Zod.
 * Returns the validated data or an error message.
 */
function processLocalStorageData(
  storageKey: string,
  datasetName: string,
  registry: typeof checklistMigrations,
  schema: typeof ChecklistStateSchema | typeof OrganizerStateSchema
): ProcessResult {
  // Read from localStorage
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return { success: false, error: `Failed to read ${datasetName} from localStorage` };
  }

  // Missing key → treat as empty/default (not an error, but nothing to import)
  if (raw === null) {
    return { success: false, error: `No ${datasetName} data found in localStorage` };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: `Failed to parse ${datasetName} data: invalid JSON` };
  }

  // Extract version (default to 1 if missing)
  let version = 1;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in parsed &&
    typeof (parsed as Record<string, unknown>).version === 'number'
  ) {
    version = (parsed as Record<string, unknown>).version as number;
  }

  // Run migrations
  let migrated: unknown;
  try {
    migrated = runMigrations(parsed, version, registry);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown migration error';
    return {
      success: false,
      error: `Migration failed for ${datasetName}: ${message}`,
    };
  }

  // Validate with Zod
  const result = schema.safeParse(migrated);
  if (!result.success) {
    const fieldErrors = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      success: false,
      error: `Validation failed for ${datasetName}: ${fieldErrors}`,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Check if raw checklist JSON contains non-default data (at least one template).
 */
function hasNonDefaultChecklist(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const templates = (parsed as Record<string, unknown>).templates;
    return Array.isArray(templates) && templates.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if raw organizer JSON contains non-default data (at least one task).
 */
function hasNonDefaultOrganizer(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return false;
    const tasks = (parsed as Record<string, unknown>).tasks;
    return Array.isArray(tasks) && tasks.length > 0;
  } catch {
    return false;
  }
}
