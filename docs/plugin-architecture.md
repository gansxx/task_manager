# Task Manager 插件代码库结构说明

本文档概览 Task Manager Obsidian 插件的主要目录、核心模块与本轮对任务产品设计的调研结论。

## 顶层文件

- `manifest.json`：Obsidian 插件清单，定义插件 ID、名称、版本与最低 Obsidian 版本。
- `package.json`：Node/TypeScript 构建脚本与依赖声明。
- `esbuild.config.mjs`：将 `src/main.ts` 打包为 Obsidian 可加载的 `main.js`。
- `styles.css`：插件的全局样式，包括日期/来源/优先级 token、任务优先级行样式与侧边栏样式。
- `README.md` / `README.zh-CN.md`：面向用户的英文与中文说明。

## `src/` 源码目录

- `main.ts`：插件入口。负责加载设置、注册生命周期监听、归档 UI、优先级命令、任务侧边栏视图和设置页。
- `settings.ts`：设置页实现与默认设置。当前包括监听目录、归档目录、开始/完成 token 格式、时间戳精度、即时归档和语言设置。
- `i18n.ts`：设置页与归档交互文案的中英文拷贝。
- `types.ts`：共享类型定义，例如插件设置、解析后的任务行、任务生命周期事件和任务优先级枚举。
- `pipeline.ts`：轻量事件管线，用于解耦任务创建、完成、取消完成等生命周期事件与具体处理逻辑。
- `task-sidebar-view.ts`：Obsidian 右侧栏视图。扫描受监听 Markdown 文件，按日期过滤并展示任务。
- `date-token-decorations.ts`：编辑器与阅读模式 token 装饰。负责高亮 `@start(...)`、`@done(...)`、`@from(...)`、`@archived(...)` 和 `@priority(...)`，并按优先级给任务行加样式。
- `confirm-modal.ts`：归档确认弹窗。

## `src/tasks/` 任务领域逻辑

- `task-line.ts`：解析、判断和改写 Markdown 任务行。包含创建开始 token、追加/移除完成 token、设置优先级、判断任务完成/取消完成以及提取归档参考日期。
- `task-monitor-service.ts`：监听 Obsidian 编辑器变化，维护文件快照，触发任务生命周期事件，并处理即时归档或手动归档。
- `archive-service.ts`：将已完成任务写入归档文件。归档文件按年、月、ISO 周组织，无法识别日期的任务进入 `untimed` 目录。

## `src/utils/` 工具函数

- `date.ts`：日期和时间戳格式化、时间戳日期部分提取、ISO 周计算。
- `path.ts`：Markdown 文件和监听目录范围判断。

## 数据流概览

1. 用户在 Markdown 编辑器中输入或修改任务。
2. `TaskMonitorService` 根据快照比较变更行。
3. 服务识别任务创建、完成或取消完成事件，并通过 `TaskEventPipeline` 发出事件。
4. 默认处理器根据设置写入 `@start(...)`、`@done(...)`，取消完成时移除 `@done(...)`，即时归档打开时写入归档并删除原行。
5. `TaskArchiveService` 按任务日期组织归档路径并追加 `@from(...)`、`@archived(...)` 元信息。
6. `date-token-decorations.ts` 与 `styles.css` 负责编辑器/阅读模式可视化。
7. `TaskSidebarView` 扫描受监听文件，并按日期过滤展示任务清单。

## 设计调研要点

- Obsidian Tasks 插件强调任务查询、过滤、优先级、日期和基于日期的动态视图；这提示本插件应把“任务元数据”保持在 Markdown 行内，并让筛选视图基于这些元数据工作。参考：https://publish.obsidian.md/tasks/Queries/Filters 与 https://github.com/obsidian-tasks-group/obsidian-tasks
- Google Tasks 的核心体验是快速创建任务、详情、子任务、日期/时间、重复和 Calendar 联动；这提示本插件优先保持轻量入口，并用侧边栏提供低摩擦浏览。参考：https://support.google.com/tasks/answer/7675772 与 https://workspace.google.com/products/tasks/
- Linear 将 priority 限制为低、中、高、紧急等少量层级，并将过滤、视图、标签、周期和到期日作为核心组织方式；这提示本插件优先采用有限优先级、可保存/可重复的过滤视图，而不是无限自定义字段。参考：https://linear.app/docs/priority、https://linear.app/docs/filters、https://linear.app/docs/custom-views、https://linear.app/docs/due-dates

## 后续演进建议

- 增加 `@due(...)` 与 `@scheduled(...)` token，以区分开始日期、完成日期和计划/截止日期。
- 将侧边栏过滤扩展为优先级、完成状态、文件夹、标签组合过滤。
- 支持类似 Linear custom views 的“保存过滤条件”。
- 支持 Google Tasks 风格的子任务折叠与父子任务上下文展示。

## 本轮筛选与可读性增强

- 右侧任务栏支持开始日期与结束日期组成的日期区间过滤，可覆盖例如 `2026-03-11 ~ 2026-03-22` 的查询场景。
- 右侧任务栏提供 Today、7 days、30 days 和 All 快捷按钮，并可与 priority 下拉过滤组合使用。

- 当全局 watched folder 为空时，右侧任务栏默认与监听器保持一致，仅扫描当前活动文件；用户可用 Current file / Whole vault 快捷按钮切换文件范围，也可输入文件或文件夹路径进行过滤。
- 设置页提供“隐藏任务元数据标签”开关，用于在编辑器与阅读模式中隐藏 `@start(...)`、`@done(...)`、`@priority(...)`、`@from(...)`、`@archived(...)` 等行内标签，降低元数据过多时对原文阅读的干扰。
