# Requirements Document

## Introduction

The ToDo List Life Dashboard is a client-side, single-page web application built with HTML, CSS, and Vanilla JavaScript. It serves as a personal productivity hub that combines a live clock and greeting, a Pomodoro-style focus timer, a task manager, and a quick-links launcher — all persisted in the browser's Local Storage with no backend required. The application must work as a standalone web page or as a browser extension in modern browsers (Chrome, Firefox, Edge, Safari).

## Glossary

- **Dashboard**: The single-page web application described by these requirements.
- **Greeting_Widget**: The UI component that displays the current time, date, and a time-based greeting.
- **Focus_Timer**: The UI component that provides a 25-minute countdown timer with start, stop, and reset controls.
- **Task_Manager**: The UI component that allows users to create, edit, complete, and delete tasks.
- **Quick_Links**: The UI component that displays user-defined shortcut buttons to external websites.
- **Storage**: The browser's Local Storage API used to persist all application data client-side.
- **Task**: A user-created item in the Task_Manager with a title and a completion status.
- **Link**: A user-created record in Quick_Links containing a label and a URL.
- **Session**: A single 25-minute countdown cycle managed by the Focus_Timer.
- **Active_Session**: A Session that has been started and is currently counting down.
- **Idle_Session**: A Session that has not been started, or has been stopped or reset.

---

## Requirements

### Requirement 1: Live Clock and Date Display

**User Story:** As a user, I want to see the current time and date at a glance, so that I can stay oriented throughout my work session.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display the current local time in HH:MM:SS 24-hour format, updated at intervals of 1000ms (±50ms).
2. THE Greeting_Widget SHALL display the current local date in the format: full weekday name, day (1–2 digits), full month name, 4-digit year (e.g., "Monday, 26 November 2026").
3. WHEN the Dashboard load completes, THE Greeting_Widget SHALL display the correct time and date within 1 second of load completion, without requiring user interaction.
4. IF the system clock is unavailable, THEN THE Greeting_Widget SHALL display a placeholder string (e.g., "--:--:--") in place of the time and date and SHALL not throw an unhandled error.

---

### Requirement 2: Time-Based Greeting

**User Story:** As a user, I want to see a personalized greeting based on the time of day, so that the Dashboard feels welcoming and contextually relevant.

#### Acceptance Criteria

1. WHILE the local time is between 05:00 and 11:59, THE Greeting_Widget SHALL display the greeting "Good Morning".
2. WHILE the local time is between 12:00 and 16:59, THE Greeting_Widget SHALL display the greeting "Good Afternoon".
3. WHILE the local time is between 17:00 and 20:59, THE Greeting_Widget SHALL display the greeting "Good Evening".
4. WHILE the local time is between 21:00 and 04:59, THE Greeting_Widget SHALL display the greeting "Good Night".
5. WHEN the local time crosses a greeting boundary, THE Greeting_Widget SHALL replace the displayed greeting with the new greeting within 60 seconds, without requiring a page reload.

---

### Requirement 3: Focus Timer — Countdown

**User Story:** As a user, I want a 25-minute countdown timer, so that I can work in focused Pomodoro-style sessions.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Focus_Timer SHALL display the initial time as 25:00 (MM:SS format) in an Idle_Session state.
2. WHEN the user activates the start control while in an Idle_Session state, THE Focus_Timer SHALL transition to Active_Session state and begin counting down from the displayed time.
3. WHILE in an Active_Session, THE Focus_Timer SHALL decrement the displayed time by one second at intervals of 1000ms (±50ms).
4. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop, transition to Idle_Session state with the display reset to 25:00, and notify the user via a browser alert or a non-dismissible on-screen message visible for at least 3 seconds.
5. IF the user activates the start control while in an Active_Session state, THEN THE Focus_Timer SHALL ignore the input and continue counting down without interruption.

---

### Requirement 4: Focus Timer — Controls

**User Story:** As a user, I want start, stop, and reset controls for the timer, so that I can manage my focus sessions flexibly.

#### Acceptance Criteria

1. THE Focus_Timer SHALL provide a start control, a stop control, and a reset control.
2. WHEN the user activates the stop control during an Active_Session, THE Focus_Timer SHALL pause the countdown and transition to Idle_Session, preserving the remaining time.
3. WHEN the user activates the start control during an Idle_Session with remaining time greater than 0 seconds, THE Focus_Timer SHALL transition to Active_Session and resume the countdown from the preserved remaining time.
4. IF the user activates the start control during an Idle_Session with 0 seconds remaining, THEN THE Focus_Timer SHALL ignore the input and keep the start control disabled.
5. WHEN the user activates the reset control, THE Focus_Timer SHALL stop any Active_Session, transition to Idle_Session, and reset the displayed time to the configured session duration (25:00), discarding any preserved remaining time.
6. WHILE in an Idle_Session, THE Focus_Timer SHALL render the stop control in a disabled state.
7. WHILE in an Active_Session, THE Focus_Timer SHALL render the start control in a disabled state.

