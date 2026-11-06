# Design Document — ToDo List Life Dashboard

## Overview

The ToDo List Life Dashboard is a self-contained, client-side Single-Page Application (SPA) built with plain HTML, CSS, and Vanilla JavaScript. It runs without any backend or build step: one `index.html`, one `css/style.css`, and one `js/app.js`.

The application bundles four functional widgets on a single page:

| Widget | Core responsibility |
|---|---|
| **Greeting Widget** | Live clock (HH:MM:SS), full date, time-of-day greeting |
| **Focus Timer** | 25-minute Pomodoro countdown with start / stop / reset |
| **Task Manager** | Add, edit, complete, and delete tasks; persisted to LocalStorage |
| **Quick Links** | Labelled shortcut buttons to external URLs; persisted to LocalStorage |

All persistent state lives in `window.localStorage`. There is no network activity, no authentication, and no server dependency. The app must open correctly via a `file://` URL and in the latest stable versions of Chrome, Firefox, Edge, and Safari.

---

## Architecture

### High-level structure

```
index.html          ← single HTML entry point; declares semantic layout
css/
  style.css         ← single stylesheet; custom properties for theming
js/
  app.js            ← single script; IIFE-wrapped module pattern
```

### Module organisation inside `app.js`

Because the project forbids external frameworks, the single file is structured as an **Immediately Invoked Function Expression (IIFE)** containing logically separated namespaces (plain objects acting as modules):

```
app.js
├── Config            — compile-time constants (durations, limits, keys)
├── Storage           — thin wrapper around localStorage (get / set / remove)
├── Greeting          — clock, date, greeting logic + DOM bindings
├── Timer             — Pomodoro state machine + DOM bindings
├── Tasks             — task CRUD + DOM render engine
├── Links             — quick-link CRUD + DOM render engine
└── App.init()        — wires all modules together on DOMContentLoaded
```

Each namespace exposes an `init()` function called once at startup and keeps its own internal state as closure variables. There is no shared mutable global state.

### Rendering model

All DOM mutations are **full re-renders of a list container** triggered after every state change. For small datasets (tasks ≤ unlimited, links ≤ 20) this is efficient enough and avoids diff-patching complexity.

### Event delegation

Rather than attaching listeners to every individual button, the Tasks and Links modules attach a single `click` listener to their respective container and use `event.target.closest('[data-action]')` to dispatch actions. This keeps listener count low and works correctly after re-renders.

### Timer implementation

The Focus Timer uses `setInterval` (1000 ms tick) and a correction mechanism: the actual elapsed time is computed from `Date.now()` deltas so that browser tab throttling does not cause noticeable drift over a 25-minute session.

### Cross-browser compatibility

- No ES modules (`<script type="module">`) are used because `file://` origins block CORS for module imports in some browsers.
- The codebase targets ES2017 (`async/await` is not required; all operations are synchronous).
- `localStorage` is wrapped so any `SecurityError` (thrown by some browsers in `file://` private-browsing mode) is caught gracefully.

---

## Components and Interfaces

### 1 — Greeting Module (`Greeting`)

**Responsibilities**
- Maintain a `setInterval` at 1000 ms to update the displayed clock.
- Compute and render the date string on each tick.
- Compute and render the time-based greeting on each tick (boundary check inside the tick).

**Public interface**

```js
Greeting.init()   // Starts the interval; renders immediately on first call.
```

**Internal helpers**

| Function | Description |
|---|---|
| `formatTime(date)` | Returns `"HH:MM:SS"` string from a `Date` object, or `"--:--:--"` on error |
| `formatDate(date)` | Returns `"Weekday, D Month YYYY"` string |
| `getGreeting(hour)` | Returns greeting string based on the hour (0–23) |
| `render(timeStr, dateStr, greetingStr)` | Updates the three DOM nodes |

**DOM targets** (`id` attributes)

| ID | Content |
|---|---|
| `clock-time` | HH:MM:SS |
| `clock-date` | Full date string |
| `clock-greeting` | Greeting string |

---

### 2 — Timer Module (`Timer`)

**Responsibilities**
- Manage the `Idle ↔ Active` session state machine.
- Drive a corrected 1000 ms `setInterval` countdown.
- Notify the user when the countdown reaches zero.
- Enable / disable controls to match current state.

**State machine**

