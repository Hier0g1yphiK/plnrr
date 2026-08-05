/**
 * Unit tests for "Other" category recovery on load
 * Validates: Requirements 2.8
 *
 * The ChecklistProvider now uses server-backed persistence (useServerPersistedReducer).
 * We mock the server actions (loadUserData, saveChecklistState) to return test data
 * and verify that the recovery logic (ensureOtherCategory) still runs on loaded state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the server actions module before importing the context
vi.mock('@/lib/actions', () => ({
  loadUserData: vi.fn(),
  saveChecklistState: vi.fn().mockResolvedValue({}),
}));

import { ChecklistProvider, useChecklist } from '@/lib/checklist-context';
import { loadUserData } from '@/lib/actions';

const mockLoadUserData = loadUserData as ReturnType<typeof vi.fn>;

// === Test Helpers ===

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ChecklistProvider, null, children);
}

function makeLoadResponse(templates: any[], activeChecklist: any = null) {
  return {
    checklistState: {
      version: 2,
      templates,
      activeChecklist,
    },
    organizerState: {
      version: 1,
      tasks: [],
    },
  };
}

// === Tests ===

describe('Other category recovery on load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recreates "Other" category when missing from a template', async () => {
    // Template stored without "Other" category (simulates data corruption)
    mockLoadUserData.mockResolvedValue(
      makeLoadResponse([
        {
          id: 'template-1',
          name: 'My Template',
          categories: [
            { id: 'cat-1', name: 'Software', order: 0 },
            { id: 'cat-2', name: 'Physical Setup', order: 1 },
          ],
          items: [
            { id: 'item-1', text: 'Start OBS', categoryId: 'cat-1', minutesBefore: null },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ])
    );

    const { result } = renderHook(() => useChecklist(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.templates).toHaveLength(1);
    });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(3); // Software, Physical Setup, + recovered Other
    const otherCategory = template.categories.find((c) => c.name === 'Other');
    expect(otherCategory).toBeDefined();
    expect(otherCategory!.order).toBe(2); // max(0,1) + 1 = 2
  });

  it('does not modify templates that already have "Other" category', async () => {
    mockLoadUserData.mockResolvedValue(
      makeLoadResponse([
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
      ])
    );

    const { result } = renderHook(() => useChecklist(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.templates).toHaveLength(1);
    });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(2);
    expect(template.categories[1].id).toBe('cat-other');
    expect(template.categories[1].name).toBe('Other');
  });

  it('recovers "Other" for multiple templates independently', async () => {
    mockLoadUserData.mockResolvedValue(
      makeLoadResponse([
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
      ])
    );

    const { result } = renderHook(() => useChecklist(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.templates).toHaveLength(3);
    });

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

  it('handles template with no categories by creating "Other" with order 0', async () => {
    mockLoadUserData.mockResolvedValue(
      makeLoadResponse([
        {
          id: 'template-1',
          name: 'Empty Template',
          categories: [],
          items: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ])
    );

    const { result } = renderHook(() => useChecklist(), { wrapper });

    await waitFor(() => {
      expect(result.current.state.templates).toHaveLength(1);
    });

    const template = result.current.state.templates[0];
    expect(template.categories).toHaveLength(1);
    const otherCategory = template.categories[0];
    expect(otherCategory.name).toBe('Other');
    expect(otherCategory.order).toBe(0); // max of empty = -1, -1+1 = 0
    expect(otherCategory.id).toBeTruthy(); // has a nanoid
  });
});
