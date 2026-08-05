'use client';

import { createContext, useContext, type ReactNode, type Dispatch } from 'react';
import { nanoid } from 'nanoid';
import {
  useServerPersistedReducer,
  type PersistenceError,
} from '@/lib/use-server-persisted-reducer';
import { checklistReducer, type ChecklistAction } from '@/lib/checklist-reducer';
import { loadUserData, saveChecklistState } from '@/lib/actions';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import type { ChecklistState, Template, Category } from '@/lib/types';

interface ChecklistContextValue {
  state: ChecklistState;
  dispatch: Dispatch<ChecklistAction>;
  error: PersistenceError | null;
}

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

const DEFAULT_CHECKLIST_STATE: ChecklistState = {
  version: 2,
  templates: [],
  activeChecklist: null,
};

/**
 * Ensures each template has an "Other" category.
 * If missing (e.g. due to data corruption), recreates it as the last category.
 */
function ensureOtherCategory(template: Template): Template {
  const hasOther = template.categories.some((c) => c.name === 'Other');
  if (hasOther) return template;

  const maxOrder = template.categories.reduce(
    (max, c) => Math.max(max, c.order),
    -1
  );

  const otherCategory: Category = {
    id: nanoid(),
    name: 'Other',
    order: maxOrder + 1,
  };

  return {
    ...template,
    categories: [...template.categories, otherCategory],
  };
}

/**
 * Recovery logic applied after loading state from the server.
 * Checks each template for presence of "Other" category and recreates it if missing.
 */
function recoverChecklistState(state: ChecklistState): ChecklistState {
  const recoveredTemplates = state.templates.map(ensureOtherCategory);

  // Only return new state object if something changed
  if (recoveredTemplates.every((t, i) => t === state.templates[i])) {
    return state;
  }

  return {
    ...state,
    templates: recoveredTemplates,
  };
}

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const { state, dispatch, error, loading } = useServerPersistedReducer(
    checklistReducer,
    DEFAULT_CHECKLIST_STATE,
    {
      saveFn: (s: ChecklistState) => saveChecklistState(s),
      loadFn: async () => {
        const data = await loadUserData();
        return recoverChecklistState(data.checklistState);
      },
    }
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <ChecklistContext value={{ state, dispatch, error }}>
      {children}
    </ChecklistContext>
  );
}

export function useChecklist(): ChecklistContextValue {
  const ctx = useContext(ChecklistContext);
  if (!ctx) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }
  return ctx;
}