```
          start (remaining > 0)
  Idle ──────────────────────────► Active
  ◄──────────────────────────────
          stop / reaches 00:00

  Any state ──── reset ────► Idle (remaining = 25:00)
```

**Public interface**

```js
Timer.init()   // Binds DOM controls; renders initial state.
```

**Internal state (closure)**

```js
let state = 'idle';          // 'idle' | 'active'
let remaining = 1500;        // seconds
let intervalId = null;       // setInterval handle
let lastTick = null;         // Date.now() at last tick (for drift correction)
```

**DOM targets**

| ID | Element |
|---|---|
| `timer-display` | MM:SS readout |
| `timer-start` | Start button |
| `timer-stop` | Stop button |
| `timer-reset` | Reset button |

---

### 3 — Tasks Module (`Tasks`)

**Responsibilities**
- Load tasks from `localStorage` on init.
- Support add, inline-edit, toggle-complete, and delete operations.
- Write the full task array to `localStorage` after every mutation.
- Render the task list via a full container re-render.

**Public interface**

```js
Tasks.init()   // Loads from storage; renders list.
```

**Internal state**

```js
let tasks = [];   // Array of Task objects (see Data Models)
```

**Operations**

| Function | Description |
|---|---|
| `addTask(title)` | Validates title; pushes new Task; saves; re-renders |
| `editTask(id, newTitle)` | Validates title; updates in-place; saves; re-renders |
| `toggleTask(id)` | Flips `completed` flag; saves; re-renders |
| `deleteTask(id)` | Shows confirmation; on confirm removes; saves; re-renders |
| `saveToStorage()` | Serialises `tasks` array to JSON; catches `SecurityError` |
| `loadFromStorage()` | Parses JSON; falls back to `[]` on any error |
| `render()` | Clears container; appends one `<li>` per task |

**DOM targets**

| ID / selector | Element |
|---|---|
| `task-input` | New task text input |
| `task-add-btn` | Add button |
| `task-error` | Inline error message span |
| `task-list` | `<ul>` container (event-delegated) |

---

### 4 — Links Module (`Links`)

**Responsibilities**
- Load links from `localStorage` on init.
- Support add and delete operations (no edit).
- Validate label (1–100 chars) and URL (`http://` or `https://`, ≤ 2048 chars).
- Enforce a maximum of 20 links.
- Persist changes to `localStorage`; revert in-memory state on write failure.
- Open links in a new tab on click.

**Public interface**

```js
Links.init()   // Loads from storage; renders buttons.
```

**Internal state**

```js
let links = [];   // Array of Link objects (see Data Models)
```

**Operations**

| Function | Description |
|---|---|
| `addLink(label, url)` | Validates; checks cap; pushes new Link; saves; re-renders |
| `deleteLink(id)` | Removes by id; saves; re-renders |
| `saveToStorage()` | Serialises `links` array to JSON; catches `SecurityError`; reverts on failure |
| `loadFromStorage()` | Parses JSON; falls back to `[]` on any error |
| `render()` | Clears container; appends one button per link; shows empty-state if none |
| `validateLabel(label)` | Returns `{ valid, error }` |
| `validateUrl(url)` | Returns `{ valid, error }` |

**DOM targets**

| ID / selector | Element |
|---|---|
| `link-label-input` | Label text input |
| `link-url-input` | URL text input |
| `link-add-btn` | Add button |
| `link-label-error` | Inline error span for label |
| `link-url-error` | Inline error span for URL |
| `link-list` | Container `<div>` for link buttons (event-delegated) |

---

### 5 — Storage Module (`Storage`)

A thin defensive wrapper that catches all `localStorage` exceptions and returns safe fallback values.

```js
Storage.get(key)              // Returns parsed JSON value, or null
Storage.set(key, value)       // Serialises and writes; returns true | throws StorageError
Storage.remove(key)           // Removes the key silently
```

---

## Data Models

### Task object

Stored in `localStorage` under the key `"tdld_tasks"` as a JSON array.

```json
{
  "id": "t_1700000000000_abc12",
  "title": "Buy groceries",
  "completed": false
}
```

| Field | Type | Constraints |
|---|---|---|
| `id` | `string` | Unique; generated as `"t_" + Date.now() + "_" + Math.random().toString(36).slice(2,7)` |
| `title` | `string` | 1–255 non-whitespace-only characters |
| `completed` | `boolean` | `false` on creation |

**Factory function**

