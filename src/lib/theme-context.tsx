'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ThemePreference } from '@/lib/types';
import { readStorageValue, writeStorageValue, STORAGE_KEYS } from '@/lib/persistence';

interface ThemeContextValue {
  theme: ThemePreference;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>('dark');

  // Read initial theme from localStorage on mount
  useEffect(() => {
    const stored = readStorageValue(STORAGE_KEYS.theme);
    const initial: ThemePreference = isValidTheme(stored) ? stored : 'dark';
    setTheme(initial);

    // Sync the document class with the resolved theme
    if (initial === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ThemePreference = current === 'dark' ? 'light' : 'dark';

      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      writeStorageValue(STORAGE_KEYS.theme, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
