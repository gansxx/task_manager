---
name: task-manager-sqlite-archive-test
description: Build and verify the Task Timestamp Marker SQLite-only archive workflow in this repository, including the Obsidian Sandbox cold-start test. Use when changing archive storage, SQL WASM recovery, completed-tasks.sqlite, manual archiving, or immediate archiving.
---

# Task Manager SQLite Archive Test

Use the WSL repository at `/mnt/g/Project/web_mix_project/obs_plugins/task_manager` and the Sandbox vault at `C:\Users\gansxx\AppData\Roaming\obsidian\Obsidian Sandbox`.

## Build checks

1. Run `npm ci --ignore-scripts`, `npm run check`, and `npm run build`.
2. Confirm `manifest.json.version`, `package.json.version`, and `versions.json` agree.
3. Confirm `main.js` is regenerated and the release workflow packages only required runtime files.

## Cold-start Sandbox test

1. Deploy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/task-timestamp-marker` in the Sandbox vault.
2. Preserve any existing `completed-tasks.sqlite` and `sql-wasm.wasm` with a dated backup name, then ensure neither active file exists.
3. Create a dedicated checked-task test note and set `immediateArchiveEnabled` to `false` in the plugin data file.
4. Use the `computer-use:computer-use` skill to open the Sandbox vault, open the test note, and invoke the manual archive ribbon button.
5. Stop at the plugin confirmation modal and obtain the user confirmation immediately before confirming, because source-task removal is a local deletion.
6. Verify that the source task is removed, `sql-wasm.wasm` and `completed-tasks.sqlite` were created, no archive Markdown note was created or changed, and `archived_tasks` contains the task.

## Database query

Use the installed SQLite CLI:

```bash
sqlite3 -header -column "<plugin-dir>/completed-tasks.sqlite" \
  "SELECT source_path, archive_path, task_text, completed_at, archived_at FROM archived_tasks;"
```

Expect `archive_path` to be `completed-tasks.sqlite#archived_tasks` and no vault archive folder to be created.

## Release

After tests pass, increment the version consistently, commit the intended files, push the branch, merge the PR, then create and push an exact no-`v` tag matching `manifest.json.version`.
