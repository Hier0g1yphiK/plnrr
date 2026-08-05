'use client';

import { useEffect, useRef, useState, useReducer } from 'react';
import type { Reducer, Dispatch } from 'react';
import type { ZodType } from 'zod';

// === Storage Keys ===

export const STORAGE_KEYS = {
  checklist: 'plnrr:checklist',
  organizer: 'plnrr:organizer',
  theme: 'plnrr:theme',
  lastReset: 'plnrr:lastReset',
} as const;

// === Error Types ===

export type PersistenceErrorKind =
  | 'unavailable'
  | 'quota_exceeded'
  | 'corrupted'
  | 'write_failed';

export interface PersistenceError {
  kind: PersistenceErrorKind;
  message: string;
}

// === Configuration ===

export interface PersistenceConfig<T> {
  key: string;
  version: number;
  schema: ZodType<T>;
  migrate: (data: unknown, fromVersion: number) => unknown;
}

// === Helpers ===

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__plnrr_ls_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function readFromStorage<T>(
  config: PersistenceConfig<T>,
  defaultValue: T
): { value: T; error: PersistenceError | null } {
  if (!isLocalStorageAvailable()) {
    return {
      value: defaultValue,
      error: { kind: 'unavailable', message: 'localStorage is not available. Changes will not persist across reloads.' },
    };
  }

  const raw = localStorage.getItem(config.key);

  if (raw === null) {
    return { value: defaultValue, error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      value: defaultValue,
      error: { kind: 'corrupted', message: 'Stored data could not be parsed. Starting with defaults.' },
    };
  }

  // Check version and migrate if needed
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in parsed &&
    typeof (parsed as Record<string, unknown>).version === 'number'
  ) {
    const storedVersion = (parsed as Record<string, unknown>).version as number;
    if (storedVersion < config.version) {
      parsed = config.migrate(parsed, storedVersion);
    }
  }

  // Validate with Zod (strips unknown fields and applies defaults)
  const result = config.schema.safeParse(parsed);

  if (result.success) {
    return { value: result.data, error: null };
  }

  return {
    value: defaultValue,
    error: { kind: 'corrupted', message: 'Stored data failed validation. Starting with defaults.' },
  };
}

function writeToStorage<T>(key: string, value: T): PersistenceError | null {
  if (!isLocalStorageAvailable()) {
    return { kind: 'unavailable', message: 'localStorage is not available. Changes will not persist across reloads.' };
  }

  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return null;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      return { kind: 'quota_exceeded', message: 'Storage quota exceeded. Changes are preserved in memory but could not be saved.' };
    }
    return { kind: 'write_failed', message: 'Failed to write to localStorage. Changes are preserved in memory.' };
  }
}

// === Hook ===

/**
 * A hook combining useReducer with localStorage persistence.
 * Reads persisted state on mount, validates with Zod, and debounces writes.
 * Optional `postLoad` transform is applied to loaded state before use (e.g. data recovery).
 */
export function usePersistedReducer<S, A>(
  reducer: Reducer<S, A>,
  defaultValue: S,
  config: PersistenceConfig<S>,
  postLoad?: (state: S) => S
): {
  state: S;
  dispatch: Dispatch<A>;
  error: PersistenceError | null;
} {
  // Read persisted state synchronously on initial render
  const [initResult] = useState(() => {
    const result = readFromStorage(config, defaultValue);
    if (postLoad) {
      return { value: postLoad(result.value), error: result.error };
    }
    return result;
  });

  const [state, dispatch] = useReducer(reducer, initResult.value);
  const [error, setError] = useState<PersistenceError | null>(initResult.error);

  // Track whether this is the first render (skip persisting the initial state)
  const isFirstRender = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write effect
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const writeError = writeToStorage(config.key, state);
      if (writeError) {
        setError(writeError);
      } else if (error !== null) {
        // Clear previous write errors on success
        setError(null);
      }
    }, 100);

    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return { state, dispatch, error };
}

// === Simple value persistence (for theme, lastReset) ===

/**
 * Read a simple string value from localStorage.
 * Returns null if unavailable or key doesn't exist.
 */
export function readStorageValue(key: string): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }
  return localStorage.getItem(key);
}

/**
 * Write a simple string value to localStorage (no JSON wrapping).
 * Returns a PersistenceError if the write fails.
 */
export function writeStorageValue(key: string, value: string): PersistenceError | null {
  if (!isLocalStorageAvailable()) {
    return { kind: 'unavailable', message: 'localStorage is not available.' };
  }
  try {
    localStorage.setItem(key, value);
    return null;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      return { kind: 'quota_exceeded', message: 'Storage quota exceeded.' };
    }
    return { kind: 'write_failed', message: 'Failed to write to localStorage.' };
  }
}
