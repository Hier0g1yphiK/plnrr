'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface HydrationContextValue {
  hydrated: boolean;
}

const HydrationContext = createContext<HydrationContextValue>({ hydrated: false });

/**
 * Tracks client-side hydration state. The `hydrated` flag becomes true
 * after the first client render, indicating that localStorage has been
 * read and state providers have initialized.
 */
export function HydrationProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <HydrationContext value={{ hydrated }}>
      {children}
    </HydrationContext>
  );
}

export function useHydration(): HydrationContextValue {
  return useContext(HydrationContext);
}
