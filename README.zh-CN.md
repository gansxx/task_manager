# Task Timestamp Marker

[English README](./README.md)

Task Timestamp Marker 是一个 Obsidian 任务辅助插件。它把任务元数据保存在普通 Markdown 中，支持自动记录开始/完成时间、任务优先级、右侧任务栏、缩进层级、评论子项和任务归档。

## 功能

- 新建空任务时自动添加 `@start(...)`。
- 完成任务时自动添加 `@done(...)`。
- 取消完成任务时自动移除 `@done(...)`。
- 支持日期、分钟、秒级时间戳精度。
- 支持 `@priority(low|medium|high|urgent)` 优先级。
- 提供 Task Manager 右侧任务栏，可按文件/文件夹、日期范围、优先级、归档状态过滤。
- 右侧任务栏会按 Markdown 缩进显示父子任务，并支持逐级展开/折叠。
- 支持把评论写成缩进子项，例如 `- 评论内容 @comment`。
- 可选在阅读模式和实时阅览模式隐藏元数据标签。
- 支持把已完成任务按年/月/周归档。

## 安装

### 使用 Release 包手动安装

1. 从 GitHub Releases 下载发布 ZIP。
2. 解压后会得到类似 `task-timestamp-marker` 的插件文件夹。
3. 把该文件夹复制到你的库：`.obsidian/plugins/`。
4. 确认文件夹中包含：
   - `main.js`
   - `manifest.json`
   - `styles.css`
5. 重启 Obsidian 或重新加载插件，然后在 **设置 → 第三方插件** 中启用 **Task Timestamp Marker**。

### 从源码构建

```bash
npm install
npm run build
```

然后把 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/task-timestamp-marker/`。

## 基础用法

输入一个空任务：

```markdown
- [ ]
```

插件会自动变成：

```markdown
- [ ] @start(2026-05-17)
```

完成任务后会追加完成时间：

```markdown
- [x] @start(2026-05-17) @done(2026-05-17)
```

如果之后取消勾选任务，`@done(...)` 会被自动移除。

## 任务优先级

通过命令面板或编辑器右键菜单可以设置当前任务优先级：

- `urgent`
- `high`
- `medium`
- `low`
- `none`

优先级会写成行内元数据：

```markdown
- [ ] 检查发布清单 @start(2026-05-17) @priority(high)
```

优先级标签会高亮，侧边栏中也会使用不同样式显示。

## 任务评论

在 Task Manager 侧边栏中右键任务，选择 **Add comment**。评论不会写入父任务行内，而是写成缩进一级的子项：

```markdown
- [ ] 检查发布清单 @start(2026-05-17)
	- 请 Alice 确认发布说明 @comment
```

评论行会在侧边栏、阅读模式和实时阅览模式中使用更弱的评论样式显示。

## Task Manager 侧边栏

打开侧边栏的方式：

- 点击左侧 ribbon 的 **list-checks** 图标。
- 使用命令面板命令 **Open Task Manager sidebar**。

侧边栏支持：

- **文件范围**：当前文件、全库、归档目录、自定义文件或文件夹路径。
- **文件夹下拉框**：快速选择包含 Markdown 文件的文件夹。
- **日期范围**：筛选某个起止日期之间的任务。
- **快捷日期**：Today、7 days、30 days、Reset。
- **优先级过滤**：全部或指定优先级。
- **归档过滤**：默认不显示已归档任务，也可切换为只看已归档或全部任务。
- **层级展示**：Markdown 缩进会变成可展开/折叠的任务树。
- **右键操作**：修改优先级或添加评论。

扫描全库等大范围任务时，侧边栏会先展示最近一次缓存结果，并显示 loading 提示直到刷新完成。

## 归档任务

可以手动归档已完成任务：

- 点击 archive ribbon 图标，归档当前页面中的全部已完成任务。
- 在编辑器中右键某个已完成任务，选择归档当前任务。

归档任务会按以下结构保存：

```text
归档根目录 / ISO 年 / 月 / ISO 周文件
```

归档行会包含来源和归档元数据：

```markdown
- [x] 任务内容 @start(2026-05-17) @done(2026-05-17) @from("Projects/A.md") @archived(2026-05-17)
```

归档确认框中可以勾选 **以后不再提示**，之后手动归档会跳过确认。

## 设置

打开 **设置 → Task Timestamp Marker**。

| 设置 | 说明 |
| --- | --- |
| 界面语言 | 自动、中文或英文。 |
| 监听文件夹 | 留空表示只监听当前活动文件；填写文件夹后仅监听该文件夹。 |
| 归档根目录 | 已归档任务保存位置。 |
| 开始标记格式 | 新任务开始标签模板，使用 `{date}`。 |
| 完成标记格式 | 完成任务标签模板，使用 `{date}`。 |
| 时间戳精度 | `{date}` 写入日期、分钟或秒级时间。 |
| 隐藏任务元数据标签 | 默认关闭；开启后在阅读模式和实时阅览模式隐藏标签。 |
| 立刻归档 | 开启后完成任务会立即归档并从原文件移除。 |

## 元数据标签

插件使用普通 Markdown 文本保存元数据：

- `@start(...)`
- `@done(...)`
- `@priority(...)`
- `@comment`
- `@from("...")`
- `@archived(...)`

如果觉得标签影响阅读，可以开启 **隐藏任务元数据标签**。标签仍保留在源文件中，但会在阅读/实时阅览中隐藏。

## 开发

```bash
npm install
npm run dev
npm run build
```

## Sandbox 预览

预览脚本默认使用 `%APPDATA%` 下的 Obsidian Sandbox 库。

```powershell
.\preview-in-sandbox.ps1 -EnablePlugin
```

如果需要，也可以指定其他库：

```powershell
.\preview-in-sandbox.ps1 -VaultPath 'D:\My Vault'
```
