/**
 * Unit tests for the persistence layer (src/lib/persistence.ts)
 * Validates: Requirements 8.3, 8.6, 8.7
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedReducer, type PersistenceConfig } from '@/lib/persistence';
import { ChecklistStateSchema } from '@/lib/schemas';
import type { ChecklistStateFromSchema } from '@/lib/schemas';

// === Test Reducer ===

type TestAction =
  | { type: 'ADD_TEMPLATE'; name: string }
  | { type: 'CLEAR_TEMPLATES' };

const defaultChecklistState: ChecklistStateFromSchema = {
  version: 1,
  templates: [],
  activeChecklist: null,
};

function testReducer(
  state: ChecklistStateFromSchema,
  action: TestAction
): ChecklistStateFromSchema {
  switch (action.type) {
    case 'ADD_TEMPLATE':
      return {
        ...state,
        templates: [
          ...state.templates,
          {
            id: 'test-id',
            name: action.name,
            categories: [],
            items: [],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };
    case 'CLEAR_TEMPLATES':
      return { ...state, templates: [] };
    default:
      return state;
  }
}

const testConfig: PersistenceConfig<ChecklistStateFromSchema> = {
  key: 'plnrr:checklist',
  version: 1,
  schema: ChecklistStateSchema,
  migrate: (data: unknown) => data,
};

// === Test Helpers ===

function createStorageMock(overrides: Partial<Storage> = {}): Storage {
  const store: Record<string, string> = {};
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
    ...overrides,
  };
}

// === Tests ===

describe('Persistence Layer', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('localStorage unavailable', () => {
    it('initializes with default state and returns unavailable error', () => {
      // Make localStorage throw on any access
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('localStorage is disabled');
        },
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      expect(result.current.state).toEqual(defaultChecklistState);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error!.kind).toBe('unavailable');
    });
  });

  describe('Quota exceeded', () => {
    it('reports quota_exceeded error when setItem throws QuotaExceededError', async () => {
      const mockStorage = createStorageMock({
        setItem: vi.fn((key: string, _value: string) => {
          // Allow the test key used by isLocalStorageAvailable
          if (key === '__plnrr_ls_test__') return;
          const err = new DOMException('Quota exceeded', 'QuotaExceededError');
          Object.defineProperty(err, 'code', { value: 22 });
          throw err;
        }),
      });

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      // Initial state should be fine (nothing stored yet)
      expect(result.current.state).toEqual(defaultChecklistState);
      expect(result.current.error).toBeNull();

      // Dispatch an action to trigger a write
      act(() => {
        result.current.dispatch({ type: 'ADD_TEMPLATE', name: 'Test' });
      });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // State updates in-memory but error is set
      expect(result.current.state.templates).toHaveLength(1);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error!.kind).toBe('quota_exceeded');
    });
  });

  describe('Corrupted JSON recovery', () => {
    it('initializes with defaults when stored JSON is invalid', () => {
      const mockStorage = createStorageMock();
      // Pre-populate with invalid JSON
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string) => {
          if (key === testConfig.key) return '{not valid json!!!';
          return null;
        }
      );

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      expect(result.current.state).toEqual(defaultChecklistState);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error!.kind).toBe('corrupted');
    });
  });

  describe('Invalid schema data recovery', () => {
    it('falls back to defaults when stored JSON does not match schema', () => {
      const mockStorage = createStorageMock();
      // Valid JSON but completely wrong structure for ChecklistState
      const invalidSchemaData = JSON.stringify({
        version: 1,
        templates: [{ id: 123, name: true }], // wrong types
        activeChecklist: 'not-an-object',
      });
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string) => {
          if (key === testConfig.key) return invalidSchemaData;
          return null;
        }
      );

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      expect(result.current.state).toEqual(defaultChecklistState);
      expect(result.current.error).not.toBeNull();
      expect(result.current.error!.kind).toBe('corrupted');
    });
  });

  describe('Unknown field stripping', () => {
    it('preserves recognized fields and strips unknown fields after round-trip', () => {
      const storedData = {
        version: 1,
        templates: [],
        activeChecklist: null,
        unknownField: 'should be stripped',
        anotherExtra: 42,
      };

      const mockStorage = createStorageMock();
      (mockStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
        (key: string) => {
          if (key === testConfig.key) return JSON.stringify(storedData);
          return null;
        }
      );

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      // Recognized fields preserved
      expect(result.current.state.version).toBe(1);
      expect(result.current.state.templates).toEqual([]);
      expect(result.current.state.activeChecklist).toBeNull();

      // Unknown fields stripped (not present in result)
      expect(result.current.state).not.toHaveProperty('unknownField');
      expect(result.current.state).not.toHaveProperty('anotherExtra');

      // No error because schema parse succeeds after stripping
      expect(result.current.error).toBeNull();
    });
  });

  describe('Debounce behavior', () => {
    it('batches rapid state changes into a single localStorage write', () => {
      const mockStorage = createStorageMock();

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      // Dispatch multiple actions rapidly
      act(() => {
        result.current.dispatch({ type: 'ADD_TEMPLATE', name: 'Template 1' });
      });
      act(() => {
        result.current.dispatch({ type: 'ADD_TEMPLATE', name: 'Template 2' });
      });
      act(() => {
        result.current.dispatch({ type: 'ADD_TEMPLATE', name: 'Template 3' });
      });

      // Before debounce fires, no localStorage writes (beyond initial availability check)
      const setItemCalls = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[0] === testConfig.key
      );
      expect(setItemCalls).toHaveLength(0);

      // Advance past debounce period (100ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Only one write should have occurred for the final state
      const setItemCallsAfter = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[0] === testConfig.key
      );
      expect(setItemCallsAfter).toHaveLength(1);

      // The written value should contain all 3 templates (final state)
      const writtenValue = JSON.parse(setItemCallsAfter[0][1]);
      expect(writtenValue.templates).toHaveLength(3);
    });

    it('does not write before debounce timer elapses', () => {
      const mockStorage = createStorageMock();

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePersistedReducer(testReducer, defaultChecklistState, testConfig)
      );

      act(() => {
        result.current.dispatch({ type: 'ADD_TEMPLATE', name: 'Template 1' });
      });

      // Advance only 50ms (less than 100ms debounce)
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const setItemCalls = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[0] === testConfig.key
      );
      expect(setItemCalls).toHaveLength(0);

      // Now advance the remaining time
      act(() => {
        vi.advanceTimersByTime(60);
      });

      const setItemCallsAfter = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[0] === testConfig.key
      );
      expect(setItemCallsAfter).toHaveLength(1);
    });
  });
});
