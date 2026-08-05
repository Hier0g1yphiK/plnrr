'use client';

import { useState, useCallback } from 'react';
import { useChecklist } from '@/lib/checklist-context';
import { InlineError } from '@/components/InlineError';
import type { Template, Category } from '@/lib/types';

interface TemplateEditorProps {
  templateId: string;
  onBack?: () => void;
}

export function TemplateEditor({ templateId, onBack }: TemplateEditorProps) {
  const { state, dispatch } = useChecklist();
  const template = state.templates.find((t) => t.id === templateId);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const [renameCategoryError, setRenameCategoryError] = useState('');
  const [deleteOtherError, setDeleteOtherError] = useState('');

  // Validate category name: 1-50 chars, unique within template
  const validateCategoryName = useCallback(
    (name: string, excludeId?: string): string | null => {
      const trimmed = name.trim();
      if (trimmed.length === 0) return 'Category name is required';
      if (trimmed.length > 50) return 'Category name must be 50 characters or less';
      if (template) {
        const duplicate = template.categories.some(
          (c) =>
            c.id !== excludeId &&
            c.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (duplicate) return 'A category with this name already exists';
      }
      return null;
    },
    [template]
  );

  // Validate item text: 1-200 chars
  const validateItemText = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return 'Item text is required';
      if (trimmed.length > 200) return 'Item text must be 200 characters or less';
      if (template && template.items.length >= 50) {
        return 'Maximum of 50 items per template reached';
      }
      return null;
    },
    [template]
  );

  if (!template) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400 font-body">Template not found.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 text-lavender-400 hover:text-lavender-300 font-body text-sm"
          >
            ← Back to templates
          </button>
        )}
      </div>
    );
  }

  const sortedCategories = [...template.categories].sort(
    (a, b) => a.order - b.order
  );
  const hasItems = template.items.length > 0;

  // --- Category handlers ---

  const handleAddCategory = () => {
    const error = validateCategoryName(newCategoryName);
    if (error) {
      setCategoryError(error);
      return;
    }
    dispatch({
      type: 'ADD_CATEGORY',
      payload: { templateId, name: newCategoryName.trim() },
    });
    setNewCategoryName('');
    setCategoryError('');
  };

  const handleDeleteCategory = (categoryId: string) => {
    const category = template.categories.find((c) => c.id === categoryId);
    if (category?.name === 'Other') {
      setDeleteOtherError('The "Other" category cannot be deleted. It serves as the fallback for items from deleted categories.');
      setTimeout(() => setDeleteOtherError(''), 5000);
      return;
    }
    dispatch({
      type: 'DELETE_CATEGORY',
      payload: { templateId, categoryId },
    });
  };

  const handleStartRename = (category: Category) => {
    setRenamingCategory(category.id);
    setRenameCategoryValue(category.name);
    setRenameCategoryError('');
  };

  const handleConfirmRename = () => {
    if (!renamingCategory) return;
    const error = validateCategoryName(renameCategoryValue, renamingCategory);
    if (error) {
      setRenameCategoryError(error);
      return;
    }
    dispatch({
      type: 'RENAME_CATEGORY',
      payload: {
        templateId,
        categoryId: renamingCategory,
        name: renameCategoryValue.trim(),
      },
    });
    setRenamingCategory(null);
    setRenameCategoryValue('');
    setRenameCategoryError('');
  };

  const handleCancelRename = () => {
    setRenamingCategory(null);
    setRenameCategoryValue('');
    setRenameCategoryError('');
  };

  const handleMoveCategory = (categoryId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedCategories.findIndex((c) => c.id === categoryId);
    if (currentIndex < 0) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sortedCategories.length) return;

    const newOrder = [...sortedCategories];
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[newIndex];
    newOrder[newIndex] = temp;

    dispatch({
      type: 'REORDER_CATEGORIES',
      payload: { templateId, categoryIds: newOrder.map((c) => c.id) },
    });
  };

  // --- Item handlers ---

  const handleAddItem = (categoryId: string) => {
    const text = itemInputs[categoryId] || '';
    const error = validateItemText(text);
    if (error) {
      setItemErrors((prev) => ({ ...prev, [categoryId]: error }));
      return;
    }
    dispatch({
      type: 'ADD_ITEM',
      payload: { templateId, categoryId, text: text.trim() },
    });
    setItemInputs((prev) => ({ ...prev, [categoryId]: '' }));
    setItemErrors((prev) => ({ ...prev, [categoryId]: '' }));
  };

  const handleDeleteItem = (itemId: string) => {
    dispatch({
      type: 'DELETE_ITEM',
      payload: { templateId, itemId },
    });
  };

  const getItemsForCategory = (categoryId: string) => {
    return template.items.filter((item) => item.categoryId === categoryId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-lavender-300 transition-colors"
              aria-label="Back to template list"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <h2 className="font-display text-xl font-semibold text-zinc-100 dark:text-zinc-100 text-zinc-800">
            {template.name}
          </h2>
        </div>
        <span className="text-sm text-zinc-400 font-body">
          {template.items.length}/50 items
        </span>
      </div>

      {/* "Other" deletion error */}
      {deleteOtherError && (
        <InlineError message={deleteOtherError} className="px-3 py-2 bg-red-500/10 rounded-md" />
      )}

      {/* Add category section */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value);
              if (categoryError) setCategoryError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCategory();
            }}
            placeholder="New category name"
            maxLength={50}
            className="flex-1 min-h-[44px] px-3 rounded-lg bg-zinc-800 dark:bg-zinc-800 bg-zinc-100 border border-zinc-700 dark:border-zinc-700 border-zinc-300 text-zinc-100 dark:text-zinc-100 text-zinc-800 placeholder-zinc-500 font-body text-sm focus:outline-none focus:ring-2 focus:ring-lavender-500"
            aria-label="New category name"
          />
          <button
            onClick={handleAddCategory}
            className="min-w-[44px] min-h-[44px] px-4 rounded-lg bg-lavender-600 hover:bg-lavender-500 text-white font-body text-sm font-medium transition-colors"
            aria-label="Add category"
          >
            Add Category
          </button>
        </div>
        <InlineError message={categoryError} />
      </div>

      {/* Empty state */}
      {!hasItems && sortedCategories.length > 0 && (
        <div className="rounded-lg border border-dashed border-zinc-600 dark:border-zinc-600 border-zinc-300 p-8 text-center">
          <p className="text-zinc-400 font-body mb-2">
            This template has no items yet.
          </p>
          <p className="text-zinc-500 font-body text-sm">
            Add items to categories below to build your checklist.
          </p>
        </div>
      )}

      {/* Category list with items */}
      <div className="space-y-4">
        {sortedCategories.map((category, index) => {
          const categoryItems = getItemsForCategory(category.id);
          const isRenaming = renamingCategory === category.id;

          return (
            <div
              key={category.id}
              className="rounded-lg border border-zinc-700 dark:border-zinc-700 border-zinc-200 bg-zinc-800/50 dark:bg-zinc-800/50 bg-white overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 dark:bg-zinc-800 bg-zinc-50 border-b border-zinc-700 dark:border-zinc-700 border-zinc-200">
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={renameCategoryValue}
                      onChange={(e) => {
                        setRenameCategoryValue(e.target.value);
                        if (renameCategoryError) setRenameCategoryError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      maxLength={50}
                      className="flex-1 min-h-[36px] px-2 rounded bg-zinc-700 dark:bg-zinc-700 bg-white border border-zinc-600 dark:border-zinc-600 border-zinc-300 text-zinc-100 dark:text-zinc-100 text-zinc-800 font-body text-sm focus:outline-none focus:ring-2 focus:ring-lavender-500"
                      aria-label="Rename category"
                      autoFocus
                    />
                    <button
                      onClick={handleConfirmRename}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-mint-400 hover:text-mint-300 transition-colors"
                      aria-label="Confirm rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelRename}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-300 transition-colors"
                      aria-label="Cancel rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-body font-semibold text-sm text-zinc-200 dark:text-zinc-200 text-zinc-700">
                      {category.name}
                      <span className="ml-2 text-zinc-500 font-normal">
                        ({categoryItems.length})
                      </span>
                    </h3>
                    <div className="flex items-center gap-1">
                      {/* Reorder buttons */}
                      <button
                        onClick={() => handleMoveCategory(category.id, 'up')}
                        disabled={index === 0}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-lavender-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${category.name} up`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveCategory(category.id, 'down')}
                        disabled={index === sortedCategories.length - 1}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-lavender-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Move ${category.name} down`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {/* Rename button */}
                      <button
                        onClick={() => handleStartRename(category)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-lavender-300 transition-colors"
                        aria-label={`Rename ${category.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors"
                        aria-label={`Delete ${category.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Rename error */}
              {isRenaming && renameCategoryError && (
                <InlineError message={renameCategoryError} className="px-4 py-1" />
              )}

              {/* Items list */}
              <div className="px-4 py-2">
                {categoryItems.length === 0 ? (
                  <p className="text-zinc-500 text-sm font-body italic py-2">
                    No items in this category
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {categoryItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between py-1.5 group"
                      >
                        <span className="text-zinc-300 dark:text-zinc-300 text-zinc-600 font-body text-sm">
                          {item.text}
                        </span>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                          aria-label={`Delete item: ${item.text}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add item input */}
                <div className="mt-2 space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={itemInputs[category.id] || ''}
                      onChange={(e) => {
                        setItemInputs((prev) => ({
                          ...prev,
                          [category.id]: e.target.value,
                        }));
                        if (itemErrors[category.id]) {
                          setItemErrors((prev) => ({
                            ...prev,
                            [category.id]: '',
                          }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddItem(category.id);
                      }}
                      placeholder="Add item..."
                      maxLength={200}
                      disabled={template.items.length >= 50}
                      className="flex-1 min-h-[44px] px-3 rounded-lg bg-zinc-700/50 dark:bg-zinc-700/50 bg-zinc-100 border border-zinc-600 dark:border-zinc-600 border-zinc-300 text-zinc-100 dark:text-zinc-100 text-zinc-800 placeholder-zinc-500 font-body text-sm focus:outline-none focus:ring-2 focus:ring-lavender-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Add item to ${category.name}`}
                    />
                    <button
                      onClick={() => handleAddItem(category.id)}
                      disabled={template.items.length >= 50}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-lg bg-lavender-600 hover:bg-lavender-500 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-body text-sm transition-colors"
                      aria-label={`Add item to ${category.name}`}
                    >
                      +
                    </button>
                  </div>
                  <InlineError message={itemErrors[category.id]} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
