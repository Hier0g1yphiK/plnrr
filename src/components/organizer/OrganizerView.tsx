'use client';

import { useState, useMemo } from 'react';
import { useOrganizer } from '@/lib/organizer-context';
import { DayColumn } from '@/components/organizer/DayColumn';
import type { Weekday, TaskCard } from '@/lib/types';

// === Constants ===

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const FULL_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const ABBREVIATED_LABELS: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

// === Helpers ===

function getCurrentWeekday(): Weekday | null {
  try {
    // Check if Intl.DateTimeFormat is available
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
      return null;
    }

    const now = new Date();
    const dayIndex = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const weekdayMap: Weekday[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    return weekdayMap[dayIndex];
  } catch {
    return null;
  }
}

function isTimezoneAvailable(): boolean {
  try {
    return typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';
  } catch {
    return false;
  }
}

// === Sub-components ===

function TodayFilterToggle({
  isActive,
  onToggle,
  disabled,
  disabledMessage,
}: {
  isActive: boolean;
  onToggle: () => void;
  disabled: boolean;
  disabledMessage: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`min-w-[44px] min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
          isActive
            ? 'bg-theme-accent text-theme-accent-text shadow-md'
            : 'bg-theme-surface-alt text-theme-text-muted hover:bg-theme-border-subtle'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isActive ? 'Show all days' : 'Show today only'}
        aria-pressed={isActive}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 6H14" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11 1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Today</span>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
        )}
      </button>
      {disabled && disabledMessage && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{disabledMessage}</span>
      )}
    </div>
  );
}

function EmptyState({ onAddTask }: { onAddTask: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-theme-accent-subtle flex items-center justify-center mb-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-theme-accent"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8H21" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 2V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display text-lg font-semibold text-theme-text mb-2">
        No tasks yet
      </h3>
      <p className="text-sm font-body text-theme-text-muted mb-6 max-w-sm">
        Start planning your week by adding tasks to any day column below.
      </p>
      <button
        onClick={onAddTask}
        className="min-w-[44px] min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text font-body font-medium text-sm transition-colors"
        aria-label="Add your first task"
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
        Add your first task
      </button>
    </div>
  );
}

function MobileDayNav({
  selectedDay,
  onSelectDay,
}: {
  selectedDay: Weekday;
  onSelectDay: (day: Weekday) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent, day: Weekday) {
    const currentIndex = WEEKDAYS.indexOf(day);
    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % WEEKDAYS.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + WEEKDAYS.length) % WEEKDAYS.length;
    }

    if (nextIndex >= 0) {
      onSelectDay(WEEKDAYS[nextIndex]);
    }
  }

  return (
    <nav
      className="flex overflow-x-auto gap-1 pb-2 scrollbar-thin"
      role="tablist"
      aria-label="Day navigation"
    >
      {WEEKDAYS.map((day) => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          onKeyDown={(e) => handleKeyDown(e, day)}
          className={`min-w-[44px] min-h-[44px] flex-shrink-0 px-3 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
            selectedDay === day
              ? 'bg-theme-accent text-theme-accent-text'
              : 'bg-theme-surface-alt text-theme-text-muted hover:bg-theme-border-subtle'
          }`}
          aria-selected={selectedDay === day}
          role="tab"
          tabIndex={selectedDay === day ? 0 : -1}
          id={`mobile-tab-${day}`}
          aria-controls={`mobile-tabpanel-${day}`}
        >
          {ABBREVIATED_LABELS[day]}
        </button>
      ))}
    </nav>
  );
}

// === Main Component ===

export function OrganizerView() {
  const { state, dispatch } = useOrganizer();
  const [todayFilterActive, setTodayFilterActive] = useState(false);
  const [mobileSelectedDay, setMobileSelectedDay] = useState<Weekday>(
    getCurrentWeekday() ?? 'monday'
  );
  const [showDayColumns, setShowDayColumns] = useState(false);

  const timezoneAvailable = isTimezoneAvailable();
  const currentWeekday = getCurrentWeekday();

  const totalTaskCount = state.tasks.length;

  // Group tasks by weekday
  const tasksByDay = useMemo(() => {
    const grouped: Record<Weekday, TaskCard[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    for (const task of state.tasks) {
      grouped[task.weekday].push(task);
    }
    return grouped;
  }, [state.tasks]);

  // Determine which days to show
  const visibleDays = useMemo(() => {
    if (todayFilterActive && currentWeekday) {
      return [currentWeekday];
    }
    return WEEKDAYS;
  }, [todayFilterActive, currentWeekday]);

  // Handlers
  function handleAddTask(weekday: Weekday) {
    return (title: string) => {
      dispatch({ type: 'ADD_TASK', payload: { title, weekday } });
    };
  }

  function handleToggleComplete(id: string) {
    dispatch({ type: 'TOGGLE_COMPLETE', payload: { id } });
  }

  function handleDeleteTask(id: string) {
    dispatch({ type: 'DELETE_TASK', payload: { id } });
  }

  function handleToggleTodayFilter() {
    setTodayFilterActive((prev) => !prev);
  }

  function handleEmptyStateCTA() {
    setShowDayColumns(true);
    if (currentWeekday) {
      setMobileSelectedDay(currentWeekday);
    }
  }

  // Empty state
  if (totalTaskCount === 0 && !todayFilterActive && !showDayColumns) {
    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-theme-text">
            Weekly Organizer
          </h2>
          <TodayFilterToggle
            isActive={todayFilterActive}
            onToggle={handleToggleTodayFilter}
            disabled={!timezoneAvailable}
            disabledMessage={!timezoneAvailable ? 'Timezone unavailable' : null}
          />
        </div>
        <EmptyState onAddTask={handleEmptyStateCTA} />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-theme-text">
          Weekly Organizer
        </h2>
        <TodayFilterToggle
          isActive={todayFilterActive}
          onToggle={handleToggleTodayFilter}
          disabled={!timezoneAvailable}
          disabledMessage={!timezoneAvailable ? 'Timezone unavailable' : null}
        />
      </div>

      {/* Today filter empty state */}
      {todayFilterActive && currentWeekday && tasksByDay[currentWeekday].length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-body text-theme-text-muted mb-2">
            No tasks scheduled for {FULL_LABELS[currentWeekday]}.
          </p>
          <p className="text-xs font-body text-theme-text-faint">
            Add a task below or deactivate the Today filter to see all days.
          </p>
        </div>
      )}

      {/* Desktop/Tablet: 2-column card grid (≥768px), centered when single day */}
      <div className={`hidden md:grid gap-4 ${visibleDays.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : 'md:grid-cols-2'}`}>
        {visibleDays.map((day) => (
          <DayColumn
            key={day}
            weekday={day}
            label={FULL_LABELS[day]}
            tasks={tasksByDay[day]}
            onAddTask={handleAddTask(day)}
            onToggleComplete={handleToggleComplete}
            onDeleteTask={handleDeleteTask}
          />
        ))}
      </div>

      {/* Mobile: Single column with day navigation (<768px) */}
      <div className="md:hidden">
        <MobileDayNav
          selectedDay={todayFilterActive && currentWeekday ? currentWeekday : mobileSelectedDay}
          onSelectDay={setMobileSelectedDay}
        />
        <div className="mt-3" role="tabpanel" id={`mobile-tabpanel-${todayFilterActive && currentWeekday ? currentWeekday : mobileSelectedDay}`} aria-labelledby={`mobile-tab-${todayFilterActive && currentWeekday ? currentWeekday : mobileSelectedDay}`}>
          {(() => {
            const activeDay = todayFilterActive && currentWeekday ? currentWeekday : mobileSelectedDay;
            return (
              <DayColumn
                weekday={activeDay}
                label={FULL_LABELS[activeDay]}
                tasks={tasksByDay[activeDay]}
                onAddTask={handleAddTask(activeDay)}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
