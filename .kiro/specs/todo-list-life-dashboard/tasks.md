# Implementation Plan: ToDo List Life Dashboard

## Overview

Implement a self-contained, client-side Single-Page Application using plain HTML, CSS, and Vanilla JavaScript. All code lives in three files: `index.html`, `css/style.css`, and `js/app.js`. No build step, no frameworks, no backend. All persistence uses `localStorage`.

## Tasks

- [x] 1. Create project structure and HTML entry point
  - [x] 1.1 Create directory structure (`css/` and `js/` subdirectories) and `index.html` in project root
    - Scaffold the semantic HTML layout with `<header>` for the Greeting Widget and `<main>` for Focus Timer, Task Manager, and Quick Links
    - Add all required `id` attributes: `clock-time`, `clock-date`, `clock-greeting`, `timer-display`, `timer-start`, `timer-stop`, `timer-reset`, `task-input`, `task-add-btn`, `task-error`, `task-list`, `link-label-input`, `link-url-input`, `link-add-btn`, `link-label-error`, `link-url-error`, `link-list`
    - Include a `<link>` tag pointing to `css/style.css` and a `<script defer>` tag pointing to `js/app.js`
    - Add `role="alert"` on the timer completion notification element and `aria-label` or associated `<label>` elements on all interactive controls
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1, 5.1, 6.1, 8.1, 10.1, 10.4, 12.1, 12.2, 12.3, 12.4_

  - [x] 1.2 Create `css/style.css` with CSS custom properties and full visual layout
    - Define all design tokens as CSS custom properties on `:root`: `--color-bg`, `--color-surface`, `--color-accent`, `--color-highlight`, `--color-text`, `--color-muted`, `--color-error`, `--font-body`, `--font-mono`, `--radius`, `--spacing-section`, `--font-size-body`, `--font-size-label`
    - Implement the two-column grid layout for Focus Timer and Task Manager inside `<main>`, with Quick Links spanning full width below
    - Style the Greeting Widget in `<header>` with clock, date, and greeting laid out horizontally
    - Ensure all interactive controls have visible focus rings and minimum 44×44 px touch targets
    - Set body text to minimum 14px and label/helper text to minimum 12px
    - Set a minimum of 16px vertical spacing between each section
    - Style completed tasks with `text-decoration: line-through`
    - _Requirements: 13.1, 13.3, 13.4, 7.2, 7.3_

- [x] 2. Implement `Config` and `Storage` modules in `js/app.js`
  - [x] 2.1 Create the IIFE wrapper and `Config` namespace
    - Open the IIFE: `(function() { 'use strict'; ... })();`
    - Define `Config` as a plain object with constants: `TIMER_DURATION = 1500` (seconds), `LINK_MAX = 20`, `TASK_TITLE_MAX = 255`, `LABEL_MAX = 100`, `URL_MAX = 2048`, `STORAGE_KEY_TASKS = 'tdld_tasks'`, `STORAGE_KEY_LINKS = 'tdld_links'`
    - _Requirements: 3.1, 4.5, 5.1, 11.1, 11.2, 12.1_

  - [x] 2.2 Implement the `Storage` module
    - Implement `Storage.get(key)`: wraps `localStorage.getItem` + `JSON.parse` in `try/catch`; returns parsed value or `null` on any error
    - Implement `Storage.set(key, value)`: wraps `JSON.stringify` + `localStorage.setItem` in `try/catch`; returns `true` on success; on failure creates and throws a typed `StorageError` (a subclass or plain object with `name: 'StorageError'`)
    - Implement `Storage.remove(key)`: wraps `localStorage.removeItem` in `try/catch`; fails silently
    - _Requirements: 9.4, 9.5, 11.8, 11.9_

