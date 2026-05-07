# Task Manager

The plugin to manage tasks.

## Development

1. Run `npm install`
2. Run `npm run dev` while developing
3. Run `npm run build` for a production bundle

## Features

- Monitor Markdown files inside a configured vault folder
- Add `@start(YYYY-MM-DD)` when a new `- [ ]` task is created
- Archive completed tasks into weekly log files under a configured archive root
- Remove completed tasks from the source note after archiving

## Sandbox preview

The preview script defaults to the Obsidian Sandbox vault under `%APPDATA%`.

```powershell
.\preview-in-sandbox.ps1 -EnablePlugin
```

Use a different vault only when needed:

```powershell
.\preview-in-sandbox.ps1 -VaultPath 'D:\My Vault'
```
