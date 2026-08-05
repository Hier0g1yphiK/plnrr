# Requirements Document

## Introduction

Stream Prep is a standalone web app for content creators/streamers with two core tools: a reusable pre-stream checklist system and a weekly task organizer. The app is built with Next.js, TypeScript, and Tailwind CSS, using a dark-mode-first aesthetic that mirrors the color palette and theme tokens from the saithsfuff-site reference (lavender/pink/mint palette, Fredoka display font, Nunito body font, class-based dark mode). All state is persisted client-side via localStorage for v1 — no backend required.

## Glossary

- **Checklist_Engine**: The subsystem responsible for creating, storing, loading, resetting, and rendering pre-stream checklist templates and their active instances.
- **Template**: A named, reusable collection of checklist items organized into categories. Templates are not modified when an active checklist is checked/reset.
- **Active_Checklist**: A runtime instance of a template where items can be checked off. Represents the current session's progress.
- **Category**: A user-defined grouping label for checklist items within a template (e.g. "Software", "Physical Setup").
- **Weekly_Organizer**: The subsystem responsible for managing tasks across a Monday–Sunday weekly view.
- **Task_Card**: A single task entry within the weekly organizer, containing a title, weekday assignment (Monday–Sunday), type tag, completion status, and optional recurrence rule. Tasks are assigned to a perpetual weekday bucket, not a specific calendar date.
- **Type_Tag**: A color-coded label applied to a task card indicating its category (Stream Day, Content Planning, Admin/Business, Editing).
- **Recurrence_Rule**: A flag on a Task_Card indicating it should automatically reset to incomplete every Monday at 00:00 local time, remaining on its assigned weekday indefinitely until the user deletes it or disables recurrence.
- **Theme_Engine**: The subsystem managing dark/light mode toggling and applying the reference site's color palette.
- **Persistence_Layer**: The localStorage-based subsystem responsible for serializing, storing, and retrieving application state across page reloads.
- **Progress_Indicator**: A visual element displaying checklist completion as a fraction (e.g. "7/12 complete").

## Requirements

### Requirement 1: Create Checklist Templates

**User Story:** As a streamer, I want to create multiple named checklist templates so that I can maintain different pre-stream routines for different stream types.

#### Acceptance Criteria

1. WHEN the user submits a new template name of 1 to 100 characters, THE Checklist_Engine SHALL create a new template with the given name and an empty item list.
2. IF the user submits a template name that is empty or exceeds 100 characters, THEN THE Checklist_Engine SHALL reject the creation and display an error message indicating the name length constraint.
3. WHEN the user adds an item to a template, THE Checklist_Engine SHALL append the item to the specified category within that template, up to a maximum of 50 items per template.
4. IF the user attempts to add an item to a template that already contains 50 items, THEN THE Checklist_Engine SHALL reject the addition and display an error message indicating the per-template item limit has been reached.
5. IF the user creates a template with a name that already exists (case-insensitive match), THEN THE Checklist_Engine SHALL reject the creation and display an error message indicating a duplicate name.
6. THE Checklist_Engine SHALL render the template list within 100ms when up to 20 templates exist, consistent with the interaction response budget defined in Requirement 12.
7. WHEN the user edits a template name, THE Checklist_Engine SHALL update the template's name to the new value (subject to the same 1-to-100-character and uniqueness constraints) while preserving all items and categories.
8. WHEN the user deletes a template, THE Checklist_Engine SHALL remove the template and all its items from storage.
9. IF localStorage is unavailable or a write operation fails, THEN THE Checklist_Engine SHALL display an error message indicating that changes could not be saved and SHALL preserve the user's in-memory state.

### Requirement 2: Manage Checklist Categories

**User Story:** As a streamer, I want to organize checklist items into custom categories so that I can group related setup steps together.

#### Acceptance Criteria

