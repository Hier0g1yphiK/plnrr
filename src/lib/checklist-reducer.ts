import { nanoid } from 'nanoid';
import type { ChecklistState, Template, Category, ChecklistItem, ActiveChecklist, ActiveChecklistItem } from './types';

// === Action Types ===

export type CreateTemplateAction = {
  type: 'CREATE_TEMPLATE';
  payload: { name: string };
};

export type DeleteTemplateAction = {
  type: 'DELETE_TEMPLATE';
  payload: { templateId: string };
};

export type RenameTemplateAction = {
  type: 'RENAME_TEMPLATE';
  payload: { templateId: string; name: string };
};

export type AddCategoryAction = {
  type: 'ADD_CATEGORY';
  payload: { templateId: string; name: string };
};

export type RenameCategoryAction = {
  type: 'RENAME_CATEGORY';
  payload: { templateId: string; categoryId: string; name: string };
};

export type DeleteCategoryAction = {
  type: 'DELETE_CATEGORY';
  payload: { templateId: string; categoryId: string };
};

export type ReorderCategoriesAction = {
  type: 'REORDER_CATEGORIES';
  payload: { templateId: string; categoryIds: string[] };
};

export type AddItemAction = {
  type: 'ADD_ITEM';
  payload: { templateId: string; categoryId: string; text: string; minutesBefore?: number | null };
};

export type DeleteItemAction = {
  type: 'DELETE_ITEM';
  payload: { templateId: string; itemId: string };
};

export type LoadTemplateAction = {
  type: 'LOAD_TEMPLATE';
  payload: { templateId: string };
};

export type CheckItemAction = {
  type: 'CHECK_ITEM';
  payload: { itemId: string };
};

export type UncheckItemAction = {
  type: 'UNCHECK_ITEM';
  payload: { itemId: string };
};

export type ResetChecklistAction = {
  type: 'RESET_CHECKLIST';
};

export type SetStreamTimeAction = {
  type: 'SET_STREAM_TIME';
  payload: { streamTime: string | null };
};

export type UpdateItemMinutesBeforeAction = {
  type: 'UPDATE_ITEM_MINUTES_BEFORE';
  payload: { templateId: string; itemId: string; minutesBefore: number | null };
};

export type ChecklistAction =
  | CreateTemplateAction
  | DeleteTemplateAction
  | RenameTemplateAction
  | AddCategoryAction
  | RenameCategoryAction
  | DeleteCategoryAction
  | ReorderCategoriesAction
  | AddItemAction
  | DeleteItemAction
  | LoadTemplateAction
  | CheckItemAction
  | UncheckItemAction
  | ResetChecklistAction
  | SetStreamTimeAction
  | UpdateItemMinutesBeforeAction;

// === Default Categories ===

const DEFAULT_CATEGORY_NAMES = ['Software', 'Physical Setup', 'Content', 'Other'] as const;

function createDefaultCategories(): Category[] {
  return DEFAULT_CATEGORY_NAMES.map((name, index) => ({
    id: nanoid(),
    name,
    order: index,
  }));
}

// === Validation Helpers ===

function isValidTemplateName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

function isTemplateNameUnique(
  name: string,
  templates: Template[],
  excludeId?: string
): boolean {
  const normalizedName = name.trim().toLowerCase();
  return !templates.some(
    (t) => t.id !== excludeId && t.name.trim().toLowerCase() === normalizedName
  );
}

function isValidCategoryName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

function isCategoryNameUniqueInTemplate(
  name: string,
  categories: Category[],
  excludeId?: string
): boolean {
  const normalizedName = name.trim().toLowerCase();
  return !categories.some(
    (c) => c.id !== excludeId && c.name.trim().toLowerCase() === normalizedName
  );
}

function isValidItemText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

// === Reducer ===

