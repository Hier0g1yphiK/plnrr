'use client';

import { useState } from 'react';
import { useChecklist } from '@/lib/checklist-context';
import type { ActiveChecklistItem, Category } from '@/lib/types';

type SortMode = 'category' | 'time';

/**
 * Given a stream time (HH:mm) and minutesBefore, computes the deadline time string.
 * Returns null if streamTime is null or minutesBefore is null.
 */
function computeDeadlineTime(
  streamTime: string | null,
  minutesBefore: number | null
): string | null {
  if (!streamTime || minutesBefore === null) return null;

  const [hours, minutes] = streamTime.split(':').map(Number);
  const streamMinutes = hours * 60 + minutes;
  let deadlineMinutes = streamMinutes - minutesBefore;

  // Wrap around midnight
  if (deadlineMinutes < 0) deadlineMinutes += 24 * 60;

  const deadlineHours = Math.floor(deadlineMinutes / 60) % 24;
  const deadlineMins = deadlineMinutes % 60;

  // Format as 12-hour time
  const period = deadlineHours >= 12 ? 'PM' : 'AM';
  const displayHours = deadlineHours % 12 || 12;
  const displayMins = deadlineMins.toString().padStart(2, '0');
  return `${displayHours}:${displayMins} ${period}`;
}

/**
 * Sorts items by deadline (soonest first).
 * Items with higher minutesBefore are due earliest, so they appear first.
 * Items without minutesBefore go to the end.
 */
function sortByTime(items: ActiveChecklistItem[]): ActiveChecklistItem[] {
  return [...items].sort((a, b) => {
    if (a.minutesBefore === null && b.minutesBefore === null) return 0;
    if (a.minutesBefore === null) return 1;
    if (b.minutesBefore === null) return -1;
    return b.minutesBefore - a.minutesBefore;
  });
}

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
          : 'bg-theme-surface-alt text-theme-text'
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
  streamTime,
}: {
  item: ActiveChecklistItem;
  onToggle: (itemId: string, checked: boolean) => void;
  streamTime: string | null;
}) {
  const deadline = computeDeadlineTime(streamTime, item.minutesBefore);

  return (
    <label
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-theme-surface-alt ${
        item.checked ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item.id, item.checked)}
        className="min-w-[20px] min-h-[20px] w-5 h-5 rounded border-theme-border text-theme-accent focus:ring-theme-accent cursor-pointer"
        aria-label={`${item.text}${deadline ? ` (by ${deadline})` : ''}${item.checked ? ' (completed)' : ''}`}
      />
      <span
        className={`flex-1 font-body text-sm text-theme-text ${
          item.checked ? 'line-through text-theme-text-faint' : ''
        }`}
      >
        {item.text}
      </span>
      {deadline && (
        <span
          className={`shrink-0 text-xs font-body font-medium px-2 py-0.5 rounded ${
            item.checked
              ? 'bg-theme-surface-alt text-theme-text-faint'
              : 'bg-theme-accent-subtle text-theme-accent'
          }`}
          aria-label={`Complete by ${deadline}`}
        >
          {deadline}
        </span>
      )}
    </label>
  );
}

function CategoryGroup({
  categoryName,
  items,
  onToggle,
  streamTime,
}: {
  categoryName: string;
  items: ActiveChecklistItem[];
  onToggle: (itemId: string, checked: boolean) => void;
  streamTime: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-theme-text-muted px-3 pt-2 font-body">
        {categoryName}
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} onToggle={onToggle} streamTime={streamTime} />
        ))}
      </div>
    </div>
  );
}