1. WHEN the user creates a new category within a template, THE Checklist_Engine SHALL add the category to that template's category list with a name between 1 and 50 characters.
2. IF the user attempts to create a category with a name that already exists within the same template, THEN THE Checklist_Engine SHALL reject the creation and display an error message indicating the category name is already in use.
3. THE Checklist_Engine SHALL provide default categories of "Software", "Physical Setup", "Content", and "Other" when a new template is created.
4. WHEN the user renames a category, THE Checklist_Engine SHALL update the category name while preserving all items assigned to it.
5. IF the user attempts to rename a category to a name that already exists within the same template, THEN THE Checklist_Engine SHALL reject the rename and display an error message indicating the category name is already in use.
6. WHEN the user deletes a category that contains items, THE Checklist_Engine SHALL move those items to the "Other" category before removing the deleted category, appending them after any existing items in "Other".
7. IF the user attempts to delete the "Other" category, THEN THE Checklist_Engine SHALL prevent the deletion and display an error message indicating that the default fallback category cannot be removed.
8. IF the "Other" category is found to be missing when the application loads (e.g., due to data corruption), THEN THE Checklist_Engine SHALL automatically recreate the "Other" category as the last category in the template's category list.
9. WHEN the user reorders categories within a template, THE Checklist_Engine SHALL persist the new ordering and display categories in that order on subsequent loads.

### Requirement 3: Run Active Checklist

**User Story:** As a streamer, I want to load a template as an active checklist and check off items so that I can track my pre-stream progress in real time.

#### Acceptance Criteria

1. WHEN the user selects a template, THE Checklist_Engine SHALL create an Active_Checklist instance with all items set to unchecked, preserving the item order and text from the source template, and persist the Active_Checklist state to localStorage within 1 second.
2. WHEN the user checks an item in the Active_Checklist, THE Checklist_Engine SHALL mark that item as complete, persist the updated state to localStorage within 1 second, and update the Progress_Indicator to reflect the new checked count.
3. WHEN the user unchecks a previously checked item in the Active_Checklist, THE Checklist_Engine SHALL mark that item as incomplete, persist the updated state to localStorage within 1 second, and update the Progress_Indicator to reflect the new checked count.
4. THE Progress_Indicator SHALL display completion as "{checked_count}/{total_count} complete" where checked_count is the number of items with checked state true and total_count is the total number of items in the Active_Checklist, bounded by the source template's item limit (maximum 50 per Requirement 1).
5. WHEN all items are checked, THE Progress_Indicator SHALL display a visual completion state distinct from partial completion that is visible without scrolling or additional interaction.
6. WHEN the user triggers a reset, THE Checklist_Engine SHALL set all items in the Active_Checklist to unchecked, persist the reset state to localStorage within 1 second, and update the Progress_Indicator to display "0/{total_count} complete" without modifying the source template.
7. IF localStorage is unavailable or a write operation fails, THEN THE Checklist_Engine SHALL retain the current Active_Checklist state in memory for the duration of the session and display an error indication to the user that state could not be persisted.
8. IF the user selects a template while an Active_Checklist already exists, THEN THE Checklist_Engine SHALL replace the existing Active_Checklist with a new unchecked instance from the selected template.
9. FOR ALL Active_Checklist instances, the checked count displayed by the Progress_Indicator SHALL equal the number of items with a checked state of true (invariant property).

### Requirement 4: Weekly Task Management

**User Story:** As a streamer, I want to create, edit, and delete tasks assigned to specific days of the week so that I can plan my weekly workload.

#### Acceptance Criteria

1. WHEN the user submits a new task with a non-empty title (between 1 and 100 characters) and a valid weekday assignment (Monday through Sunday), THE Weekly_Organizer SHALL add a new Task_Card to the specified weekday's column.
2. IF the user attempts to create or save a task with an empty or whitespace-only title, THEN THE Weekly_Organizer SHALL prevent the save and display an error message indicating that a title is required.
3. WHEN the user edits a task's title or weekday assignment to valid values, THE Weekly_Organizer SHALL update the Task_Card accordingly and persist the change to localStorage.
4. WHEN the user deletes a task, THE Weekly_Organizer SHALL remove the Task_Card from the weekly view and from localStorage.
5. WHEN the user marks a task as complete, THE Weekly_Organizer SHALL display the Task_Card with a strikethrough on the title text and a reduced opacity to distinguish it from active tasks.
6. WHEN the user marks a completed task as incomplete, THE Weekly_Organizer SHALL restore the Task_Card to its active visual state with no strikethrough and full opacity.
7. THE Weekly_Organizer SHALL display weekdays in Monday-through-Sunday order as a perpetual board with no calendar date or week number attached to tasks.
8. THE Weekly_Organizer SHALL support a maximum of 50 tasks per weekday.
9. Non-recurring completed tasks SHALL remain visible in their assigned weekday column until the user explicitly deletes them. THE Weekly_Organizer SHALL NOT auto-clear or auto-archive completed tasks.
10. IF the user attempts to add a task to a weekday that already contains 50 tasks, THEN THE Weekly_Organizer SHALL reject the addition and display an error message indicating the per-day limit has been reached.