export function checklistReducer(
  state: ChecklistState,
  action: ChecklistAction
): ChecklistState {
  switch (action.type) {
    case 'CREATE_TEMPLATE': {
      const { name } = action.payload;
      if (!isValidTemplateName(name)) return state;
      if (!isTemplateNameUnique(name, state.templates)) return state;

      const newTemplate: Template = {
        id: nanoid(),
        name: name.trim(),
        categories: createDefaultCategories(),
        items: [],
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        templates: [...state.templates, newTemplate],
      };
    }

    case 'DELETE_TEMPLATE': {
      const { templateId } = action.payload;
      const templateExists = state.templates.some((t) => t.id === templateId);
      if (!templateExists) return state;

      const newTemplates = state.templates.filter((t) => t.id !== templateId);

      // If the deleted template is the source of the active checklist, clear it
      const activeChecklist =
        state.activeChecklist?.templateId === templateId
          ? null
          : state.activeChecklist;

      return {
        ...state,
        templates: newTemplates,
        activeChecklist,
      };
    }

    case 'RENAME_TEMPLATE': {
      const { templateId, name } = action.payload;
      if (!isValidTemplateName(name)) return state;
      if (!isTemplateNameUnique(name, state.templates, templateId)) return state;

      const templateExists = state.templates.some((t) => t.id === templateId);
      if (!templateExists) return state;

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId ? { ...t, name: name.trim() } : t
        ),
      };
    }

    case 'ADD_CATEGORY': {
      const { templateId, name } = action.payload;
      if (!isValidCategoryName(name)) return state;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      if (!isCategoryNameUniqueInTemplate(name, template.categories)) return state;

      const newCategory: Category = {
        id: nanoid(),
        name: name.trim(),
        order: template.categories.length,
      };

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId
            ? { ...t, categories: [...t.categories, newCategory] }
            : t
        ),
      };
    }

    case 'RENAME_CATEGORY': {
      const { templateId, categoryId, name } = action.payload;
      if (!isValidCategoryName(name)) return state;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const categoryExists = template.categories.some((c) => c.id === categoryId);
      if (!categoryExists) return state;

      if (!isCategoryNameUniqueInTemplate(name, template.categories, categoryId))
        return state;

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId
            ? {
                ...t,
                categories: t.categories.map((c) =>
                  c.id === categoryId ? { ...c, name: name.trim() } : c
                ),
              }
            : t
        ),
      };
    }

    case 'DELETE_CATEGORY': {
      const { templateId, categoryId } = action.payload;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const categoryToDelete = template.categories.find((c) => c.id === categoryId);
      if (!categoryToDelete) return state;

      // Prevent deletion of "Other" category
      if (categoryToDelete.name === 'Other') return state;

      const otherCategory = template.categories.find((c) => c.name === 'Other');
      if (!otherCategory) return state;

      // Move items from the deleted category to "Other"
      const updatedItems = template.items.map((item) =>
        item.categoryId === categoryId
          ? { ...item, categoryId: otherCategory.id }
          : item
      );

      // Remove the deleted category and re-order remaining
      const updatedCategories = template.categories
        .filter((c) => c.id !== categoryId)
        .map((c, index) => ({ ...c, order: index }));

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId
            ? { ...t, categories: updatedCategories, items: updatedItems }
            : t
        ),
      };
    }

    case 'REORDER_CATEGORIES': {
      const { templateId, categoryIds } = action.payload;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      // Validate that all provided IDs exist in the template
      const existingIds = new Set(template.categories.map((c) => c.id));
      const allIdsValid = categoryIds.every((id) => existingIds.has(id));
      if (!allIdsValid) return state;

      // Validate same length (no additions/removals)
      if (categoryIds.length !== template.categories.length) return state;

      // Build reordered categories
      const categoryMap = new Map(template.categories.map((c) => [c.id, c]));
      const reorderedCategories = categoryIds.map((id, index) => ({
        ...categoryMap.get(id)!,
        order: index,
      }));

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId ? { ...t, categories: reorderedCategories } : t
        ),
      };
    }

    case 'ADD_ITEM': {
      const { templateId, categoryId, text, minutesBefore } = action.payload;
      if (!isValidItemText(text)) return state;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      // Enforce max 50 items per template
      if (template.items.length >= 50) return state;

      // Verify category exists in template
      const categoryExists = template.categories.some((c) => c.id === categoryId);
      if (!categoryExists) return state;

      const newItem: ChecklistItem = {
        id: nanoid(),
        text: text.trim(),
        categoryId,
        minutesBefore: minutesBefore ?? null,
      };

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId ? { ...t, items: [...t.items, newItem] } : t
        ),
      };
    }

    case 'DELETE_ITEM': {
      const { templateId, itemId } = action.payload;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const itemExists = template.items.some((i) => i.id === itemId);
      if (!itemExists) return state;

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId
            ? { ...t, items: t.items.filter((i) => i.id !== itemId) }
            : t
        ),
      };
    }

    case 'LOAD_TEMPLATE': {
      const { templateId } = action.payload;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const activeChecklist: ActiveChecklist = {
        templateId,
        streamTime: null,
        items: template.items.map((item): ActiveChecklistItem => ({
          id: item.id,
          text: item.text,
          categoryId: item.categoryId,
          checked: false,
          minutesBefore: item.minutesBefore,
        })),
      };

      return {
        ...state,
        activeChecklist,
      };
    }

    case 'CHECK_ITEM': {
      const { itemId } = action.payload;
      if (!state.activeChecklist) return state;

      const itemExists = state.activeChecklist.items.some((i) => i.id === itemId);
      if (!itemExists) return state;

      return {
        ...state,
        activeChecklist: {
          ...state.activeChecklist,
          items: state.activeChecklist.items.map((item) =>
            item.id === itemId ? { ...item, checked: true } : item
          ),
        },
      };
    }

    case 'UNCHECK_ITEM': {
      const { itemId } = action.payload;
      if (!state.activeChecklist) return state;

      const itemExists = state.activeChecklist.items.some((i) => i.id === itemId);
      if (!itemExists) return state;

      return {
        ...state,
        activeChecklist: {
          ...state.activeChecklist,
          items: state.activeChecklist.items.map((item) =>
            item.id === itemId ? { ...item, checked: false } : item
          ),
        },
      };
    }

    case 'RESET_CHECKLIST': {
      if (!state.activeChecklist) return state;

      return {
        ...state,
        activeChecklist: {
          ...state.activeChecklist,
          items: state.activeChecklist.items.map((item) => ({
            ...item,
            checked: false,
          })),
        },
      };
    }

    case 'SET_STREAM_TIME': {
      if (!state.activeChecklist) return state;
      const { streamTime } = action.payload;

      return {
        ...state,
        activeChecklist: {
          ...state.activeChecklist,
          streamTime,
        },
      };
    }

    case 'UPDATE_ITEM_MINUTES_BEFORE': {
      const { templateId, itemId, minutesBefore } = action.payload;

      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const itemExists = template.items.some((i) => i.id === itemId);
      if (!itemExists) return state;

      // Validate minutesBefore if provided
      if (minutesBefore !== null && (minutesBefore < 0 || !Number.isFinite(minutesBefore))) {
        return state;
      }

      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === templateId
            ? {
                ...t,
                items: t.items.map((i) =>
                  i.id === itemId ? { ...i, minutesBefore } : i
                ),
              }
            : t
        ),
      };
    }

    default:
      return state;
  }
}

// === Helper Functions ===

export function formatProgress(activeChecklist: ActiveChecklist | null): string {
  if (!activeChecklist) return '0/0 complete';
  const checked = activeChecklist.items.filter((item) => item.checked).length;
  const total = activeChecklist.items.length;
  return `${checked}/${total} complete`;
}
