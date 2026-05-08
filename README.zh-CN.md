# Task Timestamp Marker

[English README](./README.md)

零配置即可开始使用的 Obsidian 任务跟踪插件。

启用插件后，它会立刻开始工作：

- 新建任务时，自动追加 `@start(YYYY-MM-DD)`。
- 完成任务时，自动追加 `@done(YYYY-MM-DD)`。
- 如果你需要，再手动开启可选归档，把已完成或手动归档的任务收纳到周归档中。

<!-- HERO IMAGE PLACEHOLDER -->

## 功能概览

- 自动记录任务开始时间。
- 自动记录任务完成时间。
- 默认无需配置监听文件夹即可直接使用。
- 支持通过左侧边栏按钮归档当前页面里的全部任务。
- 支持通过右键菜单归档当前单条任务。
- 支持将有时间标记的任务归档到 `年 / 月 / 周` 文件中。
- 支持将没有时间标记的旧任务归档到单独目录中。

<!-- ARCHIVE IMAGE PLACEHOLDER -->

## 开发

1. 运行 `npm install`
2. 开发时运行 `npm run dev`
3. 生产构建运行 `npm run build`

## Sandbox 预览

预览脚本默认使用 `%APPDATA%` 下的 Obsidian Sandbox 库。

```powershell
.\preview-in-sandbox.ps1 -EnablePlugin
```

如果需要，也可以指定其他库：

```powershell
.\preview-in-sandbox.ps1 -VaultPath 'D:\My Vault'
```