### Requirement 5: Task Type Tagging

**User Story:** As a streamer, I want to color-code tasks by type so that I can quickly distinguish stream days from admin work at a glance.

#### Acceptance Criteria

1. WHEN the user assigns a Type_Tag to a task, THE Weekly_Organizer SHALL display the Task_Card with the corresponding background color coding within 200ms of selection.
2. THE Weekly_Organizer SHALL provide exactly four Type_Tag options, each mapped to a distinct palette color: "Stream Day" → lavender, "Content Planning" → mint, "Admin/Business" → amber, and "Editing" → pink.
3. WHEN a task has no Type_Tag assigned, THE Weekly_Organizer SHALL display the Task_Card with a neutral default style that uses no color coding associated with any Type_Tag.
4. THE Weekly_Organizer SHALL use the assigned palette colors (lavender, mint, amber, pink) for Type_Tag backgrounds, maintaining WCAG 4.5:1 contrast ratio between the Type_Tag text label and its background color in both light and dark modes.
5. WHEN the user selects a different Type_Tag for a task that already has one assigned, THE Weekly_Organizer SHALL replace the previous color coding with the newly selected Type_Tag color.
6. IF the user removes a Type_Tag from a task, THEN THE Weekly_Organizer SHALL revert the Task_Card to the neutral default style.

### Requirement 6: Today Filter

**User Story:** As a streamer, I want to filter the weekly view to show only today's tasks so that I can focus on what matters right now.

#### Acceptance Criteria

1. WHEN the user activates the Today filter, THE Weekly_Organizer SHALL display only the Task_Cards assigned to the current day of the week and hide all other days from the view.
2. WHILE the Today filter is active AND the view is correctly displaying only the current day's tasks, THE Weekly_Organizer SHALL display a persistent visual indicator distinguishing the filtered state from the unfiltered state.
3. WHEN the user deactivates the Today filter, THE Weekly_Organizer SHALL restore the full Monday–Sunday view with all Task_Cards in their assigned positions within 500 milliseconds.
4. IF the current day has no Task_Cards assigned, THEN THE Weekly_Organizer SHALL display an empty state message indicating no tasks are scheduled for today.
5. WHEN the user activates the Today filter, THE Weekly_Organizer SHALL determine the current day based on the user's local browser timezone.
6. IF the user's local browser timezone is unavailable, THEN THE Weekly_Organizer SHALL disable the Today filter and display a non-blocking message indicating that timezone detection is required for this feature.

### Requirement 7: Recurring Tasks

**User Story:** As a streamer, I want to mark tasks as weekly recurring so that routine tasks automatically appear each week without manual re-entry.

#### Acceptance Criteria

1. WHEN the user enables recurrence on a task, THE Weekly_Organizer SHALL assign a Recurrence_Rule to the Task_Card, marking it as a recurring task on its currently assigned weekday.
2. WHEN the client-side clock reaches Monday 00:00:00 local time, THE Weekly_Organizer SHALL reset all recurring tasks to incomplete, regardless of their current completion state.
3. WHEN the user deletes a recurring task, THE Weekly_Organizer SHALL remove both the Task_Card and its Recurrence_Rule permanently.
4. WHEN the user disables recurrence on a task, THE Weekly_Organizer SHALL remove the Recurrence_Rule while preserving the Task_Card and its current completion state. The task becomes a regular non-recurring task.
5. WHEN the user opens the Weekly_Organizer after one or more Mondays have elapsed since the last session, THE Weekly_Organizer SHALL evaluate the current local time and, if Monday 00:00 has passed since the last recorded session, reset all recurring tasks to incomplete.
6. THE Weekly_Organizer SHALL persist a "last reset timestamp" in localStorage to determine whether recurring tasks need resetting on application load.
7. Recurring tasks SHALL be visually distinguished from non-recurring tasks (e.g., a recurring icon or badge) so the user can identify which tasks will auto-reset.

