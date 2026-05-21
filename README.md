# Task Timestamp Marker

[简体中文说明](./README.zh-CN.md)

Task Timestamp Marker is an Obsidian task helper that keeps task metadata in plain Markdown. It can add lifecycle timestamps, set priorities, show a filterable task sidebar, collect comments as child bullets, and archive completed tasks into weekly notes.

## Features

- Automatically adds `@start(...)` when you create an empty task.
- Automatically adds `@done(...)` when you complete a task.
- Removes `@done(...)` when you reopen a completed task.
- Supports configurable timestamp precision: date, minute, or second.
- Supports task priority with `@priority(low|medium|high|urgent)`.
- Adds a Task Manager sidebar with filters for file/folder scope, date range, priority, and archive state.
- Shows nested tasks in the sidebar according to Markdown indentation, with expand/collapse controls.
- Adds task comments as indented child bullets, for example `- follow-up note @comment`.
- Optionally hides metadata tokens in reading mode and live preview.
- Archives completed tasks into year/month/week notes, with optional “don’t ask again” confirmation.

## Installation

### Manual install from a release package

1. Download the release ZIP from GitHub Releases.
2. Unzip it. You should get a plugin folder named like `task-timestamp-marker`.
3. Copy that folder into your vault at `.obsidian/plugins/`.
4. Make sure the folder contains:
   - `main.js`
   - `manifest.json`
   - `styles.css`
5. Restart Obsidian or reload plugins, then enable **Task Timestamp Marker** in **Settings → Community plugins**.

### Build from source

```bash
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/task-timestamp-marker/`.

## Basic Usage

Create an empty task:

```markdown
- [ ]
```

The plugin turns it into a tracked task:

```markdown
- [ ] @start(2026-05-17)
```

When you complete it, the plugin appends a done marker:

```markdown
- [x] @start(2026-05-17) @done(2026-05-17)
```

If you uncheck the task later, the `@done(...)` marker is removed automatically.

## Task Priority

Use the command palette or the editor right-click menu to set the current task priority:

- `urgent`
- `high`
- `medium`
- `low`
- `none`

Priority is stored inline:

```markdown
- [ ] Review release checklist @start(2026-05-17) @priority(high)
```

Priority tokens are highlighted, and priority also affects the task styling in the sidebar.

## Task Comments

In the Task Manager sidebar, right-click a task and choose **Add comment**. Comments are written as indented child bullets instead of being added to the task line:

```markdown
- [ ] Review release checklist @start(2026-05-17)
	- Ask Alice to verify the release notes @comment
```

Comment lines are displayed with a muted/comment style in the sidebar, reading mode, and live preview.

## Task Manager Sidebar

Open the sidebar with either:

- The **list-checks** ribbon icon.
- The command palette command **Open Task Manager sidebar**.

The sidebar supports:

- **File path scope**: current file, whole vault, archive folder, or a custom file/folder path.
- **Folder dropdown**: quickly pick a folder containing Markdown files.
- **Date range**: filter tasks between two dates.
- **Quick date buttons**: Today, 7 days, 30 days, Reset.
- **Priority filter**: all priorities or a specific priority.
- **Archive filter**: not archived by default, archived only, or all tasks.
- **Nested task display**: indentation in Markdown becomes an expandable task tree.
- **Right-click actions**: set priority or add a comment.

When the sidebar scans a large scope such as the whole vault, it shows cached results first and displays a loading indicator while it refreshes.

## Archiving Completed Tasks

You can archive completed tasks manually:

- Click the archive ribbon icon to archive all completed tasks in the current note.
- Right-click a completed task in the editor and choose the archive action.

Archived tasks are moved under the archive root folder, grouped by:

```text
Archive root / ISO year / month / ISO week note
```

Archived lines include source and archive metadata:

```markdown
- [x] Task text @start(2026-05-17) @done(2026-05-17) @from("Projects/A.md") @archived(2026-05-17)
```

The archive confirmation dialog includes **Don’t ask again**. If enabled, future manual archive actions skip the confirmation dialog.

## Settings

Open **Settings → Task Timestamp Marker**.

| Setting | What it does |
| --- | --- |
| Language | Auto, Chinese, or English settings UI. |
| Watched folder | Blank means the active file only. Set a folder to monitor only that folder. |
| Archive root folder | Where archived tasks are stored. |
| Start token format | Template for new task markers. Use `{date}`. |
| Done token format | Template for completion markers. Use `{date}`. |
| Timestamp precision | Write `{date}` as date, minute, or second precision. |
| Hide task metadata tokens | Off by default. Hides metadata tokens in reading mode and live preview when enabled. |
| Immediate archive | When enabled, completed tasks are archived and removed immediately. |

## Metadata Tokens

The plugin stores metadata as Markdown text so your notes remain portable:

- `@start(...)`
- `@done(...)`
- `@priority(...)`
- `@comment`
- `@from("...")`
- `@archived(...)`

If the tokens feel noisy, enable **Hide task metadata tokens**. The tokens stay in the file but are hidden in reading/live preview.

## Development

```bash
npm install
npm run dev
npm run build
```

## Sandbox Preview

The preview script defaults to the Obsidian Sandbox vault under `%APPDATA%`.

```powershell
.\preview-in-sandbox.ps1 -EnablePlugin
```

Or specify another vault:

```powershell
.\preview-in-sandbox.ps1 -VaultPath 'D:\My Vault'
```
