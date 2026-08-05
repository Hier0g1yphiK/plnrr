'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode, type Dispatch } from 'react';
import {
  usePersistedReducer,
  readStorageValue,
  writeStorageValue,
  STORAGE_KEYS,
  type PersistenceError,
} from '@/lib/persistence';
import { organizerReducer, type OrganizerAction } from '@/lib/organizer-reducer';
import { OrganizerStateSchema } from '@/lib/schemas';
import { createMigrateFn, organizerMigrations } from '@/lib/migrations';
import { shouldResetRecurringTasks, resetRecurringTasks } from '@/lib/recurrence';
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
  const { state, dispatch, error } = usePersistedReducer(
    organizerReducerWithReset,
    DEFAULT_ORGANIZER_STATE,
    {
      key: 'plnrr:organizer',
      version: organizerMigrations.currentVersion,
      schema: OrganizerStateSchema,
      migrate: createMigrateFn(organizerMigrations),
    }
  );

  const hasCheckedReset = useRef(false);

  useEffect(() => {
    if (hasCheckedReset.current) return;
    hasCheckedReset.current = true;

    const lastReset = readStorageValue(STORAGE_KEYS.lastReset);
    if (shouldResetRecurringTasks(lastReset)) {
      (dispatch as Dispatch<InternalOrganizerAction>)({ type: '__RESET_RECURRING' });
      writeStorageValue(STORAGE_KEYS.lastReset, new Date().toISOString());
    }
  }, [dispatch]);

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