### Requirement 8: Client-Side Persistence

**User Story:** As a streamer, I want my checklists and weekly tasks to survive page reloads so that I don't lose my setup between sessions.

#### Acceptance Criteria

1. WHEN the application state changes (template created, item checked, task added, or item removed), THE Persistence_Layer SHALL serialize the current state and write it to localStorage within 1 second of the state change.
2. WHEN the application loads, THE Persistence_Layer SHALL read stored state from localStorage and restore it as the active application state before the user interface becomes interactive.
3. IF localStorage is unavailable or the stored data fails JSON parsing or schema validation, THEN THE Persistence_Layer SHALL initialize with empty default state (no templates, no checked items, no weekly tasks) and display a non-blocking warning indicating that prior data could not be restored.
4. FOR ALL valid application states, serializing then deserializing the state SHALL produce an equivalent object (round-trip property).
5. THE Persistence_Layer SHALL store checklist data and weekly organizer data under separate localStorage keys to avoid overwrite conflicts.
6. IF localStorage write fails due to storage quota being exceeded (exceeding 5 MB per origin), THEN THE Persistence_Layer SHALL display a non-blocking warning indicating that state could not be saved and SHALL retain the current in-memory state without data loss.
7. WHEN the application loads and stored state contains keys or fields not present in the current application schema, THE Persistence_Layer SHALL discard unrecognized fields, preserve all recognized fields, and apply default values for any newly added fields.

### Requirement 9: Dark Mode and Theming

**User Story:** As a streamer, I want the app to default to dark mode with a theme matching my existing site so that the visual experience is consistent across my tools.

#### Acceptance Criteria

1. WHEN the application loads with no stored theme preference, THE Theme_Engine SHALL activate dark mode by default and apply the `dark` class to the document element within 100ms of initial render.
2. WHEN the user toggles the theme, THE Theme_Engine SHALL switch between dark and light modes, apply or remove the `dark` class on the document element, and persist the selected preference ("dark" or "light") to localStorage within 200ms of the toggle action.
3. THE Theme_Engine SHALL apply the reference site's color palette consisting of lavender as the primary color, pink as the accent color, mint as the success/secondary color, and amber as the warning/highlight color, with dark mode backgrounds using `lavender-900` tones.
4. THE Theme_Engine SHALL use class-based dark mode toggling by adding or removing the `dark` class on the document root element (`darkMode: "class"`).
5. WHEN the stored theme preference is "light", THE Theme_Engine SHALL activate light mode on application load and not apply the `dark` class to the document element.
6. IF localStorage is unavailable or the stored theme preference value is neither "dark" nor "light", THEN THE Theme_Engine SHALL fall back to dark mode as the default and not produce a user-visible error. This criterion takes precedence over criterion 5 — if localStorage is unavailable, the Theme_Engine SHALL activate dark mode regardless of any previously stored preference.
7. WHEN the user toggles the theme, THE Theme_Engine SHALL update all rendered UI elements to reflect the new mode without requiring a page reload.

### Requirement 10: Responsive Layout

**User Story:** As a streamer, I want the app to be usable on my laptop alongside streaming software, and still functional on tablet/phone, so that I can check my prep from any device.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or above, THE application SHALL render a full weekly grid view displaying all 7 days with full day-name labels and all scheduled content items visible without horizontal scrolling.
2. WHILE the viewport width is below 768px, THE application SHALL collapse the weekly grid into a single-column stacked layout showing one day at a time, with a navigation mechanism to switch between days.
3. WHILE the viewport width is between 768px and 1023px, THE application SHALL display a condensed grid with abbreviated day labels (3-character maximum, e.g., "Mon", "Tue") and truncated content item titles to a maximum of 40 characters with an ellipsis indicator.
4. THE application SHALL maintain touch targets of at least 44x44 CSS pixels on all interactive elements across all viewport widths.
5. WHEN the viewport width changes (due to window resize or device rotation), THE application SHALL re-render to the appropriate layout without requiring a page reload and without losing the user's current scroll position or selected day context. THE application SHALL prioritize showing complete layouts over meeting a strict time threshold on slower devices.
6. WHILE the viewport width is below 768px, THE application SHALL display text at a minimum size of 14px for content labels and 12px for secondary metadata to maintain readability without zooming.
7. IF a layout transition occurs while a modal or popover is open, THEN THE application SHALL reposition the modal or popover to remain fully visible within the new viewport dimensions without clipping.

