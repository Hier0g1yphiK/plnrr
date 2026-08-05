import { nanoid } from 'nanoid';
import type { OrganizerState, TaskCard, TypeTag, Weekday } from './types';

// === Action Types ===

export type AddTaskAction = {
  type: 'ADD_TASK';
  payload: { title: string; weekday: Weekday };
};

export type DeleteTaskAction = {
  type: 'DELETE_TASK';
  payload: { id: string };
};

export type EditTaskAction = {
  type: 'EDIT_TASK';
  payload: { id: string; title?: string; weekday?: Weekday };
};

export type ToggleCompleteAction = {
  type: 'TOGGLE_COMPLETE';
  payload: { id: string };
};

export type SetTypeTagAction = {
  type: 'SET_TYPE_TAG';
  payload: { id: string; typeTag: TypeTag };
};

export type RemoveTypeTagAction = {
  type: 'REMOVE_TYPE_TAG';
  payload: { id: string };
};

export type ToggleRecurringAction = {
  type: 'TOGGLE_RECURRING';
  payload: { id: string };
};

export type OrganizerAction =
  | AddTaskAction
  | DeleteTaskAction
  | EditTaskAction
  | ToggleCompleteAction
  | SetTypeTagAction
  | RemoveTypeTagAction
  | ToggleRecurringAction;

// === Validation Helpers ===

const MAX_TASKS_PER_WEEKDAY = 50;

function isValidTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

function countTasksForWeekday(tasks: TaskCard[], weekday: Weekday): number {
  return tasks.filter((task) => task.weekday === weekday).length;
}

// === Reducer ===

export function organizerReducer(
  state: OrganizerState,
  action: OrganizerAction
): OrganizerState {
  switch (action.type) {
    case 'ADD_TASK': {
      const { title, weekday } = action.payload;

      if (!isValidTitle(title)) {
        return state;
      }

      if (countTasksForWeekday(state.tasks, weekday) >= MAX_TASKS_PER_WEEKDAY) {
        return state;
      }

      const newTask: TaskCard = {
        id: nanoid(),
        title,
        weekday,
        typeTag: null,
        completed: false,
        recurring: false,
        createdAt: new Date().toISOString(),
      };

      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };
    }

    case 'DELETE_TASK': {
      const { id } = action.payload;
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== id),
      };
    }

    case 'EDIT_TASK': {
      const { id, title, weekday } = action.payload;

      // Validate title if provided
      if (title !== undefined && !isValidTitle(title)) {
        return state;
      }

      // Find the task to edit
      const taskIndex = state.tasks.findIndex((task) => task.id === id);
      if (taskIndex === -1) {
        return state;
      }

      const existingTask = state.tasks[taskIndex];

      // If weekday is changing, validate target day capacity
      if (weekday !== undefined && weekday !== existingTask.weekday) {
        if (
          countTasksForWeekday(state.tasks, weekday) >= MAX_TASKS_PER_WEEKDAY
        ) {
          return state;
        }
      }

      const updatedTask: TaskCard = {
        ...existingTask,
        ...(title !== undefined && { title }),
        ...(weekday !== undefined && { weekday }),
      };

      const updatedTasks = [...state.tasks];
      updatedTasks[taskIndex] = updatedTask;

      return {
        ...state,
        tasks: updatedTasks,
      };
    }

    case 'TOGGLE_COMPLETE': {
      const { id } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id ? { ...task, completed: !task.completed } : task
        ),
      };
    }

    case 'SET_TYPE_TAG': {
      const { id, typeTag } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id ? { ...task, typeTag } : task
        ),
      };
    }

    case 'REMOVE_TYPE_TAG': {
      const { id } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id ? { ...task, typeTag: null } : task
        ),
      };
    }

    case 'TOGGLE_RECURRING': {
      const { id } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === id ? { ...task, recurring: !task.recurring } : task
        ),
      };
    }

    default:
      return state;
  }
}
