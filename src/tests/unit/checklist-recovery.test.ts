/**
 * Unit tests for "Other" category recovery on load
 * Validates: Requirements 2.8
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { ChecklistProvider, useChecklist } from '@/lib/checklist-context';

// === Test Helpers ===

function createStorageMock(data: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...data };
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

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ChecklistProvider, null, children);
}

// === Tests ===

describe('Other category recovery on load', () => {
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

  it('recreates "Other" category when missing from a template', () => {
    // Template stored without "Other" category (simulates data corruption)
    const storedState = {
      version: 1,
      templates: [
        {
          id: 'template-1',
          name: 'My Template',
          categories: [
            { id: 'cat-1', name: 'Software', order: 0 },
            { id: 'cat-2', name: 'Physical Setup', order: 1 },
          ],
          items: [
            { id: 'item-1', text: 'Start OBS', categoryId: 'cat-1' },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      activeChecklist: null,
    };

    const mockStorage = createStorageMock({
      'plnrr:checklist': JSON.stringify(storedState),
    });

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useChecklist(), { wrapper });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(3); // Software, Physical Setup, + recovered Other
    const otherCategory = template.categories.find((c) => c.name === 'Other');
    expect(otherCategory).toBeDefined();
    expect(otherCategory!.order).toBe(2); // max(0,1) + 1 = 2
  });

  it('does not modify templates that already have "Other" category', () => {
    const storedState = {
      version: 1,
      templates: [
        {
          id: 'template-1',
          name: 'My Template',
          categories: [
            { id: 'cat-1', name: 'Software', order: 0 },
            { id: 'cat-other', name: 'Other', order: 1 },
          ],
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      activeChecklist: null,
    };

    const mockStorage = createStorageMock({
      'plnrr:checklist': JSON.stringify(storedState),
    });

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useChecklist(), { wrapper });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(2);
    expect(template.categories[1].id).toBe('cat-other');
    expect(template.categories[1].name).toBe('Other');
  });

  it('recovers "Other" for multiple templates independently', () => {
    const storedState = {
      version: 1,
      templates: [
        {
          id: 'template-1',
          name: 'Template A',
          categories: [
            { id: 'cat-1', name: 'Software', order: 0 },
          ],
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'template-2',
          name: 'Template B',
          categories: [
            { id: 'cat-2', name: 'Content', order: 0 },
            { id: 'cat-3', name: 'Other', order: 1 },
          ],
          items: [],
          createdAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'template-3',
          name: 'Template C',
          categories: [
            { id: 'cat-4', name: 'Hardware', order: 0 },
            { id: 'cat-5', name: 'Software', order: 1 },
            { id: 'cat-6', name: 'Content', order: 2 },
          ],
          items: [],
          createdAt: '2024-01-03T00:00:00.000Z',
        },
      ],
      activeChecklist: null,
    };

    const mockStorage = createStorageMock({
      'plnrr:checklist': JSON.stringify(storedState),
    });

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useChecklist(), { wrapper });

    // Template A: missing Other → recovered
    const templateA = result.current.state.templates[0];
    expect(templateA.categories).toHaveLength(2);
    expect(templateA.categories.find((c) => c.name === 'Other')).toBeDefined();

    // Template B: already has Other → unchanged
    const templateB = result.current.state.templates[1];
    expect(templateB.categories).toHaveLength(2);
    expect(templateB.categories[1].id).toBe('cat-3');

    // Template C: missing Other → recovered
    const templateC = result.current.state.templates[2];
    expect(templateC.categories).toHaveLength(4);
    const otherC = templateC.categories.find((c) => c.name === 'Other');
    expect(otherC).toBeDefined();
    expect(otherC!.order).toBe(3); // max(0,1,2) + 1 = 3
  });

  it('handles template with no categories by creating "Other" with order 0', () => {
    const storedState = {
      version: 1,
      templates: [
        {
          id: 'template-1',
          name: 'Empty Template',
          categories: [],
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      activeChecklist: null,
    };

    const mockStorage = createStorageMock({
      'plnrr:checklist': JSON.stringify(storedState),
    });

    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useChecklist(), { wrapper });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(1);
    const otherCategory = template.categories[0];
    expect(otherCategory.name).toBe('Other');
    expect(otherCategory.order).toBe(0); // max of empty = -1, -1+1 = 0
    expect(otherCategory.id).toBeTruthy(); // has a nanoid
  });
});