### Requirement 11: Empty States

**User Story:** As a streamer, I want clear guidance when I first open the app with no data so that I know how to get started.

#### Acceptance Criteria

1. WHEN no checklist templates exist, THE Checklist_Engine SHALL display an empty state message and a single call-to-action element that initiates template creation.
2. WHEN no tasks exist in the weekly organizer, THE Weekly_Organizer SHALL display an empty state message and a single call-to-action element that initiates task creation.
3. WHEN a template has no items, THE Checklist_Engine SHALL display an empty state message within the template editing view and a single call-to-action element that initiates item addition.
4. WHEN an empty state is being prepared, THE System SHALL display a lightweight loading indicator. The empty state message and call-to-action SHALL render within 1 second of the view loading, without requiring the user to scroll to discover them.
5. IF the user activates the call-to-action element in any empty state, THEN THE System SHALL navigate the user to the corresponding creation flow within 1 second.

### Requirement 12: Glanceable UI Performance

**User Story:** As a streamer, I want the interface to load and respond instantly so that I can check my prep in the final minutes before going live.

#### Acceptance Criteria

1. THE application SHALL render the initial view within 1 second of navigation on a standard broadband connection (defined as 10 Mbps download speed or greater).
2. WHEN the user interacts with a checkbox or button, THE application SHALL reflect the state change within 100ms.
3. THE application SHALL avoid layout shifts after initial render (Cumulative Layout Shift below 0.1).
4. WHEN the application loads, THE application SHALL display all above-the-fold content without requiring data fetches that block rendering (localStorage reads complete within the 1-second render budget).
5. IF localStorage data is unavailable or corrupted, THEN THE application SHALL render the initial view with default empty state within 1 second, without displaying an error that blocks interaction.

## Correctness Properties for Property-Based Testing

### Property 1: Progress Indicator Invariant

For all Active_Checklist instances with N total items and K items in checked state, the Progress_Indicator SHALL display exactly "K/N complete". This ensures the displayed count always equals the actual checked count, regardless of check/uncheck ordering.

- **Pattern**: Invariant
- **Generator**: Random sequence of check/uncheck operations on a random subset of items
- **Oracle**: Count items with `checked === true` and compare to displayed numerator

### Property 2: Persistence Round-Trip

For all valid application states S, `deserialize(serialize(S))` SHALL produce a state equivalent to S. This ensures no data loss across page reloads.

- **Pattern**: Round-trip
- **Generator**: Arbitrary valid states (random templates with random items, random tasks with random tags/days)
- **Oracle**: Deep equality between original and round-tripped state

### Property 3: Reset Idempotence

For all Active_Checklist instances, applying the reset operation once SHALL produce the same state as applying it multiple times. Formally: `reset(checklist) === reset(reset(checklist))`.

- **Pattern**: Idempotence
- **Generator**: Active checklists with random check states
- **Oracle**: Compare state after single reset to state after double reset

### Property 4: Template Isolation

For all templates T and their Active_Checklist instances A, any sequence of check, uncheck, or reset operations on A SHALL leave T unchanged. The template's item list and categories remain identical before and after all active checklist interactions.

- **Pattern**: Invariant
- **Generator**: Random template, load as active checklist, apply random operations
- **Oracle**: Deep equality of template before and after operations

### Property 5: Task Count Metamorphic Property

For all weekly board states with N total tasks across all weekdays, adding a task SHALL result in N+1 total tasks, and deleting a task SHALL result in N-1 total tasks. Filtering (Today filter) SHALL return a count less than or equal to the total task count.

- **Pattern**: Metamorphic
- **Generator**: Random weekly states with random add/delete/filter operations
- **Oracle**: `count_after_add === count_before + 1`, `count_after_delete === count_before - 1`, `count_filtered <= count_total`

### Property 6: Category Deletion Item Preservation

For all templates, deleting a category SHALL preserve the total item count. Items from the deleted category SHALL appear in the "Other" category.

- **Pattern**: Invariant
- **Generator**: Templates with random items distributed across random categories
- **Oracle**: `total_items_before === total_items_after` and deleted category's items appear in "Other"