- [x] 3. Implement the `Greeting` module
  - [x] 3.1 Implement `Greeting` helper functions
    - Implement `formatTime(date)`: returns `"HH:MM:SS"` with zero-padding from a `Date` object; wraps in `try/catch` and returns `"--:--:--"` on any error
    - Implement `formatDate(date)`: returns `"Weekday, D Month YYYY"` (e.g., `"Monday, 26 November 2026"`); wraps in `try/catch` and returns `"---"` on any error
    - Implement `getGreeting(hour)`: returns `"Good Morning"` for hours 5–11, `"Good Afternoon"` for 12–16, `"Good Evening"` for 17–20, `"Good Night"` for all other values (21–23 and 0–4)
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Implement `Greeting.init()` with DOM bindings and interval
    - Implement `render(timeStr, dateStr, greetingStr)`: sets `textContent` on `#clock-time`, `#clock-date`, `#clock-greeting`
    - Implement `Greeting.init()`: calls `render` once immediately with current values, then starts a `setInterval` at 1000 ms that calls `new Date()` wrapped in `try/catch` and calls `render` with the result (or placeholder strings on error)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Implement the `Timer` module
  - [x] 4.1 Implement `Timer` state machine and drift-corrected countdown
    - Declare closure state: `let state = 'idle'`, `let remaining = Config.TIMER_DURATION`, `let intervalId = null`, `let lastTick = null`
    - Implement `tick()`: compute elapsed using `Date.now() - lastTick`; update `lastTick`; decrement `remaining` by elapsed seconds (clamped to 0); call `renderTimer()`; if `remaining <= 0` call `onComplete()`
    - Implement `onComplete()`: clears the interval; resets state to `'idle'`; resets `remaining` to `Config.TIMER_DURATION`; calls `renderTimer()`; triggers the completion notification (set `textContent` on the `role="alert"` element; clear it after 3 seconds via `setTimeout`)
    - _Requirements: 3.3, 3.4, 3.5, 4.4_

  - [x] 4.2 Implement `Timer` DOM bindings and `Timer.init()`
    - Implement `renderTimer()`: formats `remaining` as `MM:SS`; sets `#timer-display` `textContent`; sets `disabled` attribute on `#timer-start` when `state === 'active'` or `remaining === 0`; sets `disabled` attribute on `#timer-stop` when `state === 'idle'`
    - Implement `start()`: if `state === 'active'` or `remaining === 0`, return early; set `state = 'active'`; set `lastTick = Date.now()`; start `setInterval(tick, 1000)` stored in `intervalId`; call `renderTimer()`
    - Implement `stop()`: if `state === 'idle'`, return early; clear interval; set `state = 'idle'`; call `renderTimer()`
    - Implement `reset()`: clear interval; set `state = 'idle'`; set `remaining = Config.TIMER_DURATION`; call `renderTimer()`
    - Implement `Timer.init()`: binds `click` listeners on `#timer-start`, `#timer-stop`, `#timer-reset` to `start`, `stop`, `reset`; calls `renderTimer()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 5. Checkpoint — verify HTML, CSS, Greeting, and Timer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the `Tasks` module
  - [x] 6.1 Implement `Tasks` data operations and storage helpers
    - Implement `createTask(title)`: returns `{ id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), title: title.trim(), completed: false }`
    - Implement `loadFromStorage()`: calls `Storage.get(Config.STORAGE_KEY_TASKS)`; returns parsed array or `[]` if result is not an array
    - Implement `saveToStorage()`: calls `Storage.set(Config.STORAGE_KEY_TASKS, tasks)`; on `StorageError` shows an error banner and does NOT revert in-memory state (task is retained in display per Req 5.6)
    - Implement `addTask(title)`: trims title; if empty or whitespace-only, show inline error on `#task-error` and return; otherwise push `createTask(title)`, call `saveToStorage()`, call `render()`, clear `#task-input`
    - Implement `editTask(id, newTitle)`: find task by id; validate new title (non-empty, ≤ 255 chars); on validation failure show inline error and return; on `StorageError` do NOT update title in memory and show error banner; on success update title, `saveToStorage()`, `render()`
    - Implement `toggleTask(id)`: flip `completed` flag; `saveToStorage()`; `render()`; on `StorageError` show error banner but preserve in-memory change
    - Implement `deleteTask(id)`: call `window.confirm()`; if confirmed, remove task from array, `saveToStorage()`, `render()`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 6.3, 6.4, 6.5, 6.6, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5, 9.2_

  - [x] 6.2 Implement `Tasks` DOM render engine and `Tasks.init()`
    - Implement `render()`: clear `#task-list`; for each task, create a `<li>` containing a checkbox toggle (`aria-checked`, checked state), a `<span>` with title (strikethrough class when completed), an edit button, and a delete button; append to `#task-list`; use data attributes (`data-action`, `data-id`) on buttons
    - Implement `Tasks.init()`: call `loadFromStorage()`; call `render()`; attach `keydown` listener on `#task-input` for Enter key; attach `click` listener on `#task-add-btn`; attach single delegated `click` listener on `#task-list` using `event.target.closest('[data-action]')` to dispatch `toggle`, `edit`, and `delete` actions; clear `#task-error` on `#task-input` `input` event
    - For inline edit: replace the task `<span>` with an `<input>` pre-filled with current title; confirm on Enter or blur; cancel on Escape; validate and call `editTask(id, newTitle)`
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 9.1, 9.3, 9.4, 9.5_