```js
function createTask(title) {
  return {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: title.trim(),
    completed: false
  };
}
```

---

### Link object

Stored in `localStorage` under the key `"tdld_links"` as a JSON array.

```json
{
  "id": "l_1700000000001_xyz99",
  "label": "GitHub",
  "url": "https://github.com"
}
```

| Field | Type | Constraints |
|---|---|---|
| `id` | `string` | Unique; same generation pattern as Task `id` |
| `label` | `string` | 1–100 characters |
| `url` | `string` | Starts with `http://` or `https://`; ≤ 2048 characters |

**Factory function**

```js
function createLink(label, url) {
  return {
    id: 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: label.trim(),
    url: url.trim()
  };
}
```

---

### LocalStorage key registry

| Key | Module | Description |
|---|---|---|
| `tdld_tasks` | Tasks | JSON array of Task objects |
| `tdld_links` | Links | JSON array of Link objects |

---

## UI Layout and Visual Hierarchy

### Page layout

```
┌─────────────────────────────────────────────────────────┐
│                      <header>                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Greeting Widget                                 │   │
│  │  [clock-greeting]  [clock-time]  [clock-date]    │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                      <main>                             │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  Focus Timer        │  │  Task Manager            │  │
│  │  [MM:SS display]    │  │  [input + add btn]       │  │
│  │  [Start][Stop][Rst] │  │  [task list]             │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Quick Links                                     │   │
│  │  [label input] [url input] [add btn]             │   │
│  │  [link buttons…]                                 │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Visual design tokens (CSS custom properties)

```css
:root {
  --color-bg:         #1a1a2e;
  --color-surface:    #16213e;
  --color-accent:     #0f3460;
  --color-highlight:  #e94560;
  --color-text:       #eaeaea;
  --color-muted:      #888;
  --color-error:      #ff6b6b;
  --font-body:        'Segoe UI', system-ui, sans-serif;
  --font-mono:        'Courier New', monospace;
  --radius:           8px;
  --spacing-section:  24px;   /* minimum 16px required; 24px chosen */
  --font-size-body:   16px;   /* minimum 14px required */
  --font-size-label:  13px;   /* minimum 12px required */
}
```

### Accessibility

- All interactive controls have visible focus rings and `aria-label` or associated `<label>` elements.
- Disabled buttons carry the `disabled` attribute (not just a CSS class) so they are unreachable via keyboard.
- The timer completion notification uses `role="alert"` so screen readers announce it.
- Strikethrough on completed tasks is paired with `aria-checked` on the toggle control.
- Minimum touch/click target size: 44 × 44 px for all controls.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time-based greeting is total and non-overlapping

*For any* local hour value (0–23), `getGreeting(hour)` SHALL return exactly one of {"Good Morning", "Good Afternoon", "Good Evening", "Good Night"}, the returned string SHALL match the boundary for that hour, and the function SHALL never return any other string or throw.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 2: Whitespace-only task titles are rejected

*For any* string composed entirely of whitespace characters (space, tab, newline, carriage-return, etc.), calling `addTask` with that string SHALL leave the task list length unchanged.

**Validates: Requirements 5.5**

---

### Property 3: Valid task addition grows the list by exactly one

*For any* task list and any non-whitespace-only string of 1–255 characters, calling `addTask` SHALL increase the length of the task list by exactly one and the new task's title SHALL equal the trimmed input string.

**Validates: Requirements 5.2, 5.3**

---

### Property 4: Task toggle is an involution

*For any* task, toggling its completion status twice SHALL restore the task to its original `completed` value (toggle is its own inverse).

**Validates: Requirements 7.2, 7.3**

---

### Property 5: Task serialisation round-trip

*For any* valid array of Task objects, serialising the array to JSON and then deserialising it SHALL produce an array with the same length and, at each index, an object with identical `id`, `title`, and `completed` values.

**Validates: Requirements 9.2, 9.3**

---

### Property 6: Link serialisation round-trip

*For any* valid array of Link objects, serialising the array to JSON and then deserialising it SHALL produce an array with the same length and, at each index, an object with identical `id`, `label`, and `url` values.

**Validates: Requirements 11.7**

---

### Property 7: Link label validation is total

*For any* string, `validateLabel` SHALL return either `{ valid: true }` or `{ valid: false, error: <non-empty string> }` and SHALL never throw.

**Validates: Requirements 11.1, 11.3**

---

### Property 8: Link URL validation is total

*For any* string, `validateUrl` SHALL return either `{ valid: true }` or `{ valid: false, error: <non-empty string> }` and SHALL never throw.

**Validates: Requirements 11.1, 11.3**

---

### Property 9: Link cap is enforced

*For any* link list of exactly 20 entries, calling `addLink` with a valid label and URL SHALL leave the list length unchanged at 20.

**Validates: Requirements 11.2, 11.10**

---

### Property 10: Valid link addition grows the list by exactly one

*For any* link list with fewer than 20 entries, calling `addLink` with a valid label (1–100 chars) and valid URL (`http://` or `https://`, ≤ 2048 chars) SHALL increase the list length by exactly one and the new link's label and URL SHALL equal the trimmed input values.