---

### Requirement 5: Task Creation

**User Story:** As a user, I want to add new tasks to my list, so that I can track what I need to accomplish.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a text input field with a maximum length of 255 characters and an add control for creating Tasks.
2. WHEN the user submits a non-empty task title via the add control or by pressing the Enter key, THE Task_Manager SHALL add a new Task with that title and an incomplete status to the task list.
3. WHEN a new Task is added, THE Task_Manager SHALL persist the updated task list to Storage within 1 second.
4. WHEN a new Task is added, THE Task_Manager SHALL clear the text input field.
5. IF the user attempts to submit an empty or whitespace-only task title, THEN THE Task_Manager SHALL not create a Task and SHALL display an inline error message adjacent to the input field indicating that a task title is required, until the user modifies the input field content.
6. IF Storage is unavailable when persisting a new Task, THEN THE Task_Manager SHALL retain the Task in the displayed task list and SHALL display an error message indicating that the task could not be saved.

---

### Requirement 6: Task Editing

**User Story:** As a user, I want to edit existing task titles, so that I can correct or update my tasks without deleting and recreating them.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide an edit control for each Task in the list.
2. WHEN the user activates the edit control for a Task, THE Task_Manager SHALL display an editable input field pre-filled with the Task's current title.
3. WHEN the user confirms the edit with a title containing at least one non-whitespace character and no more than 255 characters, THE Task_Manager SHALL update the Task's title in the list and persist the updated task list to Storage.
4. IF the user confirms the edit with an empty, whitespace-only, or greater than 255 character title, THEN THE Task_Manager SHALL not save the change and SHALL display an inline error indicator adjacent to the input field.
5. WHEN the user cancels the edit by pressing the Escape key or activating a cancel control, THE Task_Manager SHALL restore the original Task title without modifying Storage.
6. IF Storage is unavailable when the Task_Manager attempts to persist the updated task list, THEN THE Task_Manager SHALL not update the Task's title in the list and SHALL display an error message indicating the save failed.

---

### Requirement 7: Task Completion

**User Story:** As a user, I want to mark tasks as done, so that I can track my progress and see what I have completed.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a completion toggle control for each Task that has two mutually exclusive states: checked (complete) and unchecked (incomplete).
2. WHEN the user activates the completion toggle on an incomplete Task, THE Task_Manager SHALL mark the Task as complete and apply a strikethrough style to the Task title text.
3. WHEN the user activates the completion toggle on a complete Task, THE Task_Manager SHALL mark the Task as incomplete and remove the strikethrough style from the Task title text.
4. WHEN the completion status of a Task changes, THE Task_Manager SHALL persist the updated task list to Storage within 1 second of the status change.
5. IF persistence to Storage fails, THEN THE Task_Manager SHALL display an error message indicating that the save failed and preserve the in-memory completion state change.

---

### Requirement 8: Task Deletion

**User Story:** As a user, I want to delete tasks I no longer need, so that my list stays clean and relevant.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a delete control for each Task displayed in the task list.
2. WHEN the user activates the delete control for a Task, THE Task_Manager SHALL display a confirmation prompt asking the user to confirm the deletion before removing the Task.
3. WHEN the user confirms the deletion prompt, THE Task_Manager SHALL permanently remove that Task from the task list.
4. IF the user cancels the confirmation prompt, THEN THE Task_Manager SHALL dismiss the prompt and leave the Task unchanged in the task list.
5. WHEN a Task is deleted, THE Task_Manager SHALL persist the updated task list to Storage within 1 second of the deletion being confirmed.

---

### Requirement 9: Task Persistence

**User Story:** As a user, I want my tasks to be saved automatically, so that I do not lose my list when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Task_Manager SHALL read the task list from Storage and render all previously saved Tasks.
2. WHEN any Task is created, edited, deleted, or marked complete, THE Task_Manager SHALL write the updated task list to Storage as a serialized JSON array.
3. WHEN the Dashboard loads after a prior session, THE Task_Manager SHALL render each Task with the same title and completion status as when it was last saved.
4. IF Storage is unavailable or the stored data cannot be parsed as a valid JSON array of Tasks, THEN THE Task_Manager SHALL initialize with an empty task list.
5. IF Storage is unavailable or the stored data cannot be parsed as a valid JSON array of Tasks, THEN THE Task_Manager SHALL NOT propagate an unhandled error to the user interface.