- [x] 7. Implement the `Links` module
  - [x] 7.1 Implement `Links` validation and data operations
    - Implement `validateLabel(label)`: returns `{ valid: true }` if label is 1–100 chars after trim; otherwise `{ valid: false, error: '<message>' }`; must never throw for any input
    - Implement `validateUrl(url)`: returns `{ valid: true }` if url starts with `http://` or `https://` and length ≤ 2048; otherwise `{ valid: false, error: '<message>' }`; must never throw for any input
    - Implement `createLink(label, url)`: returns `{ id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), label: label.trim(), url: url.trim() }`
    - Implement `loadFromStorage()`: calls `Storage.get(Config.STORAGE_KEY_LINKS)`; returns parsed array or `[]` if not an array
    - Implement `saveToStorage()`: snapshot current links before write; calls `Storage.set(Config.STORAGE_KEY_LINKS, links)`; on `StorageError` revert `links` to snapshot and show error banner
    - Implement `addLink(label, url)`: run both validators; if either fails show inline errors (`#link-label-error`, `#link-url-error`) and return; if `links.length >= Config.LINK_MAX` show cap error and return; push `createLink`, `saveToStorage()`, `render()`
    - Implement `deleteLink(id)`: remove from array; `saveToStorage()`; `render()`
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 7.2 Implement `Links` DOM render engine and `Links.init()`
    - Implement `render()`: clear `#link-list`; if `links` is empty, show empty-state message (e.g., "No links added yet"); for each link, create a `<button>` with `textContent` set to label truncated to 30 characters (full label if ≤ 30 chars), `data-action="open"`, `data-id`, and `data-url`; append a delete `<button>` with `data-action="delete"` and `data-id`
    - Implement `Links.init()`: call `loadFromStorage()`; call `render()`; attach `click` listener on `#link-add-btn`; attach `input` event listeners on `#link-label-input` and `#link-url-input` to clear their respective error spans; attach single delegated `click` listener on `#link-list` using `event.target.closest('[data-action]')` to dispatch `open` (calls `window.open(url, '_blank')`) and `delete` actions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 8. Implement `App.init()` and wire all modules
  - [x] 8.1 Implement `App.init()` and register `DOMContentLoaded` listener
    - Define `App` namespace with a single `init()` function that calls `Greeting.init()`, `Timer.init()`, `Tasks.init()`, and `Links.init()` in that order
    - Register `document.addEventListener('DOMContentLoaded', App.init)` at the bottom of the IIFE
    - Verify that there is no shared mutable state outside module closures — all state is owned by its respective module
    - _Requirements: 1.3, 12.1, 12.5, 12.6, 13.1_

