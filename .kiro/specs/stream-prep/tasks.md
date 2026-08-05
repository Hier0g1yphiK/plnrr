# Implementation Plan: Stream Prep

## Overview

Build a standalone Next.js + TypeScript + Tailwind application providing two productivity tools for content creators: a Checklist Engine (reusable pre-stream checklists) and a Weekly Organizer (perpetual weekday task board). The app is entirely client-side with localStorage persistence, dark-mode-first theming, and responsive layout. Implementation proceeds from project scaffolding through core data layer, UI components, and finally integration testing.

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialize Next.js project with TypeScript and Tailwind CSS
    - Run `create-next-app` with TypeScript, Tailwind, App Router, and ESLint options
    - Configure `tailwind.config.ts` with custom color palette (lavender, pink, mint, amber), Fredoka + Nunito font families, and `darkMode: 'class'`
    - Add Google Fonts (Fredoka, Nunito) via `next/font/google` in the root layout
    - Install dependencies: `nanoid`, `zod`, `vitest`, `@testing-library/react`, `fast-check`, `jsdom`
    - Configure `vitest.config.ts` with jsdom environment and path aliases
    - _Requirements: 9.3, 9.4, 12.1_

  - [x] 1.2 Create root layout with theme initialization script
    - Create `app/layout.tsx` as the RootLayout server component
    - Add a blocking inline `<script>` that reads `localStorage.getItem("plnrr:theme")` and applies the `dark` class to `<html>` before paint
    - Set default `className="dark"` on `<html>` element as fallback
    - Add metadata (title, description) and viewport configuration
    - _Requirements: 9.1, 9.4, 9.5, 9.6, 12.3_

  - [x] 1.3 Create AppProvider with "use client" boundary and context structure
    - Create `app/providers.tsx` with `"use client"` directive
    - Define `AppContext` with separate contexts for Checklist, Organizer, and Theme
    - Implement `AppProvider` component that wraps children in all context providers
    - Wire `AppProvider` into `app/page.tsx` as the client entry point
    - _Requirements: 8.2_

- [x] 2. Core data layer — types, schemas, and persistence
  - [x] 2.1 Define TypeScript interfaces and Zod schemas
    - Create `lib/types.ts` with all interfaces: `ChecklistItem`, `Category`, `Template`, `ActiveChecklist`, `ActiveChecklistItem`, `ChecklistState`, `Weekday`, `TypeTag`, `TaskCard`, `OrganizerState`, `ThemePreference`
    - Create `lib/schemas.ts` with Zod schemas mirroring each interface for runtime validation
    - Include schema version numbers (`version: 1`) in both `ChecklistState` and `OrganizerState`
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 8.4, 8.7_

  - [x] 2.2 Implement persistence layer with localStorage abstraction
    - Create `lib/persistence.ts` with generic `usePersistedState` hook
    - Implement read logic: parse JSON → validate with Zod → migrate if version mismatch → strip unknown fields → apply defaults
    - Implement write logic: serialize → `localStorage.setItem` → catch quota errors → surface warning
    - Add 100ms debounce on writes to batch rapid state changes
    - Handle all error cases: unavailable localStorage, quota exceeded, corrupted data
    - Use separate keys: `plnrr:checklist`, `plnrr:organizer`, `plnrr:theme`, `plnrr:lastReset`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 2.3 Write property test for persistence round-trip
    - **Property 2: Persistence Round-Trip**
    - Generate arbitrary valid ChecklistState and OrganizerState objects
    - Assert `deserialize(serialize(state))` deep-equals original state
    - Minimum 100 iterations
    - **Validates: Requirements 8.4**

  - [x] 2.4 Write unit tests for persistence layer
    - Test localStorage unavailable scenario (in-memory fallback)
    - Test quota exceeded error handling
    - Test corrupted/invalid JSON recovery to defaults
    - Test unknown field stripping (schema migration)
    - Test debounce behavior
    - _Requirements: 8.3, 8.6, 8.7_