---

### Requirement 10: Quick Links — Display and Navigation

**User Story:** As a user, I want quick-access buttons to my favorite websites, so that I can navigate to them with a single click from the Dashboard.

#### Acceptance Criteria

1. THE Quick_Links SHALL display each saved Link as a labelled button, showing the Link's label truncated to a maximum of 30 characters if the label exceeds that length.
2. WHEN the user activates a Link button, THE Quick_Links SHALL open the corresponding URL in a new browser tab.
3. WHEN the Dashboard loads, THE Quick_Links SHALL read saved Links from Storage and render all previously saved Link buttons.
4. IF the Dashboard loads and no Links are saved in Storage, THEN THE Quick_Links SHALL display an empty state message indicating that no links have been added yet.

---

### Requirement 11: Quick Links — Management

**User Story:** As a user, I want to add and remove quick links, so that I can customize the Dashboard to my browsing habits.

#### Acceptance Criteria

1. THE Quick_Links SHALL provide an add control that accepts a link label of 1–100 characters and a URL of 1–2048 characters.
2. WHEN the user submits a label of 1–100 characters and a URL that begins with `http://` or `https://` and does not exceed 2048 characters, THE Quick_Links SHALL create a new Link, add its button to the display, and persist the updated link list to Storage, provided the total number of stored Links does not already equal 20.
3. IF the user submits an empty label, a label exceeding 100 characters, an empty URL, a URL not beginning with `http://` or `https://`, or a URL exceeding 2048 characters, THEN THE Quick_Links SHALL not create a Link and SHALL display a visual indicator on each invalid field; that indicator SHALL be removed from a field once the user modifies its input.
4. THE Quick_Links SHALL provide a delete control for each Link button.
5. WHEN the user activates the delete control for a Link, THE Quick_Links SHALL permanently remove that Link and persist the updated link list to Storage.
6. THE Quick_Links SHALL store all Links in Storage as a serialized JSON array.
7. FOR ALL valid link list states, serializing then deserializing the link list SHALL produce a link list with the same number of entries, and each entry at the same position SHALL have an identical label and URL as the original.
8. IF Storage is unavailable or the stored data is malformed at load time, THEN THE Quick_Links SHALL initialize with an empty link list and SHALL not throw an unhandled error.
9. IF a Storage write operation fails during an add or delete action, THEN THE Quick_Links SHALL revert the in-memory link list to its state before the action and SHALL display an error message indicating that the change could not be saved.
10. IF the total number of stored Links already equals 20 and the user submits a valid add request, THEN THE Quick_Links SHALL not create a new Link and SHALL display an error message indicating that the maximum number of links has been reached.

---

### Requirement 12: Project Structure and Technical Constraints

**User Story:** As a developer, I want a well-defined project structure, so that the codebase is easy to navigate and maintain.

#### Acceptance Criteria

1. THE Dashboard SHALL be implemented using only HTML, CSS, and Vanilla JavaScript with no external frameworks or libraries.
2. THE Dashboard SHALL contain exactly one HTML entry point file located in the project root directory (e.g., `index.html`).
3. THE Dashboard SHALL contain exactly one CSS file located inside a `css/` directory.
4. THE Dashboard SHALL contain exactly one JavaScript file located inside a `js/` directory.
5. THE Dashboard SHALL require no backend server to function.
6. THE Dashboard SHALL function correctly when opened directly from the file system via a `file://` URL or served from a static host.
7. THE Dashboard SHALL function correctly in the latest stable release of Chrome, Firefox, Edge, and Safari available at the time of testing, where "functions correctly" means all acceptance criteria in this document are satisfied without browser-specific workarounds.

---

### Requirement 13: Performance and Visual Design

**User Story:** As a user, I want the Dashboard to load quickly and look clean, so that it is pleasant and efficient to use every day.

#### Acceptance Criteria

1. WHEN the Dashboard is opened, THE Dashboard SHALL render all UI components and display all saved data within 2 seconds, measured on a device with a mid-range consumer CPU (equivalent to a 4-core processor at 2GHz or above) and an empty browser cache.
2. WHEN the user performs a task add, delete, edit, or timer tick interaction, THE Dashboard SHALL apply the corresponding UI update within 100ms of the interaction.
3. THE Dashboard SHALL present each of the Greeting_Widget, Focus_Timer, Task_Manager, and Quick_Links sections with a visible section heading and a minimum of 16px of vertical spacing separating each section from adjacent sections.
4. THE Dashboard SHALL render all body text at a minimum font size of 14px and all label or helper text at a minimum font size of 12px at the browser's default zoom level (100%).

---

