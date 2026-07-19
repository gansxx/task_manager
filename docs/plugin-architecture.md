# Task Manager plugin architecture

## Completed-task persistence

The desktop-only plugin records newly completed tasks in
`.obsidian/plugins/task-timestamp-marker/completed-tasks.sqlite`. The database
contains task text and raw Markdown, source path and line, priority, start and
completion timestamps, and a reopen timestamp. Existing completed tasks are
not imported.

`TaskMonitorService` appends `@done(...)` in the source note, then writes a
deduplicated SQLite record through `TaskCompletionStore`. Reopening a task
marks its latest matching row as reopened, excluding it from the completion
analytics query while retaining history.

## UI and analytics

The task sidebar filters Markdown tasks by completion, date, priority, and
file path. The previous Markdown archive controls and archive-state filter are
removed. `TaskAnalyticsView` queries active rows from SQLite for total tasks,
average duration, this-week completions, and the twelve-week chart.

## Build and distribution

`esbuild.config.mjs` bundles the plugin and copies `sql-wasm.wasm` from
`sql.js`. The Sandbox installer and GitHub Release workflow distribute this
asset alongside `main.js`, `manifest.json`, and `styles.css`.
