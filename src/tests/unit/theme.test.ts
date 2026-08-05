/**
 * Unit tests for the theme engine (src/lib/theme-context.tsx)
 * Validates: Theme switching, persistence, migration from old values, class application
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { STORAGE_KEYS } from '@/lib/persistence';

// === Test Helpers ===

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, null, children);
}

function createStorageMock(initial: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

// === Tests ===

describe('Theme Engine', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createStorageMock();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  describe('Default theme', () => {
    it('defaults to fairy-dark when no stored preference exists', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-dark');
      expect(result.current.isDark).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('fairy-dark')).toBe(true);
    });
  });

  describe('setTheme persists to localStorage', () => {
    it('persists new theme value to localStorage', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('circuit-light');
      });

      expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEYS.theme, 'circuit-light');
      expect(result.current.theme).toBe('circuit-light');
      expect(result.current.isDark).toBe(false);
    });

    it('switches between all four themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('fairy-light'); });
      expect(result.current.theme).toBe('fairy-light');
      expect(result.current.isDark).toBe(false);

      act(() => { result.current.setTheme('circuit-dark'); });
      expect(result.current.theme).toBe('circuit-dark');
      expect(result.current.isDark).toBe(true);

      act(() => { result.current.setTheme('circuit-light'); });
      expect(result.current.theme).toBe('circuit-light');
      expect(result.current.isDark).toBe(false);

      act(() => { result.current.setTheme('fairy-dark'); });
      expect(result.current.theme).toBe('fairy-dark');
      expect(result.current.isDark).toBe(true);
    });
  });

  describe('Migration from old theme values', () => {
    it('migrates old "dark" value to fairy-dark', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'dark' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('migrates old "light" value to fairy-light', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'light' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Invalid stored value falls back to fairy-dark', () => {
    it('falls back to fairy-dark when localStorage contains an invalid value', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'invalid' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('falls back to fairy-dark when localStorage contains an empty string', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: '' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Class application on document element', () => {
    it('applies theme class and dark class for dark themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('circuit-dark'); });

      expect(document.documentElement.classList.contains('circuit-dark')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      // Old theme class should be removed
      expect(document.documentElement.classList.contains('fairy-dark')).toBe(false);
    });

    it('removes dark class for light themes', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('fairy-light'); });

      expect(document.documentElement.classList.contains('fairy-light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('only keeps one theme class at a time', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => { result.current.setTheme('circuit-light'); });
      act(() => { result.current.setTheme('fairy-dark'); });

      expect(document.documentElement.classList.contains('fairy-dark')).toBe(true);
      expect(document.documentElement.classList.contains('circuit-light')).toBe(false);
    });
  });

  describe('Loads persisted new theme values', () => {
    it('loads fairy-light from storage', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'fairy-light' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('fairy-light');
      expect(result.current.isDark).toBe(false);
    });

    it('loads circuit-dark from storage', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'circuit-dark' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('circuit-dark');
      expect(result.current.isDark).toBe(true);
    });
  });
});