- [x] 3. Checklist Engine — reducers and logic
  - [x] 3.1 Implement checklist reducer with all template operations
    - Create `lib/checklist-reducer.ts` with actions: `CREATE_TEMPLATE`, `DELETE_TEMPLATE`, `RENAME_TEMPLATE`, `ADD_CATEGORY`, `RENAME_CATEGORY`, `DELETE_CATEGORY`, `REORDER_CATEGORIES`, `ADD_ITEM`, `DELETE_ITEM`
    - Enforce validation: template name 1–100 chars, unique (case-insensitive), category name 1–50 chars unique within template, max 50 items per template
    - Default categories on template creation: "Software", "Physical Setup", "Content", "Other"
    - Category deletion moves items to "Other" category
    - Prevent deletion of "Other" category
    - Use `nanoid` for all ID generation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9_

  - [x] 3.2 Implement active checklist operations
    - Add actions to checklist reducer: `LOAD_TEMPLATE`, `CHECK_ITEM`, `UNCHECK_ITEM`, `RESET_CHECKLIST`
    - `LOAD_TEMPLATE`: creates ActiveChecklist from template with all items unchecked, copies text/categoryId
    - `CHECK_ITEM` / `UNCHECK_ITEM`: toggles checked state on specific item by ID
    - `RESET_CHECKLIST`: sets all items to unchecked without modifying source template
    - Implement `formatProgress` helper: returns `"{checked}/{total} complete"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9_

  - [x] 3.3 Write property test for progress indicator invariant
    - **Property 1: Progress Indicator Invariant**
    - Generate random ActiveChecklist instances with random check/uncheck operation sequences
    - Assert displayed progress always equals actual checked count over total
    - Minimum 100 iterations
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.9**

  - [x] 3.4 Write property test for reset idempotence
    - **Property 3: Reset Idempotence**
    - Generate ActiveChecklist with random check states
    - Assert `reset(checklist)` deep-equals `reset(reset(checklist))`
    - Minimum 100 iterations
    - **Validates: Requirements 3.6**

  - [x] 3.5 Write property test for template isolation
    - **Property 4: Template Isolation**
    - Generate random template, load as active checklist, apply random operations
    - Assert template remains unchanged after all active checklist operations
    - Minimum 100 iterations
    - **Validates: Requirements 3.6, 3.8**

  - [x] 3.6 Write property test for category deletion item preservation
    - **Property 6: Category Deletion Item Preservation**
    - Generate templates with items distributed across categories
    - Assert total item count preserved after category deletion and items moved to "Other"
    - Minimum 100 iterations
    - **Validates: Requirements 2.6**

  - [x] 3.7 Write property test for name validation boundary
    - **Property 8: Name Validation Boundary**
    - Generate random strings of varying lengths (0–200 chars)
    - Assert template creation succeeds iff `1 <= S.trim().length <= 100` and no duplicate name
    - Assert task creation succeeds iff `1 <= S.trim().length <= 100`
    - Minimum 100 iterations
    - **Validates: Requirements 1.1, 1.2, 1.5, 4.1, 4.2**

- [x] 4. Weekly Organizer — reducers and logic
  - [x] 4.1 Implement organizer reducer with task operations
    - Create `lib/organizer-reducer.ts` with actions: `ADD_TASK`, `DELETE_TASK`, `EDIT_TASK`, `TOGGLE_COMPLETE`, `SET_TYPE_TAG`, `REMOVE_TYPE_TAG`, `TOGGLE_RECURRING`
    - Enforce validation: title 1–100 chars non-whitespace-only, max 50 tasks per weekday
    - Use `nanoid` for task IDs, `createdAt` as ISO 8601
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1, 5.2, 5.3, 5.5, 5.6, 7.1, 7.3, 7.4_

  - [x] 4.2 Implement recurrence reset logic
    - Create `lib/recurrence.ts` with `shouldResetRecurringTasks`, `getMostRecentMonday`, and `resetRecurringTasks` functions
    - `shouldResetRecurringTasks`: compares lastResetTimestamp against most recent Monday 00:00 local time
    - `resetRecurringTasks`: sets `completed: false` on all recurring tasks, leaves non-recurring unchanged
    - Integrate reset check into AppProvider mount effect
    - Persist `plnrr:lastReset` timestamp after each reset
    - _Requirements: 7.2, 7.5, 7.6_

  - [x] 4.3 Write property test for task count metamorphic property
    - **Property 5: Task Count Metamorphic**
    - Generate random organizer states, apply add/delete operations
    - Assert `count_after_add === count_before + 1` and `count_after_delete === count_before - 1`
    - Assert filtered count <= total count
    - Minimum 100 iterations
    - **Validates: Requirements 4.1, 4.4, 6.1**

  - [x] 4.4 Write property test for recurring task reset
    - **Property 7: Recurring Task Reset**
    - Generate tasks with mixed recurring/non-recurring in various completion states
    - Assert reset sets `completed: false` on all recurring, leaves non-recurring unchanged
    - Minimum 100 iterations
    - **Validates: Requirements 7.2, 7.5**

  - [x] 4.5 Write unit tests for recurrence logic
    - Test `getMostRecentMonday` across various dates and edge cases (Sunday, Monday itself)
    - Test `shouldResetRecurringTasks` with timestamps before/after Monday boundary
    - Test first-load scenario (null lastResetTimestamp)
    - _Requirements: 7.2, 7.5, 7.6_

- [x] 5. Checkpoint — Core logic validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Theme Engine and context wiring
  - [x] 6.1 Implement theme context and toggle
    - Create `lib/theme-context.tsx` with `ThemeProvider` and `useTheme` hook
    - Read initial theme from localStorage (`plnrr:theme`), default to `"dark"`
    - Toggle function: add/remove `dark` class on `document.documentElement`, persist to localStorage
    - Handle invalid stored values by falling back to dark mode
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_

  - [x] 6.2 Wire checklist and organizer contexts into AppProvider
    - Create `lib/checklist-context.tsx` with `ChecklistProvider` and `useChecklist` hook
    - Create `lib/organizer-context.tsx` with `OrganizerProvider` and `useOrganizer` hook
    - Each provider uses `usePersistedState` from persistence layer
    - Integrate recurrence reset check on mount in `OrganizerProvider`
    - Compose all providers in `AppProvider`
    - _Requirements: 8.1, 8.2, 7.5, 7.6_

  - [x] 6.3 Write unit tests for theme engine
    - Test default dark mode when no stored preference
    - Test toggle persists to localStorage
    - Test invalid stored value falls back to dark
    - Test class application on document element
    - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [x] 7. Navigation and layout shell
  - [x] 7.1 Build Navigation component with tab switcher and theme toggle
    - Create `components/Navigation.tsx` with Checklist and Weekly tab buttons
    - Include `ThemeToggle` button (sun/moon icon) in the navigation bar
    - Style with Fredoka font for brand name, active tab indication with lavender accent
    - Manage active tab state in parent component
    - _Requirements: 9.2, 9.7, 10.4_

  - [x] 7.2 Build responsive MainContent container
    - Create `components/MainContent.tsx` that renders the active view based on tab state
    - Implement responsive container with breakpoints: ≥1024px (full grid), 768–1023px (condensed), <768px (single column)
    - Use Tailwind responsive classes for layout switching
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 8. Checklist UI components
  - [x] 8.1 Build TemplateList component with empty state
    - Create `components/checklist/TemplateList.tsx`
    - Render list of template cards with name and item count
    - Display empty state with call-to-action when no templates exist
    - Handle template selection, creation trigger, and deletion
    - _Requirements: 1.6, 1.8, 11.1_

  - [x] 8.2 Build TemplateEditor component with category management
    - Create `components/checklist/TemplateEditor.tsx`
    - Render categories with their items, supporting add/rename/delete/reorder categories
    - Support add/delete items within categories
    - Display empty state when template has no items
    - Show inline validation errors for name constraints
    - Prevent "Other" category deletion with error message
    - _Requirements: 1.3, 1.4, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.9, 11.3_

  - [x] 8.3 Build ActiveChecklist component with progress indicator
    - Create `components/checklist/ActiveChecklist.tsx`
    - Render items grouped by category with checkboxes
    - Display `ProgressIndicator` showing `"{checked}/{total} complete"`
    - Show distinct visual completion state when all items checked
    - Include reset button that unchecks all items
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9_

  - [x] 8.4 Build ChecklistView container orchestrating template list, editor, and active checklist
    - Create `components/checklist/ChecklistView.tsx`
    - Manage sub-view state: template list → editor, template list → active checklist
    - Handle template selection to load as active checklist (replaces existing)
    - Wire all dispatch actions to checklist context
    - _Requirements: 3.7, 3.8_

  - [x] 8.5 Write property test for active checklist loading
    - **Property 9: Active Checklist Loading**
    - Generate random templates, load as ActiveChecklist
    - Assert all items have `checked === false`, count matches template, text values match
    - Minimum 100 iterations
    - **Validates: Requirements 3.1, 3.8**

- [x] 9. Weekly Organizer UI components
  - [x] 9.1 Build DayColumn component with task cards
    - Create `components/organizer/DayColumn.tsx`
    - Render task cards for a single weekday with completion styling (strikethrough, reduced opacity)
    - Display type tag color badge on each task card
    - Show recurring task indicator badge
    - Support add task, mark complete/incomplete, delete task inline
    - Show error when 50-task limit reached
    - _Requirements: 4.1, 4.5, 4.6, 4.8, 4.10, 5.1, 5.3, 7.7_

  - [x] 9.2 Build TaskCard component with type tag and recurrence UI
    - Create `components/organizer/TaskCard.tsx`
    - Display task title with completion styling
    - Render type tag badge with correct palette color (lavender/mint/amber/pink)
    - Show recurrence indicator badge
    - Support inline editing of title, type tag selection, recurrence toggle
    - Ensure 44x44px minimum touch targets
    - _Requirements: 4.3, 4.5, 4.6, 5.1, 5.2, 5.4, 5.5, 5.6, 7.1, 7.4, 7.7, 10.4_

  - [x] 9.3 Build OrganizerView with responsive weekly grid and Today filter
    - Create `components/organizer/OrganizerView.tsx`
    - Render 7-day grid at ≥1024px with full day labels
    - Render condensed grid at 768–1023px with abbreviated labels and truncated titles (40 chars + ellipsis)
    - Render single-column with day navigation at <768px
    - Implement TodayFilterToggle: shows only current day's tasks when active, with visual indicator
    - Display empty state when no tasks exist
    - Handle timezone unavailable case (disable Today filter with message)
    - _Requirements: 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.1, 10.2, 10.3, 10.6, 11.2_

  - [x] 9.4 Write component tests for TaskCard and DayColumn
    - Test completion toggle applies strikethrough and reduced opacity
    - Test type tag color rendering for all four tags
    - Test neutral styling when no type tag assigned
    - Test add task disabled at 50-task limit
    - _Requirements: 4.5, 4.6, 5.1, 5.2, 5.3, 4.10_

- [x] 10. Checkpoint — UI integration validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Error handling, toasts, and edge cases
  - [x] 11.1 Implement toast notification system
    - Create `components/Toast.tsx` with non-blocking toast notifications
    - Auto-dismiss after 5 seconds
    - Support warning and info variants
    - Use for: localStorage unavailable, quota exceeded, data corruption recovery
    - _Requirements: 1.9, 3.7, 8.3, 8.6_

  - [x] 11.2 Implement inline validation error display
    - Create reusable `components/InlineError.tsx` component
    - Integrate with template name, category name, and task title inputs
    - Display red text adjacent to the field in both light and dark modes
    - Show capacity limit messages with disabled add buttons
    - _Requirements: 1.2, 1.4, 1.5, 2.2, 2.5, 2.7, 4.2, 4.10_

  - [x] 11.3 Handle "Other" category recovery on load
    - In checklist context initialization, check each template for presence of "Other" category
    - If missing, recreate "Other" as last category in the template's list
    - _Requirements: 2.8_

- [x] 12. Accessibility and performance
  - [x] 12.1 Add ARIA labels, keyboard navigation, and focus management
    - Add `role`, `aria-label`, `aria-checked`, `aria-selected` attributes to interactive elements
    - Ensure tab navigation works through all controls
    - Manage focus on view transitions (template select, tab switch)
    - Ensure all interactive elements have 44x44px touch targets
    - _Requirements: 10.4, 12.2_

  - [x] 12.2 Add loading indicators and CLS prevention
    - Add lightweight loading indicator during state hydration
    - Ensure no layout shifts after initial render (reserve space for dynamic content)
    - Ensure empty states render within 1 second
    - _Requirements: 11.4, 12.1, 12.3, 12.4, 12.5_

- [x] 13. Schema migration support
  - [x] 13.1 Implement schema versioning and migration logic
    - Add migration functions in `lib/migrations.ts`
    - Support forward-compatible loading: strip unknown fields, apply defaults for new fields
    - Version check on load: if stored version < current, run migration chain
    - _Requirements: 8.7_

  - [x] 13.2 Write property test for schema migration forward-compatibility
    - **Property 10: Schema Migration Forward-Compatibility**
    - Generate valid state objects with arbitrary additional unknown fields
    - Assert loading and re-persisting discards unknown fields, preserves recognized fields, applies defaults
    - Minimum 100 iterations
    - **Validates: Requirements 8.7**

- [x] 14. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The app uses TypeScript throughout with Zod for runtime validation
- All state management uses React Context + useReducer pattern
- Persistence uses separate localStorage keys per domain to avoid conflicts
- Dark mode is the default; blocking script prevents flash of light mode

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "3.2", "4.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6", "3.7", "4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "7.1", "7.2"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2"] },
    { "id": 8, "tasks": ["8.4", "8.5", "9.3"] },
    { "id": 9, "tasks": ["9.4", "11.1", "11.2", "11.3"] },
    { "id": 10, "tasks": ["12.1", "12.2", "13.1"] },
    { "id": 11, "tasks": ["13.2"] }
  ]
}
```
