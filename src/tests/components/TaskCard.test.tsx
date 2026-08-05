/**
 * Component tests for TaskCard (src/components/organizer/TaskCard.tsx)
 * Validates: Requirements 4.5, 4.6, 5.1, 5.2, 5.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TaskCard } from '@/components/organizer/TaskCard';
import type { TaskCard as TaskCardType, TypeTag } from '@/lib/types';

// === Mock the organizer context ===

const mockDispatch = vi.fn();

vi.mock('@/lib/organizer-context', () => ({
  useOrganizer: () => ({
    state: { version: 1, tasks: [] },
    dispatch: mockDispatch,
    error: null,
  }),
}));

// === Test Helpers ===

function createTask(overrides: Partial<TaskCardType> = {}): TaskCardType {
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

// === Tests ===

describe('TaskCard Component', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  describe('Completion styling', () => {
    it('applies line-through to title when task is completed', () => {
      const task = createTask({ completed: true });
      render(<TaskCard task={task} />);

      const titleButton = screen.getByRole('button', { name: /edit title/i });
      expect(titleButton).toHaveClass('line-through');
    });

    it('applies reduced opacity to card when task is completed', () => {
      const task = createTask({ completed: true });
      const { container } = render(<TaskCard task={task} />);

      const card = container.querySelector('[role="article"]');
      expect(card).toHaveClass('opacity-60');
    });

    it('does not apply line-through when task is not completed', () => {
      const task = createTask({ completed: false });
      render(<TaskCard task={task} />);

      const titleButton = screen.getByRole('button', { name: /edit title/i });
      expect(titleButton).not.toHaveClass('line-through');
    });

    it('does not apply reduced opacity when task is not completed', () => {
      const task = createTask({ completed: false });
      const { container } = render(<TaskCard task={task} />);

      const card = container.querySelector('[role="article"]');
      expect(card).not.toHaveClass('opacity-60');
    });
  });

  describe('Type tag color rendering', () => {
    const tagTests: { tag: TypeTag; expectedBadge: string; expectedLabel: string; displayName: string }[] = [
      {
        tag: 'stream-day',
        expectedBadge: 'bg-lavender-100',
        expectedLabel: 'text-lavender-900',
        displayName: 'Stream Day',
      },
      {
        tag: 'content-planning',
        expectedBadge: 'bg-mint-100',
        expectedLabel: 'text-mint-900',
        displayName: 'Content Planning',
      },
      {
        tag: 'admin-business',
        expectedBadge: 'bg-amber-100',
        expectedLabel: 'text-amber-900',
        displayName: 'Admin/Business',
      },
      {
        tag: 'editing',
        expectedBadge: 'bg-pink-100',
        expectedLabel: 'text-pink-900',
        displayName: 'Editing',
      },
    ];

    tagTests.forEach(({ tag, expectedBadge, expectedLabel, displayName }) => {
      it(`renders ${displayName} tag with correct color classes`, () => {
        const task = createTask({ typeTag: tag });
        render(<TaskCard task={task} />);

        const tagButton = screen.getByRole('button', { name: new RegExp(`Type tag: ${displayName}`, 'i') });
        expect(tagButton).toHaveClass(expectedBadge);
        expect(tagButton).toHaveClass(expectedLabel);
      });
    });
  });

  describe('Neutral styling when no type tag assigned', () => {
    it('renders neutral styling when typeTag is null', () => {
      const task = createTask({ typeTag: null });
      render(<TaskCard task={task} />);

      const tagButton = screen.getByRole('button', { name: /assign type tag/i });
      expect(tagButton).toHaveClass('bg-theme-surface-alt');
      expect(tagButton).toHaveClass('text-theme-text-faint');
      expect(tagButton).toHaveTextContent('Tag');
    });
  });
});