**Validates: Requirements 11.2**

---

### Property 11: Task edit preserves all other tasks

*For any* task list of at least one task and any valid new title for a task at index *i*, calling `editTask` SHALL leave the length of the list and the `id`, `title`, and `completed` values of every task at index ≠ *i* unchanged.

**Validates: Requirements 6.3**

---

### Property 12: Task delete preserves all other tasks

*For any* task list of at least one task, confirming `deleteTask` for the task at index *i* SHALL reduce the list length by exactly one and leave every other task's `id`, `title`, and `completed` values unchanged.

**Validates: Requirements 8.3**

---

### Property 13: Link button label is truncated to 30 characters

*For any* Link whose `label` has length greater than 30, the rendered button's visible text SHALL be exactly the first 30 characters of the label. *For any* Link whose `label` has length ≤ 30, the rendered button's visible text SHALL equal the full label.

**Validates: Requirements 10.1**

---

## Error Handling

### Storage unavailability

`localStorage` throws a `DOMException` (`SecurityError` or `QuotaExceededError`) when it is unavailable (private browsing in some browsers, storage quota exceeded, or `file://` + certain Firefox configurations).

**Strategy**: the `Storage` module wraps every `localStorage` call in a `try/catch`. On read failure it returns `null` (callers fall back to `[]`). On write failure it re-throws a typed `StorageError` which the calling module catches to:
1. Revert any in-memory state change (for Links, as required by Req 11.9).
2. Display a visible, dismissible error banner to the user.

### Input validation errors

Validation errors are surfaced **inline**, adjacent to the offending field, as `<span role="alert">` elements. They are cleared as soon as the user modifies the relevant input (via an `input` event listener). No modal dialogs are used for validation feedback.

### Timer edge cases

- If `setInterval` fires late (tab in background), the Timer uses `Date.now()` delta to compute the correct remaining time and does not drift past 00:00 without triggering the completion handler.
- If the page is closed mid-session, the remaining time is **not** persisted (by design — no requirement mandates this).

### Clock / Date error

If `new Date()` throws (e.g. in an exotic environment), the Greeting module catches the error and renders `"--:--:--"` and `"---"` placeholders without re-throwing (Req 1.4).

### Confirmation prompts

Task deletion uses `window.confirm()` for the confirmation prompt (Req 8.2). This is a built-in browser modal that does not require any JS modal library.

---

## Testing Strategy

### Unit testing

Tested with a lightweight test harness (no frameworks, consistent with Req 12.1):

- `getGreeting(hour)` — each of the 24 valid hours, plus boundary hours (5, 12, 17, 21, 0).
- `formatTime(date)` — correct zero-padding, midnight (00:00:00), end-of-day (23:59:59).
- `formatDate(date)` — correct weekday, day, month, year formatting.
- `addTask` / `editTask` — boundary lengths (1 char, 255 chars, 256 chars), whitespace-only strings.
- `validateLabel` / `validateUrl` — empty string, boundary lengths, invalid schemes, valid URLs.
- `createTask` / `createLink` — unique ID generation across rapid successive calls.
- `Storage.get` / `Storage.set` — mocked `localStorage` that throws on demand.
- Timer state machine — start → active, stop → idle, reset from active, start at 0 seconds remaining.

### Property-based testing

