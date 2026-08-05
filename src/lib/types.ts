// === Checklist Domain ===

export interface ChecklistItem {
  id: string; // nanoid
  text: string; // 1–200 chars
  categoryId: string; // reference to Category.id
}

export interface Category {
  id: string; // nanoid
  name: string; // 1–50 chars
  order: number; // display order within template
}

export interface Template {
  id: string; // nanoid
  name: string; // 1–100 chars, unique (case-insensitive)
  categories: Category[];
  items: ChecklistItem[]; // max 50
  createdAt: string; // ISO 8601
}

export interface ActiveChecklist {
  templateId: string; // source template reference
  items: ActiveChecklistItem[];
}

export interface ActiveChecklistItem {
  id: string; // mirrors ChecklistItem.id
  text: string; // copied from template at load time
  categoryId: string;
  checked: boolean;
}

export interface ChecklistState {
  version: number; // schema version for migrations
  templates: Template[];
  activeChecklist: ActiveChecklist | null;
}

// === Organizer Domain ===

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TypeTag =
  | 'stream-day'
  | 'content-planning'
  | 'admin-business'
  | 'editing';

export interface TaskCard {
  id: string; // nanoid
  title: string; // 1–100 chars
  weekday: Weekday;
  typeTag: TypeTag | null;
  completed: boolean;
  recurring: boolean;
  createdAt: string; // ISO 8601
}

export interface OrganizerState {
  version: number; // schema version for migrations
  tasks: TaskCard[]; // max 50 per weekday (enforced at write time)
}

// === Theme ===

export type ThemePreference = 'dark' | 'light';
