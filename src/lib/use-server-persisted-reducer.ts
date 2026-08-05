'use client';

import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import type { Reducer, Dispatch } from 'react';

// === Types ===

export type SaveResult = {
  error?: { fields: Array<{ path: string; message: string }> };
};

export interface PersistenceError {
  message: string;
  retryable: boolean;
}

export interface UseServerPersistedReducerConfig<S> {
  saveFn: (state: S) => Promise<SaveResult>;
  loadFn?: () => Promise<S>;
}

// === Constants ===

const DEBOUNCE_MS = 500;
const LOAD_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// === Helpers ===

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Load timeout exceeded')),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

// === Hook ===

/**
 * A hook combining useReducer with server-backed persistence.
 * Replaces usePersistedReducer for authenticated users.
 *
 * - On mount: calls loadFn (with 10s timeout), shows loading state
 * - On state change: debounces 500ms, calls saveFn
 * - On failure: retries with exponential backoff (1s, 2s, 4s), max 3 attempts
 * - On all retries exhausted: sets persistent error, retains state in memory
 */
export function useServerPersistedReducer<S, A>(
  reducer: Reducer<S, A>,
  defaultValue: S,
  config: UseServerPersistedReducerConfig<S>
): {
  state: S;
  dispatch: Dispatch<A>;
  error: PersistenceError | null;
  loading: boolean;
} {
  const [state, rawDispatch] = useReducer(reducer, defaultValue);
  const [loading, setLoading] = useState(!!config.loadFn);
  const [error, setError] = useState<PersistenceError | null>(null);

  // Refs to avoid stale closures
  const stateRef = useRef(state);
  const configRef = useRef(config);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isLoadedRef = useRef(!config.loadFn);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // Keep refs in sync
  stateRef.current = state;
  configRef.current = config;

  // Load initial data on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (!config.loadFn) return;

    let cancelled = false;

    async function loadData() {
      try {
        const loaded = await withTimeout(config.loadFn!(), LOAD_TIMEOUT_MS);
        if (cancelled || !isMountedRef.current) return;

        // Apply loaded state by dispatching a special "replace" action.
        // Since we can't know the action type, we inject the state directly.
        setLoadedState(loaded);
        isLoadedRef.current = true;
        setError(null);
      } catch (err) {
        if (cancelled || !isMountedRef.current) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load data';
        setError({ message, retryable: true });
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We need a mechanism to inject loaded state into the reducer.
  // Use a separate state holder for the loaded data overlay.
  const [loadedOverride, setLoadedState] = useState<S | null>(null);

  // The effective state: use loaded override if present, otherwise reducer state
  const effectiveState = loadedOverride !== null ? loadedOverride : state;
  const effectiveStateRef = useRef(effectiveState);
  effectiveStateRef.current = effectiveState;

  // Custom dispatch that applies actions to either loaded state or reducer
  const dispatch: Dispatch<A> = useCallback(
    (action: A) => {
      if (loadedOverride !== null) {
        // Apply reducer to the loaded state and update override
        const nextState = reducer(loadedOverride, action);
        setLoadedState(nextState);
      } else {
        rawDispatch(action);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedOverride, reducer]
  );

  // Save with retry logic
  const saveWithRetry = useCallback(
    async (stateToSave: S) => {
      isSavingRef.current = true;

      for (let attempt = 0; attempt <= MAX_RETRIES - 1; attempt++) {
        try {
          const result = await configRef.current.saveFn(stateToSave);

          if (!isMountedRef.current) return;

          if (result.error) {
            // Validation errors are not retryable
            setError({
              message: `Validation failed: ${result.error.fields.map((f) => f.message).join(', ')}`,
              retryable: false,
            });
            isSavingRef.current = false;
            return;
          }

          // Success — clear any previous error
          setError(null);
          isSavingRef.current = false;

          // If another save was queued while we were saving, trigger it
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            scheduleSave();
          }
          return;
        } catch (err) {
          if (!isMountedRef.current) return;

          if (attempt < MAX_RETRIES - 1) {
            // Wait before retrying: exponential backoff (1s, 2s, 4s)
            const retryDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
            await delay(retryDelay);
            if (!isMountedRef.current) return;
          } else {
            // All retries exhausted
            const message =
              err instanceof Error
                ? err.message
                : 'Failed to save changes after multiple attempts';
            setError({
              message: `Changes could not be saved: ${message}`,
              retryable: false,
            });
          }
        }
      }

      isSavingRef.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Schedule a debounced save
  const scheduleSave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const currentState = effectiveStateRef.current;

      if (isSavingRef.current) {
        // Mark that we need to save again after current save completes
        pendingSaveRef.current = true;
        return;
      }

      saveWithRetry(currentState);
    }, DEBOUNCE_MS);
  }, [saveWithRetry]);

  // Track state changes and trigger debounced save (skip initial/load)
  const isFirstRenderRef = useRef(true);
  const previousStateRef = useRef(effectiveState);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousStateRef.current = effectiveState;
      return;
    }

    // Don't save while still loading
    if (loading) {
      previousStateRef.current = effectiveState;
      return;
    }

    // Only trigger save if state actually changed
    if (effectiveState !== previousStateRef.current) {
      previousStateRef.current = effectiveState;
      scheduleSave();
    }
  }, [effectiveState, loading, scheduleSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return { state: effectiveState, dispatch, error, loading };
}
