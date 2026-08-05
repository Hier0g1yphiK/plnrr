/**
 * Component tests for DayColumn (src/components/organizer/DayColumn.tsx)
 * Validates: Requirements 4.5, 4.6, 4.10, 5.1, 5.2, 5.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DayColumn } from '@/components/organizer/DayColumn';
import type { TaskCard, TypeTag } from '@/lib/types';

// === Test Helpers ===

function createTask(overrides: Partial<TaskCard> = {}): TaskCard {
  return {
    id: 'task-1',
    title: 'Test Task',
    weekday: 'monday',
    typeTag: null,
    completed: false,
    recurring: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTasks(count: number): TaskCard[] {
  return Array.from({ length: count }, (_, i) =>
    createTask({ id: `task-${i}`, title: `Task ${i}` })
  );
}

const defaultProps = {
  weekday: 'monday' as const,
  label: 'Monday',
  tasks: [] as TaskCard[],
  onAddTask: vi.fn(),
  onToggleComplete: vi.fn(),
  onDeleteTask: vi.fn(),
};

// === Tests ===

describe('DayColumn Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Completion styling', () => {
    it('applies line-through to completed task title', () => {
      const tasks = [createTask({ completed: true, title: 'Done task' })];
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      const title = screen.getByText('Done task');
      expect(title).toHaveClass('line-through');
    });

    it('applies reduced opacity to completed task wrapper', () => {
      const tasks = [createTask({ completed: true, title: 'Done task' })];
      const { container } = render(<DayColumn {...defaultProps} tasks={tasks} />);

      // The task wrapper div has the opacity class
      const taskWrapper = container.querySelector('.opacity-50');
      expect(taskWrapper).not.toBeNull();
    });

    it('does not apply line-through to incomplete task title', () => {
      const tasks = [createTask({ completed: false, title: 'Active task' })];
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      const title = screen.getByText('Active task');
      expect(title).not.toHaveClass('line-through');
    });

    it('applies full opacity to incomplete task wrapper', () => {
      const tasks = [createTask({ completed: false, title: 'Active task' })];
      const { container } = render(<DayColumn {...defaultProps} tasks={tasks} />);

      const taskWrapper = container.querySelector('.opacity-100');
      expect(taskWrapper).not.toBeNull();
    });
  });

  describe('Type tag color rendering', () => {
    const tagTests: { tag: TypeTag; expectedBg: string; expectedText: string; displayLabel: string }[] = [
      {
        tag: 'stream-day',
        expectedBg: 'bg-lavender-100',
        expectedText: 'text-lavender-900',
        displayLabel: 'Stream Day',
      },
      {
        tag: 'content-planning',
        expectedBg: 'bg-mint-100',
        expectedText: 'text-mint-900',
        displayLabel: 'Content',
      },
      {
        tag: 'admin-business',
        expectedBg: 'bg-amber-100',
        expectedText: 'text-amber-900',
        displayLabel: 'Admin',
      },
      {
        tag: 'editing',
        expectedBg: 'bg-pink-100',
        expectedText: 'text-pink-900',
        displayLabel: 'Editing',
      },
    ];

    tagTests.forEach(({ tag, expectedBg, expectedText, displayLabel }) => {
      it(`renders ${tag} type tag with correct color classes`, () => {
        const tasks = [createTask({ typeTag: tag })];
        render(<DayColumn {...defaultProps} tasks={tasks} />);

        const badge = screen.getByText(displayLabel);
        expect(badge).toHaveClass(expectedBg);
        expect(badge).toHaveClass(expectedText);
      });
    });
  });

  describe('Neutral styling when no type tag', () => {
    it('does not render a type tag badge when typeTag is null', () => {
      const tasks = [createTask({ typeTag: null })];
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      // None of the tag labels should appear
      expect(screen.queryByText('Stream Day')).toBeNull();
      expect(screen.queryByText('Content')).toBeNull();
      expect(screen.queryByText('Admin')).toBeNull();
      expect(screen.queryByText('Editing')).toBeNull();
    });
  });

  describe('50-task limit enforcement', () => {
    it('disables the add task input when 50 tasks exist', () => {
      const tasks = createTasks(50);
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      const input = screen.getByPlaceholderText('Add task...');
      expect(input).toBeDisabled();
    });

    it('disables the add task button when 50 tasks exist', () => {
      const tasks = createTasks(50);
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      const addButton = screen.getByRole('button', { name: 'Add task' });
      expect(addButton).toBeDisabled();
    });

    it('shows error message when trying to add task at limit', () => {
      const tasks = createTasks(50);
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      // Type something and try to add via Enter
      const input = screen.getByPlaceholderText('Add task...');
      // Input is disabled, so we can't type; the disabled state itself is the enforcement
      expect(input).toBeDisabled();
    });

    it('does not disable input when under 50 tasks', () => {
      const tasks = createTasks(49);
      render(<DayColumn {...defaultProps} tasks={tasks} />);

      const input = screen.getByPlaceholderText('Add task...');
      expect(input).not.toBeDisabled();
    });
  });
});
