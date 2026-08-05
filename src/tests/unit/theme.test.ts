/**
 * Unit tests for the theme engine (src/lib/theme-context.tsx)
 * Validates: Requirements 9.1, 9.2, 9.5, 9.6
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
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  describe('Default dark mode', () => {
    it('defaults to dark when no stored preference exists', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Toggle persists to localStorage', () => {
    it('persists new theme value to localStorage after toggle', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEYS.theme, 'light');
      expect(result.current.theme).toBe('light');
    });

    it('toggles back to dark and persists', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // Toggle to light
      act(() => {
        result.current.toggleTheme();
      });

      // Toggle back to dark
      act(() => {
        result.current.toggleTheme();
      });

      expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEYS.theme, 'dark');
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('Invalid stored value falls back to dark', () => {
    it('falls back to dark when localStorage contains an invalid value', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'invalid' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('falls back to dark when localStorage contains an empty string', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: '' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Class application on document element', () => {
    it('removes dark class after toggling to light', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // Should start with dark class
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => {
        result.current.toggleTheme();
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('re-adds dark class after toggling back from light', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // Toggle to light
      act(() => {
        result.current.toggleTheme();
      });
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Toggle back to dark
      act(() => {
        result.current.toggleTheme();
      });
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Light mode on load', () => {
    it('loads with light theme when localStorage has light stored', () => {
      mockStorage = createStorageMock({ [STORAGE_KEYS.theme]: 'light' });
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