The project uses [**fast-check**](https://github.com/dubzzz/fast-check) as the property-based testing library (loaded via CDN in a separate test HTML page or via `npm` in a test-only dev environment — production code itself has no dependencies).

Each property test runs a **minimum of 100 iterations**.

Each property test is tagged with a comment in the format:
`// Feature: todo-list-life-dashboard, Property N: <property_text>`

| Property | fast-check arbitraries |
|---|---|
| P1 — Greeting is total and non-overlapping | `fc.integer({ min: 0, max: 23 })` |
| P2 — Whitespace task titles rejected | `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` |
| P3 — Valid task addition grows list by one | `fc.array(taskArb) × fc.string({ minLength: 1, maxLength: 255 })` |
| P4 — Task toggle is involution | `taskArb` |
| P5 — Task serialisation round-trip | `fc.array(taskArb)` |
| P6 — Link serialisation round-trip | `fc.array(linkArb)` |
| P7 — Label validation is total | `fc.string()` |
| P8 — URL validation is total | `fc.string()` |
| P9 — Link cap enforced | `fc.array(linkArb, { minLength: 20, maxLength: 20 }) × validLinkArb` |
| P10 — Valid link addition grows list by one | `fc.array(linkArb, { maxLength: 19 }) × validLabelArb × validUrlArb` |
| P11 — Edit preserves other tasks | `fc.array(taskArb, { minLength: 1 }) × fc.nat() × fc.string({ minLength: 1, maxLength: 255 })` |
| P12 — Delete preserves other tasks | `fc.array(taskArb, { minLength: 1 }) × fc.nat()` |
| P13 — Link button label truncated to 30 chars | `linkArb` |

### Integration / smoke testing

Manual checklist run in each target browser (Chrome, Firefox, Edge, Safari):

1. Page opens via `file://` and all four sections are visible within 2 seconds.
2. Clock updates every second; greeting changes at the correct boundary.
3. Timer counts down from 25:00; stop pauses; reset returns to 25:00; alert fires at 00:00.
4. Tasks survive a page reload with correct title and completion state.
5. Links survive a page reload and open in a new tab.
6. Attempting to add a 21st link shows the cap error message.
7. `localStorage` quota simulation (fill storage to capacity) shows the storage error banner.

---

## New Features

### Feature A — Light / Dark Mode Toggle

#### Theme module design

A new `Theme` module is added inside the IIFE, alongside the existing modules. It owns all logic for reading, applying, and persisting the theme preference.

**New `Config` constants**

```js
STORAGE_KEY_THEME: 'tdld_theme'   // added to Config
```

**CSS custom property override approach**

The dark theme is the default. All colour values are declared on `:root`. The light theme is expressed as a second block of declarations that overrides only the colour custom properties when the `body.light-mode` class is present:

```css
/* Default (dark) — already declared on :root */

body.light-mode {
  --color-bg:        #f5f5f5;
  --color-surface:   #ffffff;
  --color-accent:    #dce3f0;
  --color-highlight: #c0392b;
  --color-text:      #1a1a2e;
  --color-muted:     #555555;
  --color-error:     #c0392b;
}
```

Because every component consumes only custom properties, toggling `body.light-mode` is the single change needed to re-skin the entire UI.

**Public interface**

```js
Theme.init()   // Reads storage, applies class, renders toggle button state.
```

**Internal helpers**

| Function | Description |
|---|---|
| `applyTheme(theme)` | Adds or removes `light-mode` class on `document.body`; updates `aria-pressed` on `#theme-toggle` |
| `saveTheme(theme)` | Calls `Storage.set(Config.STORAGE_KEY_THEME, theme)`; on `StorageError` shows error banner |
| `toggleTheme()` | Reads current state; calls `applyTheme` with the opposite value; calls `saveTheme` |

**DOM targets**

| ID | Element |
|---|---|
| `theme-toggle` | `<button>` in `<header>`; carries `aria-label="Toggle theme"` and `aria-pressed` |

**Accessibility**

- `aria-pressed="false"` when dark theme is active; `aria-pressed="true"` when light theme is active.
- The button icon changes (moon ↔ sun) to reflect the active theme.

---

### Feature B — Custom Name in Greeting

#### Greeting module changes

A new closure variable `userName` is added to the `Greeting` module. The existing `render()` function is updated to incorporate the name into the greeting string. Two new functions handle loading and saving the name.

**New `Config` constant**

```js
STORAGE_KEY_USER_NAME: 'tdld_user_name'   // added to Config
```

**New closure variable**

```js
let userName = '';   // Empty string means no name set.
```

**New/updated internal helpers**

| Function | Description |
|---|---|
| `loadName()` | Calls `Storage.get(Config.STORAGE_KEY_USER_NAME)`; sets `userName` to the result trimmed to ≤ 50 chars, or `''` on null/error |
| `saveName(name)` | Calls `Storage.set(Config.STORAGE_KEY_USER_NAME, name)`; on `StorageError` shows error banner |
| `buildGreetingString(greetingBase, name)` | Returns `"${greetingBase}, ${name}!"` if name is non-empty; otherwise returns `greetingBase` |
| `renderName()` | Sets `textContent` on `#user-name-display`; updates `#clock-greeting` via `buildGreetingString` |
| `startNameEdit()` | Replaces `#user-name-display` content with an `<input>` pre-filled with `userName`; registers Enter/Escape/blur handlers |
| `confirmNameEdit(newName)` | Validates; updates `userName`; calls `saveName`; calls `renderName`; restores display element |
| `cancelNameEdit()` | Restores display element without modifying `userName` or Storage |

**Updated `render()` signature** — the greeting string passed to `render()` is now generated via `buildGreetingString(getGreeting(hour), userName)`, so the name is always reflected in the live clock tick without additional listeners.

**New DOM elements**

| ID | Element | Notes |
|---|---|---|
| `user-name-display` | `<span>` inside the greeting area | Shows current name (empty if none set) |
| `user-name-edit-btn` | `<button>` (pencil icon) adjacent to `#user-name-display` | Triggers inline edit mode; `aria-label="Edit name"` |

**`Greeting.init()` changes**: calls `loadName()` before the first `render()` call.

---

### Feature C — Prevent Duplicate Tasks

#### Tasks module changes

A new private helper `isDuplicate` is added to the `Tasks` module closure. The existing `addTask` and `editTask` functions are updated to call this helper before proceeding.

**New internal helper**

```js
function isDuplicate(title, excludeId) {
  var normalised = title.trim().toLowerCase();
  return tasks.some(function(t) {
    return t.id !== excludeId && t.title.trim().toLowerCase() === normalised;
  });
}
```

- `excludeId` is `null` when checking during `addTask` (no task to exclude).
- `excludeId` is the task's own `id` when checking during `editTask` (exclude the task being edited from the comparison so it can keep its own title).

**`addTask` update**: after the existing whitespace check, call `isDuplicate(title, null)`; if `true`, show `"A task with this title already exists."` on `#task-error` and return without creating the task.

**`editTask` update**: after the existing length/whitespace validation, call `isDuplicate(newTitle, id)`; if `true`, show `"A task with this title already exists."` on the inline edit error indicator and return without saving.

No new DOM elements are required; the existing `#task-error` span and inline edit error indicator are reused.

---

### New LocalStorage key registry entries

| Key | Module | Description |
|---|---|---|
| `tdld_theme` | Theme | `'dark'` or `'light'`; user's theme preference |
| `tdld_user_name` | Greeting | User's display name (trimmed string, 0–50 chars) |

---

### Updated `App.init()` call order

`App.init()` is updated to call `Theme.init()` first (before `Greeting.init()`), so the theme class is applied to `<body>` before any widget renders, preventing a flash of the wrong theme:

```js
App.init = function() {
  Theme.init();      // new — apply theme before first paint
  Greeting.init();
  Timer.init();
  Tasks.init();
  Links.init();
};
```

---

### New correctness properties

#### Property 14: Theme toggle is an involution

*For any* starting theme value (`'dark'` or `'light'`), calling `toggleTheme` twice SHALL restore `document.body.classList` and `aria-pressed` to their original values.

**Validates: Requirements 14.3, 14.4**

---

#### Property 15: Greeting string with name is well-formed

*For any* non-empty trimmed name string of 1–50 characters and any greeting base string, `buildGreetingString(greetingBase, name)` SHALL return a string of the form `"${greetingBase}, ${name}!"` and SHALL never throw.

**Validates: Requirements 15.3**

---

#### Property 16: `isDuplicate` correctly identifies case-insensitive matches

*For any* task list and any two strings `a` and `b` where `a.trim().toLowerCase() === b.trim().toLowerCase()`, calling `isDuplicate(b, null)` on a list that contains a task with title `a` SHALL return `true`. *For any* string `c` where `c.trim().toLowerCase()` does not equal the trimmed-lowercased title of any task in the list, `isDuplicate(c, null)` SHALL return `false`. The function SHALL never throw for any string input.

**Validates: Requirements 16.1, 16.2, 16.5**
