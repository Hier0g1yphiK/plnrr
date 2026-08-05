'use client';

import { useChecklist } from '@/lib/checklist-context';
import type { ActiveChecklistItem, Category } from '@/lib/types';

function ProgressIndicator({
  checked,
  total,
}: {
  checked: number;
  total: number;
}) {
  const isComplete = total > 0 && checked === total;

  return (
    <div
      className={`rounded-lg px-4 py-3 text-center font-body font-semibold transition-colors ${
        isComplete
          ? 'bg-mint-600 dark:bg-mint-700 text-white'
          : 'bg-zinc-100 dark:bg-lavender-900/50 text-zinc-700 dark:text-zinc-200'
      }`}
      role="status"
      aria-live="polite"
      aria-label={`Progress: ${checked} of ${total} complete`}
    >
      {isComplete ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          All done! {checked}/{total} complete
        </span>
      ) : (
        <span>
          {checked}/{total} complete
        </span>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  onToggle,
}: {
  item: ActiveChecklistItem;
  onToggle: (itemId: string, checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-lavender-900/30 ${
        item.checked ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id, item.checked)}
        className="min-w-[20px] min-h-[20px] w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 text-lavender-500 focus:ring-lavender-400 dark:focus:ring-lavender-500 cursor-pointer"
        aria-label={`${item.text}${item.checked ? ' (completed)' : ''}`}
      />
      <span
        className={`font-body text-sm text-zinc-800 dark:text-zinc-200 ${
          item.checked ? 'line-through text-zinc-500 dark:text-zinc-400' : ''
        }`}
      >
        {item.text}
      </span>
    </label>
  );
}

function CategoryGroup({
  categoryName,
  items,
  onToggle,
}: {
  categoryName: string;
  items: ActiveChecklistItem[];
  onToggle: (itemId: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-3 pt-2 font-body">
        {categoryName}
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

export function ActiveChecklist() {
  const { state, dispatch } = useChecklist();
  const { activeChecklist, templates } = state;

  if (!activeChecklist) return null;

  const template = templates.find((t) => t.id === activeChecklist.templateId);
  const categories: Category[] = template?.categories ?? [];

  // Group items by categoryId
  const groupedItems = new Map<string, ActiveChecklistItem[]>();
  for (const item of activeChecklist.items) {
    const existing = groupedItems.get(item.categoryId) ?? [];
    existing.push(item);
    groupedItems.set(item.categoryId, existing);
  }

  // Sort categories by order
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  const checked = activeChecklist.items.filter((i) => i.checked).length;
  const total = activeChecklist.items.length;
  const isComplete = total > 0 && checked === total;

  const handleToggle = (itemId: string, currentlyChecked: boolean) => {
    if (currentlyChecked) {
      dispatch({ type: 'UNCHECK_ITEM', payload: { itemId } });
    } else {
      dispatch({ type: 'CHECK_ITEM', payload: { itemId } });
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_CHECKLIST' });
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isComplete
          ? 'border-mint-400 dark:border-mint-600 bg-mint-50/50 dark:bg-mint-950/20'
          : 'border-zinc-200 dark:border-lavender-800 bg-white dark:bg-lavender-950/50'
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {template?.name ?? 'Active Checklist'}
          </h2>
          <button
            onClick={handleReset}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-pink-500 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
            aria-label="Reset checklist - uncheck all items"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mr-1"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </button>
        </div>
        <ProgressIndicator checked={checked} total={total} />
      </div>

      {/* Items grouped by category */}
      <div className="px-4 py-3 space-y-3">
        {sortedCategories.map((category) => {
          const items = groupedItems.get(category.id) ?? [];
          return (
            <CategoryGroup
              key={category.id}
              categoryName={category.name}
              items={items}
              onToggle={handleToggle}
            />
          );
        })}
      </div>
    </div>
  );
}