### Requirement 14: Light / Dark Mode Toggle

**User Story:** As a user, I want to switch between a dark theme and a light theme, so that I can use the Dashboard comfortably in different lighting environments.

#### Acceptance Criteria

1. THE Dashboard SHALL display a theme toggle control in the header area, identifiable with an `id` of `theme-toggle`, containing a sun or moon icon to indicate the current theme state.
2. THE Dashboard SHALL apply the dark theme by default WHEN no theme preference is saved in Storage.
3. WHEN the user activates the theme toggle control while the dark theme is active, THE Dashboard SHALL switch to the light theme by adding the class `light-mode` to the `<body>` element.
4. WHEN the user activates the theme toggle control while the light theme is active, THE Dashboard SHALL switch to the dark theme by removing the class `light-mode` from the `<body>` element.
5. WHEN the theme changes, THE Dashboard SHALL persist the new theme preference to Storage under the key `tdld_theme` with the value `'light'` or `'dark'`.
6. WHEN the Dashboard loads, THE Dashboard SHALL read the theme preference from Storage under key `tdld_theme` and apply the corresponding theme before rendering any visible UI content.
7. THE theme toggle control SHALL carry an `aria-label` attribute describing its purpose and an `aria-pressed` attribute reflecting the current state (`'true'` when light theme is active, `'false'` when dark theme is active).
8. IF Storage is unavailable when persisting the theme preference, THEN THE Dashboard SHALL retain the in-memory theme change and SHALL display an error message indicating that the preference could not be saved.

---

### Requirement 15: Custom Name in Greeting

**User Story:** As a user, I want to set my name in the greeting widget, so that the Dashboard addresses me personally.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL display a name area identified by the element `id` `user-name-display` that shows the saved user name when one is stored, or remains empty when no name is saved.
2. THE Greeting_Widget SHALL provide an edit control identified by the element `id` `user-name-edit-btn` that, when activated, replaces the name display with an editable inline input field pre-filled with the current name (or empty if no name is set).
3. WHEN a name is saved and the Greeting_Widget renders a greeting, THE Greeting_Widget SHALL append the name to the greeting string in the format `"[Greeting], [Name]!"` (e.g., `"Good Morning, Joy!"`).
4. WHEN no name is saved, THE Greeting_Widget SHALL render the greeting string without a name or punctuation suffix (e.g., `"Good Morning"`).
5. WHEN the user confirms the name edit with a value containing at least one non-whitespace character and no more than 50 characters, THE Greeting_Widget SHALL store the trimmed name, update the greeting display, and persist the name to Storage under the key `tdld_user_name`.
6. IF the user confirms the name edit with an empty or whitespace-only value, THEN THE Greeting_Widget SHALL clear the stored name, render the greeting without a name, and persist an empty string to Storage under key `tdld_user_name`.
7. WHEN the user cancels the name edit by pressing the Escape key or activating a cancel control, THE Greeting_Widget SHALL restore the previous name display without modifying Storage.
8. WHEN the Dashboard loads, THE Greeting_Widget SHALL read the stored name from Storage under key `tdld_user_name` and apply it to the greeting before the first render.
9. IF Storage is unavailable when persisting the user name, THEN THE Greeting_Widget SHALL retain the in-memory name change and SHALL display an error message indicating that the preference could not be saved.

---

### Requirement 16: Prevent Duplicate Tasks

**User Story:** As a user, I want to be prevented from adding or editing a task to a title that already exists, so that my task list stays unambiguous and free of duplicates.

#### Acceptance Criteria

1. WHEN the user submits a new task title whose trimmed value matches the trimmed title of any existing Task in a case-insensitive comparison, THE Task_Manager SHALL not create the Task and SHALL display the inline error message "A task with this title already exists." on `#task-error`.
2. WHEN the user confirms an edit with a new title whose trimmed value matches the trimmed title of any Task other than the Task being edited in a case-insensitive comparison, THE Task_Manager SHALL not save the change and SHALL display the inline error message "A task with this title already exists." adjacent to the edit input field.
3. WHEN the submitted new task title does not match any existing Task title under the case-insensitive comparison, THE Task_Manager SHALL proceed with task creation as defined in Requirement 5.
4. WHEN the confirmed edit title does not match any other Task title under the case-insensitive comparison, THE Task_Manager SHALL proceed with the edit as defined in Requirement 6.
5. THE Task_Manager SHALL perform the duplicate check using a helper function `isDuplicate(title, excludeId)` that returns `true` if any task whose `id` does not equal `excludeId` has a trimmed title equal to the trimmed input title under a case-insensitive locale comparison, and returns `false` otherwise; `excludeId` SHALL be `null` when checking for new task additions.