- [x] 9. Final checkpoint — end-to-end smoke test
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No test framework, no fast-check, no build step — this is a zero-dependency project
- All tasks target plain Vanilla JS (ES2017, no ES modules) to support `file://` URLs across all target browsers
- Event delegation is used for `#task-list` and `#link-list` to keep listener count low and survive re-renders
- Full container re-renders are used after every state change — no incremental patching
- The timer drift correction uses `Date.now()` deltas, not a simple decrement, so tab throttling does not cause visible drift

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1", "4.1"] },
    { "id": 4, "tasks": ["3.2", "4.2"] },
    { "id": 5, "tasks": ["6.1", "7.1"] },
    { "id": 6, "tasks": ["6.2", "7.2"] },
    { "id": 7, "tasks": ["8.1"] }
  ]
}
```

- [ ] 10. Implement Light / Dark Mode Toggle
  - [x] 10.1 Add `theme-toggle` button to HTML and light-mode CSS overrides
    - Add a `<button id="theme-toggle" aria-label="Toggle theme" aria-pressed="false">` element inside `<header>` in `index.html`, with a sun/moon icon (Unicode or inline SVG)
    - Add a `body.light-mode { ... }` block to `css/style.css` that overrides the colour custom properties: `--color-bg: #f5f5f5`, `--color-surface: #ffffff`, `--color-accent: #dce3f0`, `--color-highlight: #c0392b`, `--color-text: #1a1a2e`, `--color-muted: #555555`, `--color-error: #c0392b`
    - Ensure the toggle button has a minimum touch target of 44 × 44 px and a visible focus ring
    - _Requirements: 14.1, 14.7_

  - [-] 10.2 Implement `Theme` module in `js/app.js`
    - Add `STORAGE_KEY_THEME: 'tdld_theme'` to the `Config` object
    - Implement `applyTheme(theme)`: toggles `light-mode` class on `document.body`; sets `aria-pressed` on `#theme-toggle` to `'true'` when `theme === 'light'` and `'false'` otherwise; updates the button icon
    - Implement `saveTheme(theme)`: calls `Storage.set(Config.STORAGE_KEY_THEME, theme)`; on `StorageError` shows an error banner without reverting the in-memory theme
    - Implement `toggleTheme()`: reads the current theme from `document.body.classList`; calls `applyTheme` with the opposite value; calls `saveTheme`
    - Implement `Theme.init()`: calls `Storage.get(Config.STORAGE_KEY_THEME)`; if the result is `'light'` calls `applyTheme('light')`, otherwise calls `applyTheme('dark')`; attaches a `click` listener on `#theme-toggle` to call `toggleTheme`
    - Update `App.init()` to call `Theme.init()` as its first statement, before `Greeting.init()`
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [ ] 11. Implement Custom Name in Greeting
  - [x] 11.1 Add name display and edit button to HTML
    - Inside the greeting `<header>` section of `index.html`, add `<span id="user-name-display"></span>` adjacent to `#clock-greeting` and a `<button id="user-name-edit-btn" aria-label="Edit name">` with a pencil icon (Unicode ✏ or inline SVG)
    - _Requirements: 15.1, 15.2_

  - [ ] 11.2 Implement name persistence and greeting integration in the `Greeting` module
    - Add `STORAGE_KEY_USER_NAME: 'tdld_user_name'` to the `Config` object
    - Add closure variable `let userName = ''` to the `Greeting` module
    - Implement `loadName()`: calls `Storage.get(Config.STORAGE_KEY_USER_NAME)`; sets `userName` to the trimmed result (max 50 chars) or `''` on null/error
    - Implement `saveName(name)`: calls `Storage.set(Config.STORAGE_KEY_USER_NAME, name)`; on `StorageError` shows an error banner
    - Implement `buildGreetingString(greetingBase, name)`: returns `greetingBase + ', ' + name + '!'` if name is non-empty; otherwise returns `greetingBase`
    - Update the tick's `render` call to pass `buildGreetingString(getGreeting(hour), userName)` as the greeting string, so name is always reflected in the live clock
    - Implement `renderName()`: sets `textContent` on `#user-name-display` to `userName`
    - Implement `startNameEdit()`: hides `#user-name-display` and `#user-name-edit-btn`; inserts an `<input>` pre-filled with `userName` and a cancel `<button>`; registers Enter key → `confirmNameEdit`, Escape key → `cancelNameEdit`, blur → `confirmNameEdit`
    - Implement `confirmNameEdit(newName)`: trims input; if non-empty and ≤ 50 chars, sets `userName`, calls `saveName`, calls `renderName`; if empty, sets `userName = ''`, calls `saveName('')`, calls `renderName`; restores the display elements
    - Implement `cancelNameEdit()`: restores `#user-name-display` and `#user-name-edit-btn` without modifying `userName` or Storage
    - Update `Greeting.init()` to call `loadName()` before the first `render()` call; attach `click` listener on `#user-name-edit-btn` to call `startNameEdit`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

- [ ] 12. Implement Prevent Duplicate Tasks
  - [~] 12.1 Add `isDuplicate` helper and update `addTask` / `editTask` in the `Tasks` module
    - Implement `isDuplicate(title, excludeId)` inside the `Tasks` closure: trims and lowercases `title`; returns `true` if any task whose `id !== excludeId` has a trimmed-lowercased `title` equal to the normalised input; returns `false` otherwise; must never throw for any string input
    - Update `addTask(title)`: after the existing whitespace-only check, call `isDuplicate(title, null)`; if `true`, display `"A task with this title already exists."` on `#task-error` and return without creating the task
    - Update `editTask(id, newTitle)`: after the existing length/whitespace validation, call `isDuplicate(newTitle, id)`; if `true`, display `"A task with this title already exists."` on the inline edit error indicator and return without saving
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

## Task Dependency Graph (updated)

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1", "4.1"] },
    { "id": 4, "tasks": ["3.2", "4.2"] },
    { "id": 5, "tasks": ["6.1", "7.1"] },
    { "id": 6, "tasks": ["6.2", "7.2"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["10.1", "11.1", "12.1"] },
    { "id": 9, "tasks": ["10.2", "11.2"] }
  ]
}
```
