'use client';

import { useState, useRef, useEffect } from 'react';
import type { TaskCard as TaskCardType, TypeTag } from '@/lib/types';
import { useOrganizer } from '@/lib/organizer-context';

// === Type Tag Config ===

const TYPE_TAG_OPTIONS: { value: TypeTag; label: string }[] = [
  { value: 'stream-day', label: 'Stream Day' },
  { value: 'content-planning', label: 'Content Planning' },
  { value: 'admin-business', label: 'Admin/Business' },
  { value: 'editing', label: 'Editing' },
];

const TYPE_TAG_STYLES: Record<TypeTag, { badge: string; label: string }> = {
  'stream-day': {
    badge: 'bg-lavender-100 dark:bg-lavender-800',
    label: 'text-lavender-900 dark:text-lavender-100',
  },
  'content-planning': {
    badge: 'bg-mint-100 dark:bg-mint-800',
    label: 'text-mint-900 dark:text-mint-100',
  },
  'admin-business': {
    badge: 'bg-amber-100 dark:bg-amber-800',
    label: 'text-amber-900 dark:text-amber-100',
  },
  editing: {
    badge: 'bg-pink-100 dark:bg-pink-800',
    label: 'text-pink-900 dark:text-pink-100',
  },
};

function getTypeTagLabel(tag: TypeTag): string {
  const option = TYPE_TAG_OPTIONS.find((o) => o.value === tag);
  return option?.label ?? tag;
}

// === Icons ===

function RecurrenceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// === TaskCard Component ===

interface TaskCardProps {
  task: TaskCardType;
}

export function TaskCard({ task }: TaskCardProps) {
  const { dispatch } = useOrganizer();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!showTagDropdown) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowTagDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTagDropdown]);

  function handleToggleComplete() {
    dispatch({ type: 'TOGGLE_COMPLETE', payload: { id: task.id } });
  }

  function handleTitleClick() {
    setEditTitle(task.title);
    setIsEditingTitle(true);
  }

  function handleTitleSave() {
    const trimmed = editTitle.trim();
    if (trimmed.length >= 1 && trimmed.length <= 100 && trimmed !== task.title) {
      dispatch({ type: 'EDIT_TASK', payload: { id: task.id, title: trimmed } });
    }
    setIsEditingTitle(false);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditingTitle(false);
    }
  }

  function handleSetTypeTag(tag: TypeTag) {
    dispatch({ type: 'SET_TYPE_TAG', payload: { id: task.id, typeTag: tag } });
    setShowTagDropdown(false);
  }

  function handleRemoveTypeTag() {
    dispatch({ type: 'REMOVE_TYPE_TAG', payload: { id: task.id } });
    setShowTagDropdown(false);
  }

  function handleToggleRecurring() {
    dispatch({ type: 'TOGGLE_RECURRING', payload: { id: task.id } });
  }

  return (
    <div
      className={`group rounded-lg border p-3 transition-opacity ${
        task.completed
          ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 opacity-60'
          : 'border-zinc-200 dark:border-lavender-800 bg-white dark:bg-lavender-950'
      }`}
      role="article"
      aria-label={`Task: ${task.title}`}
    >
      {/* Top row: completion toggle + title */}
      <div className="flex items-center gap-2">
        {/* Completion toggle */}
        <button
          onClick={handleToggleComplete}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md shrink-0 transition-colors ${
            task.completed
              ? 'bg-mint-500 dark:bg-mint-600 text-white'
              : 'border-2 border-zinc-300 dark:border-zinc-600 text-transparent hover:border-mint-400 dark:hover:border-mint-400'
          }`}
          aria-label={task.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
          aria-checked={task.completed}
          role="checkbox"
        >
          {task.completed && <CheckIcon />}
        </button>

        {/* Title - click to edit */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            className="flex-1 min-h-[44px] px-2 py-1 rounded-md bg-zinc-100 dark:bg-lavender-900 text-zinc-900 dark:text-zinc-100 text-sm font-body outline-none ring-2 ring-lavender-400"
            maxLength={100}
            aria-label="Edit task title"
          />
        ) : (
          <button
            onClick={handleTitleClick}
            className={`flex-1 min-h-[44px] px-2 py-1 text-left text-sm font-body rounded-md hover:bg-zinc-100 dark:hover:bg-lavender-900 transition-colors ${
              task.completed
                ? 'line-through text-zinc-400 dark:text-zinc-500'
                : 'text-zinc-900 dark:text-zinc-100'
            }`}
            aria-label={`Edit title: ${task.title}`}
          >
            {task.title}
          </button>
        )}
      </div>

      {/* Bottom row: type tag + recurrence */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {/* Type tag badge / selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowTagDropdown(!showTagDropdown)}
            className={`min-w-[44px] min-h-[44px] inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              task.typeTag
                ? `${TYPE_TAG_STYLES[task.typeTag].badge} ${TYPE_TAG_STYLES[task.typeTag].label}`
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            aria-label={task.typeTag ? `Type tag: ${getTypeTagLabel(task.typeTag)}. Click to change.` : 'Assign type tag'}
            aria-expanded={showTagDropdown}
            aria-haspopup="listbox"
          >
            {task.typeTag ? getTypeTagLabel(task.typeTag) : 'Tag'}
          </button>

          {/* Dropdown */}
          {showTagDropdown && (
            <div
              className="absolute z-10 mt-1 left-0 w-48 rounded-lg border border-zinc-200 dark:border-lavender-800 bg-white dark:bg-lavender-950 shadow-lg py-1"
              role="listbox"
              aria-label="Select type tag"
            >
              {TYPE_TAG_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSetTypeTag(option.value)}
                  className={`w-full min-h-[44px] px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-lavender-900 transition-colors flex items-center gap-2 ${
                    task.typeTag === option.value ? 'font-semibold' : ''
                  }`}
                  role="option"
                  aria-selected={task.typeTag === option.value}
                >
                  <span
                    className={`w-3 h-3 rounded-full ${TYPE_TAG_STYLES[option.value].badge}`}
                    aria-hidden="true"
                  />
                  <span className="text-zinc-900 dark:text-zinc-100">{option.label}</span>
                </button>
              ))}
              {task.typeTag && (
                <button
                  onClick={handleRemoveTypeTag}
                  className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-lavender-900 transition-colors border-t border-zinc-100 dark:border-lavender-800"
                  role="option"
                  aria-selected={false}
                >
                  Remove tag
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recurrence toggle */}
        <button
          onClick={handleToggleRecurring}
          className={`min-w-[44px] min-h-[44px] inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            task.recurring
              ? 'bg-lavender-100 dark:bg-lavender-800 text-lavender-900 dark:text-lavender-100'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
          aria-label={task.recurring ? 'Disable recurrence' : 'Enable recurrence'}
          aria-pressed={task.recurring}
        >
          <RecurrenceIcon />
          {task.recurring && <span>Weekly</span>}
        </button>
      </div>
    </div>
  );
}
