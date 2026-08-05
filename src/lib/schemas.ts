import { z } from 'zod';

// === Checklist Domain ===

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  categoryId: z.string(),
}).strip();

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  order: z.number(),
}).strip();

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  categories: z.array(CategorySchema),
  items: z.array(ChecklistItemSchema).max(50),
  createdAt: z.string(),
}).strip();

export const ActiveChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  categoryId: z.string(),
  checked: z.boolean(),
}).strip();

export const ActiveChecklistSchema = z.object({
  templateId: z.string(),
  items: z.array(ActiveChecklistItemSchema),
}).strip();

export const ChecklistStateSchema = z.object({
  version: z.number().default(1),
  templates: z.array(TemplateSchema),
  activeChecklist: z.nullable(ActiveChecklistSchema),
}).strip();

// === Organizer Domain ===

export const WeekdaySchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const TypeTagSchema = z.enum([
  'stream-day',
  'content-planning',
  'admin-business',
  'editing',
]);

export const TaskCardSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  weekday: WeekdaySchema,
  typeTag: z.nullable(TypeTagSchema),
  completed: z.boolean(),
  recurring: z.boolean(),
  createdAt: z.string(),
}).strip();

export const OrganizerStateSchema = z.object({
  version: z.number().default(1),
  tasks: z.array(TaskCardSchema),
}).strip();

// === Theme ===

export const ThemePreferenceSchema = z.enum(['dark', 'light']);

// === Inferred Types ===

export type ChecklistItemFromSchema = z.infer<typeof ChecklistItemSchema>;
export type CategoryFromSchema = z.infer<typeof CategorySchema>;
export type TemplateFromSchema = z.infer<typeof TemplateSchema>;
export type ActiveChecklistItemFromSchema = z.infer<typeof ActiveChecklistItemSchema>;
export type ActiveChecklistFromSchema = z.infer<typeof ActiveChecklistSchema>;
export type ChecklistStateFromSchema = z.infer<typeof ChecklistStateSchema>;
export type WeekdayFromSchema = z.infer<typeof WeekdaySchema>;
export type TypeTagFromSchema = z.infer<typeof TypeTagSchema>;
export type TaskCardFromSchema = z.infer<typeof TaskCardSchema>;
export type OrganizerStateFromSchema = z.infer<typeof OrganizerStateSchema>;
export type ThemePreferenceFromSchema = z.infer<typeof ThemePreferenceSchema>;
