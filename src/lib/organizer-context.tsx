'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode, type Dispatch } from 'react';
import {
  useServerPersistedReducer,
  type PersistenceError,
} from '@/lib/use-server-persisted-reducer';
import {
  readStorageValue,
  writeStorageValue,
  STORAGE_KEYS,
} from '@/lib/persistence';
import { organizerReducer, type OrganizerAction } from '@/lib/organizer-reducer';
import { loadUserData, saveOrganizerState } from '@/lib/actions';
import { shouldResetRecurringTasks, resetRecurringTasks } from '@/lib/recurrence';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import type { OrganizerState } from '@/lib/types';

interface OrganizerContextValue {
  state: OrganizerState;
  dispatch: Dispatch<OrganizerAction>;
  error: PersistenceError | null;
}

const OrganizerContext = createContext<OrganizerContextValue | null>(null);

const DEFAULT_ORGANIZER_STATE: OrganizerState = {
  version: 1,
  tasks: [],
};

/**
 * Wraps the organizer reducer to handle a synthetic RESET_RECURRING action
 * dispatched on mount when a Monday boundary has been crossed.
 */
type InternalOrganizerAction = OrganizerAction | { type: '__RESET_RECURRING' };

function organizerReducerWithReset(
  state: OrganizerState,
  action: InternalOrganizerAction
): OrganizerState {
  if (action.type === '__RESET_RECURRING') {
    return resetRecurringTasks(state);
  }
  return organizerReducer(state, action as OrganizerAction);
}

export function OrganizerProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, error, loading } = useServerPersistedReducer(
    organizerReducerWithReset,
    DEFAULT_ORGANIZER_STATE,
    {
      saveFn: (s: OrganizerState) => saveOrganizerState(s),
      loadFn: async () => {
        const data = await loadUserData();
        return data.organizerState;
      },
    }
  );

  const hasCheckedReset = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (hasCheckedReset.current) return;
    hasCheckedReset.current = true;

    const lastReset = readStorageValue(STORAGE_KEYS.lastReset);
    if (shouldResetRecurringTasks(lastReset)) {
      (dispatch as Dispatch<InternalOrganizerAction>)({ type: '__RESET_RECURRING' });
      writeStorageValue(STORAGE_KEYS.lastReset, new Date().toISOString());
    }
  }, [dispatch, loading]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <OrganizerContext value={{ state, dispatch: dispatch as Dispatch<OrganizerAction>, error }}>
      {children}
    </OrganizerContext>
  );
}

export function useOrganizer(): OrganizerContextValue {
  const ctx = useContext(OrganizerContext);
  if (!ctx) {
    throw new Error('useOrganizer must be used within an OrganizerProvider');
  }
  return ctx;
}
