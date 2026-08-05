'use client';

import { useState } from 'react';
import { InlineError } from '@/components/InlineError';
import type { TaskCard, TypeTag, Weekday } from '@/lib/types';

// === Type Tag Color Mapping ===

const TYPE_TAG_STYLES: Record<TypeTag, { bg: string; text: string; label: string }> = {
  'stream-day': {
    bg: 'bg-lavender-100 dark:bg-lavender-800',
    text: 'text-lavender-900 dark:text-lavender-100',
    label: 'Stream Day',
  },
  'content-planning': {
    bg: 'bg-mint-100 dark:bg-mint-800',
    text: 'text-mint-900 dark:text-mint-100',
    label: 'Content',
  },
  'admin-business': {
    bg: 'bg-amber-100 dark:bg-amber-800',
    text: 'text-amber-900 dark:text-amber-100',
    label: 'Admin',
  },
  editing: {
    bg: 'bg-pink-100 dark:bg-pink-800',
    text: 'text-pink-900 dark:text-pink-100',
    label: 'Editing',
  },
};

const MAX_TASKS_PER_WEEKDAY = 50;

// === Sub-components ===

function TypeTagBadge({ typeTag }: { typeTag: TypeTag }) {
  const style = TYPE_TAG_STYLES[typeTag];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

function RecurrenceBadge() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
      aria-label="Recurring task"
    >
      ↻
    </span>
  );
}

// === DayColumn Props ===

interface DayColumnProps {
  weekday: Weekday;
  label: string;
  tasks: TaskCard[];
  onAddTask: (title: string) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export function DayColumn({
  weekday,
  label,
  tasks,
  onAddTask,
  onToggleComplete,
  onDeleteTask,
}: DayColumnProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isAtLimit = tasks.length >= MAX_TASKS_PER_WEEKDAY;

  function handleAddTask() {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;

    if (isAtLimit) {
      setError('Maximum 50 tasks reached for this day.');
      return;
    }

    if (trimmed.length > 100) {
      setError('Task title must be 100 characters or less.');
      return;
    }

    setError(null);
    onAddTask(trimmed);
    setNewTaskTitle('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  }

  return (
    <div
      className="flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 overflow-hidden"
      role="region"
      aria-label={`${label} tasks`}
    >
      {/* Day header */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
        <h3 className="font-display text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {label}
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {tasks.length}/{MAX_TASKS_PER_WEEKDAY}
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`group flex flex-col gap-1 rounded-md border border-zinc-100 dark:border-zinc-700 p-2 transition-opacity ${
              task.completed ? 'opacity-50' : 'opacity-100'
            }`}
          >
            {/* Task title row */}
            <div className="flex items-start gap-2">
              <button
                onClick={() => onToggleComplete(task.id)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
                aria-label={task.completed ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    task.completed
                      ? 'bg-lavender-500 border-lavender-500 text-white'
                      : 'border-zinc-400 dark:border-zinc-500'
                  }`}
                >
                  {task.completed && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </button>

              <span
                className={`flex-1 text-sm font-body text-zinc-800 dark:text-zinc-100 pt-2.5 ${
                  task.completed ? 'line-through' : ''
                }`}
              >
                {task.title}
              </span>

              <button
                onClick={() => onDeleteTask(task.id)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label={`Delete "${task.title}"`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3L11 11M3 11L11 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Badges row */}
            {(task.typeTag || task.recurring) && (
              <div className="flex items-center gap-1.5 pl-[44px]">
                {task.typeTag && <TypeTagBadge typeTag={task.typeTag} />}
                {task.recurring && <RecurrenceBadge />}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add task input */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-1">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => {
              setNewTaskTitle(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Add task..."
            disabled={isAtLimit}
            className="flex-1 min-h-[44px] px-2 text-sm font-body rounded-md border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-lavender-400"
            aria-label={`Add task to ${label}`}
          />
          <button
            onClick={handleAddTask}
            disabled={isAtLimit || !newTaskTitle.trim()}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-lavender-500 hover:bg-lavender-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Add task"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3V13M3 8H13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <InlineError message={error} className="mt-1 text-xs" />
        {isAtLimit && !error && (
          <InlineError message="Maximum 50 tasks reached for this day." className="mt-1 text-xs" />
        )}
      </div>
    </div>
  );
}