function SortToggle({
  sortMode,
  onChangeSort,
}: {
  sortMode: SortMode;
  onChangeSort: (mode: SortMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-theme-surface-alt p-1" role="radiogroup" aria-label="Sort order">
      <button
        role="radio"
        aria-checked={sortMode === 'category'}
        onClick={() => onChangeSort('category')}
        className={`px-3 py-1.5 rounded-md text-xs font-body font-medium transition-colors ${
          sortMode === 'category'
            ? 'bg-theme-surface text-theme-text shadow-sm'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        Category
      </button>
      <button
        role="radio"
        aria-checked={sortMode === 'time'}
        onClick={() => onChangeSort('time')}
        className={`px-3 py-1.5 rounded-md text-xs font-body font-medium transition-colors ${
          sortMode === 'time'
            ? 'bg-theme-surface text-theme-text shadow-sm'
            : 'text-theme-text-muted hover:text-theme-text'
        }`}
      >
        Time
      </button>
    </div>
  );
}

export function ActiveChecklist() {
  const { state, dispatch } = useChecklist();
  const { activeChecklist, templates } = state;
  const [sortMode, setSortMode] = useState<SortMode>('category');

  if (!activeChecklist) return null;

  const template = templates.find((t) => t.id === activeChecklist.templateId);
  const categories: Category[] = template?.categories ?? [];

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

  const handleStreamTimeChange = (value: string) => {
    dispatch({
      type: 'SET_STREAM_TIME',
      payload: { streamTime: value || null },
    });
  };

  // Check if any items have minutesBefore set
  const hasTimedItems = activeChecklist.items.some(
    (i) => i.minutesBefore !== null
  );

  // Build the item list based on sort mode
  const renderItems = () => {
    if (sortMode === 'time') {
      const sorted = sortByTime(activeChecklist.items);
      return (
        <div className="space-y-0.5">
          {sorted.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              streamTime={activeChecklist.streamTime}
            />
          ))}
        </div>
      );
    }

    // Category mode (default)
    const groupedItems = new Map<string, ActiveChecklistItem[]>();
    for (const item of activeChecklist.items) {
      const existing = groupedItems.get(item.categoryId) ?? [];
      existing.push(item);
      groupedItems.set(item.categoryId, existing);
    }

    return (
      <>
        {sortedCategories.map((category) => {
          const items = groupedItems.get(category.id) ?? [];
          return (
            <CategoryGroup
              key={category.id}
              categoryName={category.name}
              items={items}
              onToggle={handleToggle}
              streamTime={activeChecklist.streamTime}
            />
          );
        })}
      </>
    );
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isComplete
          ? 'border-mint-400 dark:border-mint-600 bg-mint-50/50 dark:bg-mint-950/20'
          : 'border-theme-border bg-theme-surface'
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-theme-text">
            {template?.name ?? 'Active Checklist'}
          </h2>
          <button
            onClick={handleReset}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg text-theme-text-muted hover:text-pink-500 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
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

        {/* Stream time input */}
        {hasTimedItems && (
          <div className="mb-3 flex items-center gap-3">
            <label
              htmlFor="stream-time-input"
              className="text-sm font-body font-medium text-theme-text-muted whitespace-nowrap"
            >
              Stream time
            </label>
            <input
              id="stream-time-input"
              type="time"
              value={activeChecklist.streamTime ?? ''}
              onChange={(e) => handleStreamTimeChange(e.target.value)}
              className="min-h-[44px] px-3 rounded-lg bg-theme-surface-alt border border-theme-border text-theme-text font-body text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              aria-label="Set stream start time to calculate item deadlines"
            />
            {activeChecklist.streamTime && (
              <button
                onClick={() => handleStreamTimeChange('')}
                className="text-xs text-theme-text-faint hover:text-theme-text-muted transition-colors"
                aria-label="Clear stream time"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Sort toggle - only show when there are timed items */}
        {hasTimedItems && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-body text-theme-text-muted">Sort by</span>
            <SortToggle sortMode={sortMode} onChangeSort={setSortMode} />
          </div>
        )}

        <ProgressIndicator checked={checked} total={total} />
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-3">
        {renderItems()}
      </div>
    </div>
  );
}
