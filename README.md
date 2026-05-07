# Task Manager

Zero-config task tracking for Obsidian.

Task Manager starts working as soon as you enable it:

- Create a task and it appends `@start(YYYY-MM-DD)`.
- Complete a task and it appends `@done(YYYY-MM-DD)`.
- Turn on optional archiving later if you want completed tasks moved into weekly notes.

<!-- HERO IMAGE PLACEHOLDER -->

## What It Does

- Tracks task start dates automatically.
- Tracks task completion dates automatically.
- Works out of the box with no folder setup required.
- Can optionally archive completed tasks into `year / month / week` files.

<!-- ARCHIVE IMAGE PLACEHOLDER -->

## Development

1. Run `npm install`
2. Run `npm run dev` while developing
3. Run `npm run build` for a production bundle

## Sandbox Preview

The preview script defaults to the Obsidian Sandbox vault under `%APPDATA%`.

```powershell
.\preview-in-sandbox.ps1 -EnablePlugin
```

Use a different vault only when needed:

```powershell
.\preview-in-sandbox.ps1 -VaultPath 'D:\My Vault'
```
