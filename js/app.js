(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  // Compile-time constants shared across all modules.
  var Config = {
    TIMER_DURATION:    1500,          // seconds (25 minutes)
    LINK_MAX:          20,
    TASK_TITLE_MAX:    255,
    LABEL_MAX:         100,
    URL_MAX:           2048,
    STORAGE_KEY_TASKS: 'tdld_tasks',
    STORAGE_KEY_LINKS: 'tdld_links'
  };

  // ─── Storage ──────────────────────────────────────────────────────────────
  // Thin defensive wrapper around localStorage.
  var Storage = {
    /**
     * Retrieve and JSON-parse a value from localStorage.
     * Returns the parsed value, or null on any error (missing key, parse
     * failure, SecurityError, etc.).
     *
     * @param  {string} key
     * @returns {*|null}
     */
    get: function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) { return null; }
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    /**
     * JSON-serialise `value` and write it to localStorage under `key`.
     * Returns true on success.
     * On any failure (QuotaExceededError, SecurityError, serialisation
     * error) throws a plain object with name: 'StorageError'.
     *
     * @param  {string} key
     * @param  {*}      value
     * @returns {true}
     * @throws {{ name: 'StorageError', message: string }}
     */
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        throw {
          name: 'StorageError',
          message: 'Could not write to localStorage for key "' + key + '": ' +
                   (e && e.message ? e.message : String(e))
        };
      }
    },

    /**
     * Remove a key from localStorage, failing silently on any error.
     *
     * @param  {string} key
     */
    remove: function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Fail silently — callers do not need to handle removal failures.
      }
    }
  };

  // ─── Greeting ─────────────────────────────────────────────────────────────
  // Live clock, full date, and time-of-day greeting.
  var Greeting = (function () {
    var DAY_NAMES = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'
    ];

    var MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    /**
     * Format a Date object as "HH:MM:SS" (24-hour, zero-padded).
     * Returns "--:--:--" on any error.
     *
     * @param  {Date} date
     * @returns {string}
     */
    function formatTime(date) {
      try {
        var h  = String(date.getHours()).padStart(2, '0');
        var m  = String(date.getMinutes()).padStart(2, '0');
        var s  = String(date.getSeconds()).padStart(2, '0');
        return h + ':' + m + ':' + s;
      } catch (e) {
        return '--:--:--';
      }
    }

    /**
     * Format a Date object as "Weekday, D Month YYYY"
     * (e.g. "Monday, 26 November 2026").
     * Returns "---" on any error.
     *
     * @param  {Date} date
     * @returns {string}
     */
    function formatDate(date) {
      try {
        var weekday = DAY_NAMES[date.getDay()];
        var day     = date.getDate();           // no leading zero
        var month   = MONTH_NAMES[date.getMonth()];
        var year    = date.getFullYear();
        return weekday + ', ' + day + ' ' + month + ' ' + year;
      } catch (e) {
        return '---';
      }
    }

    /**
     * Return a time-of-day greeting string for the given hour (0–23).
     *   05–11 → "Good Morning"
     *   12–16 → "Good Afternoon"
     *   17–20 → "Good Evening"
     *   all other values (21–23, 0–4) → "Good Night"
     *
     * @param  {number} hour  Integer 0–23
     * @returns {string}
     */
    function getGreeting(hour) {
      if (hour >= 5 && hour <= 11) { return 'Good Morning';   }
      if (hour >= 12 && hour <= 16) { return 'Good Afternoon'; }
      if (hour >= 17 && hour <= 20) { return 'Good Evening';   }
      return 'Good Night';
    }

    /**
     * Update the three Greeting_Widget DOM elements with the provided strings.
     * Silently skips any element that is not found in the DOM.
     *
     * @param {string} timeStr     Formatted time string, e.g. "14:05:30"
     * @param {string} dateStr     Formatted date string, e.g. "Monday, 26 November 2026"
     * @param {string} greetingStr Time-of-day greeting, e.g. "Good Afternoon"
     */
    function render(timeStr, dateStr, greetingStr) {
      var timeEl     = document.getElementById('clock-time');
      var dateEl     = document.getElementById('clock-date');
      var greetingEl = document.getElementById('clock-greeting');

      if (timeEl)     { timeEl.textContent     = timeStr;     }
      if (dateEl)     { dateEl.textContent      = dateStr;     }
      if (greetingEl) { greetingEl.textContent  = greetingStr; }
    }

    /**
     * Bootstrap the live clock: render once immediately, then schedule a
     * 1 000 ms interval that re-renders on every tick.
     * All Date construction is wrapped in try/catch so a missing or broken
     * system clock never causes an unhandled error (Req 1.4).
     */
    function init() {
      function update() {
        try {
          var d = new Date();
          render(formatTime(d), formatDate(d), getGreeting(d.getHours()));
        } catch (e) {
          render('--:--:--', '---', '');
        }
      }

      update();                        // render immediately on init (Req 1.3)
      setInterval(update, 1000);       // live 1-second updates (Req 1.1, 2.5)
    }

    return {
      formatTime:  formatTime,
      formatDate:  formatDate,
      getGreeting: getGreeting,
      init:        init
    };
  }());

  // ─── Timer ────────────────────────────────────────────────────────────────
  // 25-minute Pomodoro countdown with drift correction.
  var Timer = (function () {

    // ── Closure state ────────────────────────────────────────────────────
    var state      = 'idle';                  // 'idle' | 'active'
    var remaining  = Config.TIMER_DURATION;   // seconds remaining
    var intervalId = null;                    // setInterval handle
    var lastTick   = null;                    // Date.now() at last tick

    // ── renderTimer ──────────────────────────────────────────────────────
    // Updates the timer display and button disabled states to reflect
    // the current `state` and `remaining` values.
    function renderTimer() {
      var minutes = Math.floor(remaining / 60);
      var secs    = remaining % 60;
      var display = String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

      var displayEl = document.getElementById('timer-display');
      if (displayEl) { displayEl.textContent = display; }

      var startEl = document.getElementById('timer-start');
      if (startEl) { startEl.disabled = (state === 'active' || remaining === 0); }

      var stopEl = document.getElementById('timer-stop');
      if (stopEl) { stopEl.disabled = (state === 'idle'); }
    }

    // ── onComplete ───────────────────────────────────────────────────────
    // Called when the countdown reaches 00:00.
    function onComplete() {
      clearInterval(intervalId);
      intervalId = null;
      state      = 'idle';
      remaining  = Config.TIMER_DURATION;
      renderTimer();

      // Notify user via the #timer-alert element (role="alert" for a11y).
      var alertEl = document.getElementById('timer-alert');
      if (alertEl) {
        alertEl.textContent = "\u23F0 Time\u2019s up! Great work!";
        setTimeout(function () {
          alertEl.textContent = '';
        }, 3000);
      }
    }

    // ── tick ─────────────────────────────────────────────────────────────
    // Invoked by setInterval every ~1000 ms.
    // Uses Date.now() deltas to correct for browser tab throttling drift.
    function tick() {
      var now     = Date.now();
      var elapsed = Math.round((now - lastTick) / 1000);
      lastTick    = now;

      remaining = Math.max(0, remaining - elapsed);
      renderTimer();

      if (remaining <= 0) {
        onComplete();
      }
    }

    // ── Public interface ─────────────────────────────────────────────────
    return {
      /**
       * Start the countdown.
       * No-op if already active or if no time remains.
       */
      start: function () {
        if (state === 'active' || remaining === 0) { return; }
        state      = 'active';
        lastTick   = Date.now();
        intervalId = setInterval(tick, 1000);
        renderTimer();
      },

      /**
       * Pause the countdown, preserving remaining time.
       * No-op if already idle.
       */
      stop: function () {
        if (state === 'idle') { return; }
        clearInterval(intervalId);
        intervalId = null;
        state      = 'idle';
        renderTimer();
      },

      /**
       * Stop any active session and reset to the full configured duration.
       */
      reset: function () {
        clearInterval(intervalId);
        intervalId = null;
        state      = 'idle';
        remaining  = Config.TIMER_DURATION;
        renderTimer();
      },

      /**
       * Bind DOM controls and render the initial timer state.
       */
      init: function () {
        var self = this;

        var startEl = document.getElementById('timer-start');
        var stopEl  = document.getElementById('timer-stop');
        var resetEl = document.getElementById('timer-reset');

        if (startEl) { startEl.addEventListener('click', function () { self.start(); }); }
        if (stopEl)  { stopEl.addEventListener('click',  function () { self.stop();  }); }
        if (resetEl) { resetEl.addEventListener('click', function () { self.reset(); }); }

        renderTimer();
      }
    };

  })();

  // ─── Tasks ────────────────────────────────────────────────────────────────
  // Add, edit, complete, and delete tasks; persisted to localStorage.
  var Tasks = (function () {

    // ── Closure state ────────────────────────────────────────────────────
    var tasks = [];

    // ── createTask ───────────────────────────────────────────────────────
    /**
     * Factory that builds a new Task object with a unique id.
     *
     * @param  {string} title  Already-trimmed task title.
     * @returns {{ id: string, title: string, completed: boolean }}
     */
    function createTask(title) {
      return {
        id:        't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title:     title.trim(),
        completed: false
      };
    }

    // ── showError ────────────────────────────────────────────────────────
    /**
     * Show a message in the #error-banner element, then auto-hide after 5 s.
     * Silently does nothing if the element does not exist.
     *
     * @param {string} msg
     */
    function showError(msg) {
      var bannerEl = document.getElementById('error-banner');
      if (!bannerEl) { return; }
      bannerEl.textContent = msg;
      bannerEl.classList.add('visible');
      setTimeout(function () {
        bannerEl.textContent = '';
        bannerEl.classList.remove('visible');
      }, 5000);
    }

    // ── clearTaskError ───────────────────────────────────────────────────
    /**
     * Clear any inline validation message shown in #task-error.
     */
    function clearTaskError() {
      var errorEl = document.getElementById('task-error');
      if (errorEl) { errorEl.textContent = ''; }
    }

    // ── loadFromStorage ──────────────────────────────────────────────────
    /**
     * Read the task list from Storage.
     * Assigns a parsed array to `tasks`, or an empty array on any error.
     * Never throws.
     */
    function loadFromStorage() {
      var result = Storage.get(Config.STORAGE_KEY_TASKS);
      tasks = Array.isArray(result) ? result : [];
    }

    // ── saveToStorage ────────────────────────────────────────────────────
    /**
     * Persist the current `tasks` array to Storage.
     * On StorageError: shows the error banner but does NOT revert `tasks`
     * (task is retained in the displayed list per Req 5.6, 7.5).
     */
    function saveToStorage() {
      try {
        Storage.set(Config.STORAGE_KEY_TASKS, tasks);
      } catch (e) {
        if (e && e.name === 'StorageError') {
          showError('Could not save tasks: ' + e.message);
        } else {
          showError('Could not save tasks: an unexpected error occurred.');
        }
      }
    }

    // ── renderTasks ──────────────────────────────────────────────────────
    /**
     * Full container re-render of the #task-list.
     * Clears the list, then appends one <li> per task (or an empty-state
     * message when there are no tasks).  All interactive elements carry
     * data-action / data-id attributes for the delegated event handler.
     */
    function renderTasks() {
      var listEl = document.getElementById('task-list');
      if (!listEl) { return; }

      listEl.innerHTML = '';

      if (tasks.length === 0) {
        var emptyEl = document.createElement('li');
        emptyEl.className = 'empty-state';
        emptyEl.textContent = 'No tasks yet. Add one above!';
        listEl.appendChild(emptyEl);
        return;
      }

      tasks.forEach(function (task) {
        var li = document.createElement('li');

        // Completion toggle (checkbox)
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-toggle';
        checkbox.checked = task.completed;
        checkbox.setAttribute('aria-checked', String(task.completed));
        checkbox.setAttribute('aria-label', 'Mark task complete');
        checkbox.setAttribute('data-action', 'toggle');
        checkbox.setAttribute('data-id', task.id);

        // Title span
        var titleSpan = document.createElement('span');
        titleSpan.className = 'task-title' + (task.completed ? ' completed' : '');
        titleSpan.textContent = task.title;
        titleSpan.setAttribute('data-id', task.id);

        // Edit button
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'task-btn task-btn-edit';
        editBtn.textContent = '\u270F\uFE0F';
        editBtn.setAttribute('aria-label', 'Edit task');
        editBtn.setAttribute('data-action', 'edit');
        editBtn.setAttribute('data-id', task.id);

        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'task-btn task-btn-delete';
        deleteBtn.textContent = '\uD83D\uDDD1\uFE0F';
        deleteBtn.setAttribute('aria-label', 'Delete task');
        deleteBtn.setAttribute('data-action', 'delete');
        deleteBtn.setAttribute('data-id', task.id);

        li.appendChild(checkbox);
        li.appendChild(titleSpan);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
      });
    }

    // ── addTask ──────────────────────────────────────────────────────────
    /**
     * Validate `title`, create a new Task, persist, and re-render.
     * Shows an inline error in #task-error and returns early on invalid input.
     *
     * @param {string} title  Raw value from the input field.
     */
    function addTask(title) {
      var trimmed = (title || '').trim();

      if (trimmed.length === 0) {
        var errorEl = document.getElementById('task-error');
        if (errorEl) { errorEl.textContent = 'Task title is required.'; }
        return;
      }

      if (trimmed.length > Config.TASK_TITLE_MAX) {
        var errorEl2 = document.getElementById('task-error');
        if (errorEl2) {
          errorEl2.textContent = 'Task title must be 255 characters or less.';
        }
        return;
      }

      tasks.push(createTask(trimmed));
      saveToStorage();
      renderTasks();
      clearTaskError();

      var inputEl = document.getElementById('task-input');
      if (inputEl) { inputEl.value = ''; }
    }

    // ── editTask ─────────────────────────────────────────────────────────
    /**
     * Update a task's title in-place, then persist and re-render.
     * Returns false (without modifying storage) when validation fails.
     * The caller is responsible for showing inline edit errors.
     *
     * @param  {string} id        Task id to edit.
     * @param  {string} newTitle  Raw new title from the edit input.
     * @returns {boolean}  true on success, false on validation failure.
     */
    function editTask(id, newTitle) {
      var trimmed = (newTitle || '').trim();

      if (trimmed.length === 0 || trimmed.length > Config.TASK_TITLE_MAX) {
        return false;
      }

      var task = null;
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === id) { task = tasks[i]; break; }
      }
      if (!task) { return false; }

      task.title = trimmed;
      saveToStorage();
      renderTasks();
      return true;
    }

    // ── toggleTask ───────────────────────────────────────────────────────
    /**
     * Flip the `completed` flag on a task, then persist and re-render.
     * On StorageError the in-memory change is preserved (per Req 7.5).
     *
     * @param {string} id  Task id to toggle.
     */
    function toggleTask(id) {
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id === id) {
          tasks[i].completed = !tasks[i].completed;
          break;
        }
      }
      saveToStorage();
      renderTasks();
    }

    // ── deleteTask ───────────────────────────────────────────────────────
    /**
     * Ask for confirmation, then remove the task and persist.
     * Does nothing if the user cancels the confirmation prompt.
     *
     * @param {string} id  Task id to delete.
     */
    function deleteTask(id) {
      if (!window.confirm('Delete this task?')) { return; }
      tasks = tasks.filter(function (t) { return t.id !== id; });
      saveToStorage();
      renderTasks();
    }

    // ── Public interface ─────────────────────────────────────────────────
    return {
      /**
       * Load persisted tasks, render the initial list, and wire all DOM
       * controls for add, toggle, edit, and delete actions.
       */
      init: function () {
        loadFromStorage();
        renderTasks();

        // Add task: button click
        var addBtn = document.getElementById('task-add-btn');
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            var inputEl = document.getElementById('task-input');
            addTask(inputEl ? inputEl.value : '');
          });
        }

        // Add task: Enter key on input; clear inline error on any input change
        var taskInput = document.getElementById('task-input');
        if (taskInput) {
          taskInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { addTask(taskInput.value); }
          });
          taskInput.addEventListener('input', function () {
            clearTaskError();
          });
        }

        // Delegated click handler on #task-list (toggle, edit, delete)
        var listEl2 = document.getElementById('task-list');
        if (listEl2) {
          listEl2.addEventListener('click', function (e) {
            var target = e.target.closest('[data-action]');
            if (!target) { return; }
            var action = target.getAttribute('data-action');
            var id     = target.getAttribute('data-id');

            if (action === 'toggle') {
              toggleTask(id);
            } else if (action === 'delete') {
              deleteTask(id);
            } else if (action === 'edit') {
              // Inline edit: replace the title <span> with a pre-filled <input>
              var li = target.closest('li');
              if (!li) { return; }
              var titleSpan2 = li.querySelector('.task-title');
              if (!titleSpan2) { return; }

              var currentTitle = titleSpan2.textContent;

              var editInput = document.createElement('input');
              editInput.type      = 'text';
              editInput.className = 'task-edit-input';
              editInput.value     = currentTitle;
              editInput.maxLength = 255;
              editInput.setAttribute('aria-label', 'Edit task title');

              // Inline error span shown inside the row
              var editError = document.createElement('span');
              editError.className = 'field-error';
              editError.setAttribute('role', 'alert');

              li.replaceChild(editInput, titleSpan2);
              li.insertBefore(editError, target); // insert before the edit button
              editInput.focus();

              // Track whether the edit has already been committed/cancelled to
              // prevent the blur handler from firing twice.
              var settled = false;

              function confirmEdit() {
                if (settled) { return; }
                var newTitle = editInput.value.trim();
                if (newTitle.length === 0) {
                  editError.textContent = 'Title cannot be empty.';
                  return;
                }
                if (newTitle.length > 255) {
                  editError.textContent = 'Title must be 255 characters or less.';
                  return;
                }
                settled = true;
                editTask(id, newTitle); // persists and re-renders
              }

              function cancelEdit() {
                if (settled) { return; }
                settled = true;
                renderTasks(); // restore original state without touching storage
              }

              editInput.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter')  { confirmEdit(); }
                if (ev.key === 'Escape') { cancelEdit();  }
              });

              // Confirm on blur (small delay lets Escape keydown fire first)
              editInput.addEventListener('blur', function () {
                setTimeout(function () {
                  // Only act if the edit input is still in the DOM
                  var currentList = document.getElementById('task-list');
                  if (currentList && currentList.contains(editInput)) {
                    confirmEdit();
                  }
                }, 150);
              });
            }
          });
        }
      },

      addTask:    addTask,
      editTask:   editTask,
      toggleTask: toggleTask,
      deleteTask: deleteTask
    };

  }());

  // ─── Links ────────────────────────────────────────────────────────────────
  // Labelled shortcut buttons to external URLs; persisted to localStorage.
  var Links = (function () {

    // ── Closure state ────────────────────────────────────────────────────
    var links = [];

    // ── validateLabel ────────────────────────────────────────────────────
    /**
     * Validate a link label.
     * Returns { valid: true } if label is a string with 1–100 non-whitespace
     * characters after trim; otherwise { valid: false, error: '<message>' }.
     * Never throws for any input.
     *
     * @param  {*} label
     * @returns {{ valid: boolean, error?: string }}
     */
    function validateLabel(label) {
      try {
        if (
          typeof label === 'string' &&
          label.trim().length >= 1 &&
          label.trim().length <= Config.LABEL_MAX
        ) {
          return { valid: true };
        }
        return { valid: false, error: 'Label is required and must be 1\u2013100 characters.' };
      } catch (e) {
        return { valid: false, error: 'Label is required and must be 1\u2013100 characters.' };
      }
    }

    // ── validateUrl ──────────────────────────────────────────────────────
    /**
     * Validate a link URL.
     * Returns { valid: true } if url is a string that starts with 'http://'
     * or 'https://' and whose length is between 1 and Config.URL_MAX (2048).
     * Otherwise returns { valid: false, error: '<message>' }.
     * Never throws for any input.
     *
     * @param  {*} url
     * @returns {{ valid: boolean, error?: string }}
     */
    function validateUrl(url) {
      try {
        if (
          typeof url === 'string' &&
          (url.startsWith('http://') || url.startsWith('https://')) &&
          url.length >= 1 &&
          url.length <= Config.URL_MAX
        ) {
          return { valid: true };
        }
        return { valid: false, error: 'URL must start with http:// or https:// and be at most 2048 characters.' };
      } catch (e) {
        return { valid: false, error: 'URL must start with http:// or https:// and be at most 2048 characters.' };
      }
    }

    // ── createLink ───────────────────────────────────────────────────────
    /**
     * Factory function for Link objects.
     * Generates a unique ID from timestamp + random suffix.
     *
     * @param  {string} label
     * @param  {string} url
     * @returns {{ id: string, label: string, url: string }}
     */
    function createLink(label, url) {
      return {
        id:    'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        label: label.trim(),
        url:   url.trim()
      };
    }

    // ── loadFromStorage ──────────────────────────────────────────────────
    /**
     * Read and deserialise the links array from localStorage.
     * Assigns to the closure `links` variable.
     * Falls back to an empty array on any error or invalid data.
     * Never throws.
     */
    function loadFromStorage() {
      try {
        var result = Storage.get(Config.STORAGE_KEY_LINKS);
        links = Array.isArray(result) ? result : [];
      } catch (e) {
        links = [];
      }
    }

    // ── showErrorBanner ──────────────────────────────────────────────────
    /**
     * Display a message in the #error-banner element, add the 'visible'
     * class, and auto-hide it after 5 seconds.
     *
     * @param {string} message
     */
    function showErrorBanner(message) {
      var banner = document.getElementById('error-banner');
      if (!banner) { return; }
      banner.textContent = message;
      banner.classList.add('visible');
      setTimeout(function () {
        banner.textContent = '';
        banner.classList.remove('visible');
      }, 5000);
    }

    // ── saveToStorage ────────────────────────────────────────────────────
    /**
     * Serialise and write the current links array to localStorage.
     * Snapshots links before writing; on StorageError reverts links to the
     * snapshot and shows the error banner.
     * Returns true on success, false on failure.
     *
     * @returns {boolean}
     */
    function saveToStorage() {
      var snapshot = links.slice();
      try {
        Storage.set(Config.STORAGE_KEY_LINKS, links);
        return true;
      } catch (e) {
        if (e && e.name === 'StorageError') {
          links = snapshot;
          showErrorBanner('Could not save your links. Please try again.');
        }
        return false;
      }
    }

    // ── renderLinks ──────────────────────────────────────────────────────
    /**
     * Full container re-render: clears #link-list and rebuilds it from the
     * current `links` array. Shows an empty-state paragraph when there are
     * no links. Each link gets a .link-entry div containing an open button
     * and a delete button; both carry data-action / data-id attributes so
     * the delegated click handler in init() can dispatch correctly.
     */
    function renderLinks() {
      var containerEl = document.getElementById('link-list');
      if (!containerEl) { return; }

      // Full container re-render
      containerEl.innerHTML = '';

      if (links.length === 0) {
        var emptyEl = document.createElement('p');
        emptyEl.className = 'empty-state';
        emptyEl.textContent = 'No links added yet.';
        containerEl.appendChild(emptyEl);
        return;
      }

      links.forEach(function (link) {
        // Wrap each link+delete in a .link-entry div
        var entry = document.createElement('div');
        entry.className = 'link-entry';

        // Open button — label truncated to 30 chars
        var openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'link-btn-open';
        openBtn.textContent = link.label.length > 30 ? link.label.slice(0, 30) : link.label;
        openBtn.title = link.label; // show full label on hover
        openBtn.setAttribute('aria-label', 'Open ' + link.label);
        openBtn.setAttribute('data-action', 'open');
        openBtn.setAttribute('data-id', link.id);
        openBtn.setAttribute('data-url', link.url);

        // Delete button
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'link-btn-delete';
        deleteBtn.textContent = '\u2715';
        deleteBtn.setAttribute('aria-label', 'Delete link ' + link.label);
        deleteBtn.setAttribute('data-action', 'delete');
        deleteBtn.setAttribute('data-id', link.id);

        entry.appendChild(openBtn);
        entry.appendChild(deleteBtn);
        containerEl.appendChild(entry);
      });
    }

    // ── addLink ──────────────────────────────────────────────────────────
    /**
     * Validate label and url, enforce the 20-link cap, create and persist
     * the new link, then re-render.
     * Shows inline errors on #link-label-error and #link-url-error when
     * validation fails.
     *
     * @param {string} label
     * @param {string} url
     */
    function addLink(label, url) {
      var labelResult = validateLabel(label);
      var urlResult   = validateUrl(url);

      var labelErrorEl = document.getElementById('link-label-error');
      var urlErrorEl   = document.getElementById('link-url-error');

      // Show or clear inline label error
      if (!labelResult.valid) {
        if (labelErrorEl) { labelErrorEl.textContent = labelResult.error; }
      }

      // Show or clear inline URL error
      if (!urlResult.valid) {
        if (urlErrorEl) { urlErrorEl.textContent = urlResult.error; }
      }

      // Abort if either field is invalid
      if (!labelResult.valid || !urlResult.valid) { return; }

      // Enforce link cap (Req 11.10)
      if (links.length >= Config.LINK_MAX) {
        if (urlErrorEl) { urlErrorEl.textContent = 'Maximum of 20 links reached.'; }
        return;
      }

      // Persist, render, and clear inputs
      links.push(createLink(label, url));
      if (saveToStorage()) {
        renderLinks();
        var labelInputEl = document.getElementById('link-label-input');
        var urlInputEl   = document.getElementById('link-url-input');
        if (labelInputEl) { labelInputEl.value = ''; }
        if (urlInputEl)   { urlInputEl.value   = ''; }
      }
    }

    // ── deleteLink ───────────────────────────────────────────────────────
    /**
     * Remove the link with the given id, persist, and re-render.
     *
     * @param {string} id
     */
    function deleteLink(id) {
      links = links.filter(function (link) { return link.id !== id; });
      saveToStorage();
      renderLinks();
    }

    // ── Public interface ─────────────────────────────────────────────────
    return {
      /**
       * Bootstrap: load persisted links and render the initial state.
       * DOM event wiring is handled in task 7.2.
       */
      init: function () {
        loadFromStorage();
        renderLinks();
        // Add link button
        var addBtn = document.getElementById('link-add-btn');
        if (addBtn) {
          addBtn.addEventListener('click', function () {
            var labelInput = document.getElementById('link-label-input');
            var urlInput   = document.getElementById('link-url-input');
            addLink(
              labelInput ? labelInput.value : '',
              urlInput   ? urlInput.value   : ''
            );
          });
        }

        // Clear inline errors on input events
        var labelInput2 = document.getElementById('link-label-input');
        if (labelInput2) {
          labelInput2.addEventListener('input', function () {
            var errEl = document.getElementById('link-label-error');
            if (errEl) { errEl.textContent = ''; }
          });
        }

        var urlInput2 = document.getElementById('link-url-input');
        if (urlInput2) {
          urlInput2.addEventListener('input', function () {
            var errEl = document.getElementById('link-url-error');
            if (errEl) { errEl.textContent = ''; }
          });
        }

        // Delegated click handler on #link-list
        var linkListEl = document.getElementById('link-list');
        if (linkListEl) {
          linkListEl.addEventListener('click', function (e) {
            var target = e.target.closest('[data-action]');
            if (!target) { return; }
            var action = target.getAttribute('data-action');
            var id = target.getAttribute('data-id');

            if (action === 'open') {
              var url = target.getAttribute('data-url');
              window.open(url, '_blank', 'noopener,noreferrer');
            } else if (action === 'delete') {
              deleteLink(id);
            }
          });
        }
      },

      addLink:       addLink,
      deleteLink:    deleteLink,
      validateLabel: validateLabel,
      validateUrl:   validateUrl
    };

  }());

  // ─── App ──────────────────────────────────────────────────────────────────
  // Wires all modules together on DOMContentLoaded.
  var App = {
    init: function () {
      Greeting.init();
      Timer.init();
      Tasks.init();
      Links.init();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    App.init();
  });

})();
