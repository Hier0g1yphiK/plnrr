import { describe, it, expect } from 'vitest';
import {
  ChecklistStateSchema,
  OrganizerStateSchema,
  ThemePreferenceSchema,
  TaskCardSchema,
  TemplateSchema,
  WeekdaySchema,
  TypeTagSchema,
} from './schemas';

describe('Zod schemas', () => {
  it('ChecklistState parses with default version', () => {
    const result = ChecklistStateSchema.parse({ templates: [], activeChecklist: null });
    expect(result.version).toBe(1);
    expect(result.templates).toEqual([]);
    expect(result.activeChecklist).toBeNull();
  });

  it('ChecklistState preserves explicit version', () => {
    const result = ChecklistStateSchema.parse({ version: 2, templates: [], activeChecklist: null });
    expect(result.version).toBe(2);
  });

  it('OrganizerState parses with default version', () => {
    const result = OrganizerStateSchema.parse({ tasks: [] });
    expect(result.version).toBe(1);
    expect(result.tasks).toEqual([]);
  });

  it('ThemePreference validates dark and light', () => {
    expect(ThemePreferenceSchema.parse('dark')).toBe('dark');
    expect(ThemePreferenceSchema.parse('light')).toBe('light');
  });

  it('ThemePreference rejects invalid value', () => {
    expect(() => ThemePreferenceSchema.parse('auto')).toThrow();
  });

  it('Template rejects empty name', () => {
    expect(() =>
      TemplateSchema.parse({
        id: '1',
        name: '',
        categories: [],
        items: [],
        createdAt: '2024-01-01T00:00:00Z',
      })
    ).toThrow();
  });

  it('Template rejects name over 100 chars', () => {
    expect(() =>
      TemplateSchema.parse({
        id: '1',
        name: 'a'.repeat(101),
        categories: [],
        items: [],
        createdAt: '2024-01-01T00:00:00Z',
      })
    ).toThrow();
  });

  it('Template accepts valid name', () => {
    const result = TemplateSchema.parse({
      id: '1',
      name: 'My Template',
      categories: [],
      items: [],
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(result.name).toBe('My Template');
  });

  it('TaskCard validates weekday enum', () => {
    const task = TaskCardSchema.parse({
      id: '1',
      title: 'Test task',
      weekday: 'monday',
      typeTag: null,
      completed: false,
      recurring: false,
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(task.weekday).toBe('monday');
  });

  it('TaskCard rejects invalid weekday', () => {
    expect(() =>
      TaskCardSchema.parse({
        id: '1',
        title: 'Test task',
        weekday: 'notaday',
        typeTag: null,
        completed: false,
        recurring: false,
        createdAt: '2024-01-01T00:00:00Z',
      })
    ).toThrow();
  });

  it('TaskCard validates type tag', () => {
    const task = TaskCardSchema.parse({
      id: '1',
      title: 'Stream prep',
      weekday: 'friday',
      typeTag: 'stream-day',
      completed: false,
      recurring: true,
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(task.typeTag).toBe('stream-day');
  });

  it('TaskCard accepts null typeTag', () => {
    const task = TaskCardSchema.parse({
      id: '1',
      title: 'Misc task',
      weekday: 'wednesday',
      typeTag: null,
      completed: true,
      recurring: false,
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(task.typeTag).toBeNull();
  });

  it('TaskCard rejects title over 100 chars', () => {
    expect(() =>
      TaskCardSchema.parse({
        id: '1',
        title: 'x'.repeat(101),
        weekday: 'monday',
        typeTag: null,
        completed: false,
        recurring: false,
        createdAt: '2024-01-01T00:00:00Z',
      })
    ).toThrow();
  });

  it('WeekdaySchema validates all weekdays', () => {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of weekdays) {
      expect(WeekdaySchema.parse(day)).toBe(day);
    }
  });

  it('TypeTagSchema validates all type tags', () => {
    const tags = ['stream-day', 'content-planning', 'admin-business', 'editing'];
    for (const tag of tags) {
      expect(TypeTagSchema.parse(tag)).toBe(tag);
    }
  });

  it('Template rejects more than 50 items', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      id: String(i),
      text: `Item ${i}`,
      categoryId: 'cat1',
    }));
    expect(() =>
      TemplateSchema.parse({
        id: '1',
        name: 'Big Template',
        categories: [],
        items,
        createdAt: '2024-01-01T00:00:00Z',
      })
    ).toThrow();
  });
});
