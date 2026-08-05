'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { ThemeName } from '@/lib/types';
import { readStorageValue, writeStorageValue, STORAGE_KEYS } from '@/lib/persistence';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID_THEMES: ThemeName[] = ['fairy-light', 'fairy-dark', 'circuit-light', 'circuit-dark'];

function isValidTheme(value: string | null): value is ThemeName {
  return VALID_THEMES.includes(value as ThemeName);
}

/** Map old 'dark'/'light' values to new theme names for backwards compat */
function migrateOldTheme(value: string | null): ThemeName {
  if (isValidTheme(value)) return value;
  if (value === 'dark') return 'fairy-dark';
  if (value === 'light') return 'fairy-light';
  return 'fairy-dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('fairy-dark');

  useEffect(() => {
    const stored = readStorageValue(STORAGE_KEYS.theme);
    const initial = migrateOldTheme(stored);
    setThemeState(initial);
    applyThemeToDocument(initial);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyThemeToDocument(next);
    writeStorageValue(STORAGE_KEYS.theme, next);
  }, []);

  const isDark = theme.endsWith('-dark');

  return (
    <ThemeContext value={{ theme, setTheme, isDark }}>
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

/** Apply theme class + dark mode class to <html> */
function applyThemeToDocument(theme: ThemeName) {
  const root = document.documentElement;

  // Remove all theme classes
  root.classList.remove('dark', 'fairy-light', 'fairy-dark', 'circuit-light', 'circuit-dark');

  // Add new theme class
  root.classList.add(theme);

  // Add 'dark' class for dark variants (Tailwind dark: variant support)
  if (theme.endsWith('-dark')) {
    root.classList.add('dark');
  }
}
