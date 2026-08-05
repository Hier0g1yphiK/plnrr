/**
 * Unit tests for the importer module (src/lib/importer.ts)
 * Validates: Requirements 7.2, 7.3, 7.5, 7.6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock server actions before importing the importer
vi.mock('@/lib/actions', () => ({
  importUserData: vi.fn(),
  checkImportEligibility: vi.fn(),
}));

import { isImportEligible, hasLocalStorageData, runImport } from '@/lib/importer';
import { importUserData, checkImportEligibility } from '@/lib/actions';

// === Test Helpers ===

function createStorageMock(store: Record<string, string> = {}): Storage {
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

const VALID_CHECKLIST_V2 = {
  version: 2,
  templates: [
    {
      id: 'tpl-1',
      name: 'Stream Prep',
      categories: [{ id: 'cat-1', name: 'Audio', order: 0 }],
      items: [
        { id: 'item-1', text: 'Check mic', categoryId: 'cat-1', minutesBefore: 30 },
      ],
      createdAt: '2024-01-15T10:00:00.000Z',
    },
  ],
  activeChecklist: null,
};

const VALID_CHECKLIST_V1 = {
  version: 1,
  templates: [
    {
      id: 'tpl-1',
      name: 'Stream Prep',
      categories: [{ id: 'cat-1', name: 'Audio', order: 0 }],
      items: [
        { id: 'item-1', text: 'Check mic', categoryId: 'cat-1' },
      ],
      createdAt: '2024-01-15T10:00:00.000Z',
    },
  ],
  activeChecklist: null,
};

const VALID_ORGANIZER = {
  version: 1,
  tasks: [
    {
      id: 'task-1',
      title: 'Edit video',
      weekday: 'monday',
      typeTag: 'editing',
      completed: false,
      recurring: true,
      createdAt: '2024-02-01T08:00:00.000Z',
    },
  ],
};

// === Tests ===

describe('Importer Module', () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    vi.resetAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('isImportEligible', () => {
    it('returns true when server says eligible', async () => {
      vi.mocked(checkImportEligibility).mockResolvedValue({ eligible: true });
      expect(await isImportEligible()).toBe(true);
    });

    it('returns false when server says not eligible', async () => {
      vi.mocked(checkImportEligibility).mockResolvedValue({ eligible: false });
      expect(await isImportEligible()).toBe(false);
    });

    it('returns false when server action throws', async () => {
      vi.mocked(checkImportEligibility).mockRejectedValue(new Error('Unauthorized'));
      expect(await isImportEligible()).toBe(false);
    });
  });

  describe('hasLocalStorageData', () => {
    it('returns true when checklist has templates', () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V2),
        'plnrr:organizer': JSON.stringify({ version: 1, tasks: [] }),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      expect(hasLocalStorageData()).toBe(true);
    });

    it('returns true when organizer has tasks', () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify({ version: 2, templates: [], activeChecklist: null }),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      expect(hasLocalStorageData()).toBe(true);
    });

    it('returns false when both are empty/default', () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify({ version: 2, templates: [], activeChecklist: null }),
        'plnrr:organizer': JSON.stringify({ version: 1, tasks: [] }),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      expect(hasLocalStorageData()).toBe(false);
    });

    it('returns false when keys are missing', () => {
      const mock = createStorageMock({});
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      expect(hasLocalStorageData()).toBe(false);
    });

    it('returns false when values are invalid JSON', () => {
      const mock = createStorageMock({
        'plnrr:checklist': '{invalid json',
        'plnrr:organizer': 'not json either',
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      expect(hasLocalStorageData()).toBe(false);
    });
  });

  describe('runImport', () => {
    it('imports both valid datasets successfully', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V2),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockResolvedValue({});

      const result = await runImport();

      expect(result.success).toBe(true);
      expect(result.checklistImported).toBe(true);
      expect(result.organizerImported).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(importUserData).toHaveBeenCalledTimes(1);
    });

    it('runs migrations on v1 checklist data before importing', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V1),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockResolvedValue({});

      const result = await runImport();

      expect(result.success).toBe(true);
      expect(result.checklistImported).toBe(true);

      // Verify that the migrated data includes minutesBefore
      const callArgs = vi.mocked(importUserData).mock.calls[0];
      const checklistPayload = callArgs[0] as typeof VALID_CHECKLIST_V2;
      expect(checklistPayload.version).toBe(2);
      expect(checklistPayload.templates[0].items[0].minutesBefore).toBeNull();
    });

    it('handles partial success: checklist valid, organizer invalid', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V2),
        'plnrr:organizer': JSON.stringify({ version: 1, tasks: [{ invalid: true }] }),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockResolvedValue({});

      const result = await runImport();

      expect(result.success).toBe(true);
      expect(result.checklistImported).toBe(true);
      expect(result.organizerImported).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].dataset).toBe('organizer');
      // importUserData called with valid checklist and default organizer
      expect(importUserData).toHaveBeenCalledTimes(1);
    });

    it('handles partial success: organizer valid, checklist invalid', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify({ version: 2, templates: 'not an array' }),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockResolvedValue({});

      const result = await runImport();

      expect(result.success).toBe(true);
      expect(result.checklistImported).toBe(false);
      expect(result.organizerImported).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].dataset).toBe('checklist');
    });

    it('fails when both datasets are invalid', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': '{invalid json',
        'plnrr:organizer': '{also invalid',
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      const result = await runImport();

      expect(result.success).toBe(false);
      expect(result.checklistImported).toBe(false);
      expect(result.organizerImported).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(importUserData).not.toHaveBeenCalled();
    });

    it('fails when localStorage keys are missing', async () => {
      const mock = createStorageMock({});
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });

      const result = await runImport();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].message).toContain('No checklist data found');
      expect(result.errors[1].message).toContain('No organizer data found');
      expect(importUserData).not.toHaveBeenCalled();
    });

    it('reports server write failure', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V2),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockRejectedValue(new Error('Network error'));

      const result = await runImport();

      expect(result.success).toBe(false);
      expect(result.checklistImported).toBe(false);
      expect(result.organizerImported).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Network error'))).toBe(true);
    });

    it('reports server validation failure', async () => {
      const mock = createStorageMock({
        'plnrr:checklist': JSON.stringify(VALID_CHECKLIST_V2),
        'plnrr:organizer': JSON.stringify(VALID_ORGANIZER),
      });
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true });
      vi.mocked(importUserData).mockResolvedValue({
        error: { fields: [{ path: 'templates.0.name', message: 'too long' }] },
        dataset: 'checklist',
      });

      const result = await runImport();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].dataset).toBe('checklist');
      expect(result.errors[0].message).toContain('Server validation failed');
    });
  });
});
