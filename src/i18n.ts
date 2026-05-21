import { getLanguage } from "obsidian";
import type {
  TaskManagerLanguageMode,
  TaskManagerSettings,
} from "./types";

export const GITHUB_REPO_URL = "https://github.com/gansxx/task_manager";

export type TaskManagerLocale = "zh" | "en";

interface SettingsCopy {
  languageName: string;
  languageDesc: string;
  languageAuto: string;
  languageChinese: string;
  languageEnglish: string;
  watchedFolderName: string;
  watchedFolderDesc: string;
  watchedFolderPlaceholder: string;
  archiveRootFolderName: string;
  archiveRootFolderDesc: string;
  archiveRootFolderPlaceholder: string;
  startTokenFormatName: string;
  startTokenFormatDesc: string;
  doneTokenFormatName: string;
  doneTokenFormatDesc: string;
  timestampPrecisionName: string;
  timestampPrecisionDesc: string;
  timestampPrecisionDate: string;
  timestampPrecisionMinute: string;
  timestampPrecisionSecond: string;
  hideMetadataTokensName: string;
  hideMetadataTokensDesc: string;
  archiveDontAskAgainLabel: string;
  immediateArchiveName: string;
  immediateArchiveDesc: string;
  scanVaultOnStartupName: string;
  scanVaultOnStartupDesc: string;
  githubName: string;
  githubDesc: string;
  githubButtonLabel: string;
  archiveFailureNotice: string;
  archiveCurrentFileRibbonTitle: string;
  archiveCurrentTaskMenuLabel: string;
  archiveMissingFileNotice: string;
  archiveNoTasksNotice: string;
  archiveSingleTaskSuccessNotice: string;
  archivePageSuccessNotice: (count: number) => string;
  archiveActionFailureNotice: string;
  archiveConfirmTitle: string;
  archiveCurrentFileConfirmMessage: (count: number) => string;
  archiveCurrentTaskConfirmMessage: string;
  archiveConfirmButton: string;
  archiveCancelButton: string;
  archiveLocationLabel: string;
  archiveLocationsLabel: string;
  archiveSingleTaskSuccessWithPath: (path: string) => string;
  archivePageSuccessWithPaths: (count: number, paths: string[]) => string;
  openTaskSidebarRibbonTitle: string;
  taskSidebarTitle: string;
  taskSidebarFiltersTitle: string;
  taskSidebarFilePathLabel: string;
  taskSidebarFilePathPlaceholder: string;
  taskSidebarSelectFolder: string;
  taskSidebarCurrentFile: string;
  taskSidebarWholeVault: string;
  taskSidebarArchive: string;
  taskSidebarDateRange: string;
  taskSidebarPriority: string;
  taskSidebarArchiveFilter: string;
  taskSidebarAllPriorities: string;
  taskSidebarPriorityUrgent: string;
  taskSidebarPriorityHigh: string;
  taskSidebarPriorityMedium: string;
  taskSidebarPriorityLow: string;
  taskSidebarPriorityNone: string;
  taskSidebarAllTasks: string;
  taskSidebarNotArchived: string;
  taskSidebarArchived: string;
  taskSidebarToday: string;
  taskSidebarSevenDays: string;
  taskSidebarThirtyDays: string;
  taskSidebarReset: string;
  taskSidebarLoading: string;
  taskSidebarNoTasks: string;
  taskSidebarEmptyTask: string;
  taskSidebarInWholeVault: string;
  taskSidebarInCurrentFile: string;
  taskSidebarInPath: (path: string) => string;
  taskSidebarArchivedStatus: string;
  taskSidebarNotArchivedStatus: string;
  taskSidebarWithPriority: (priority: string) => string;
  taskSidebarFromTo: (startDate: string, endDate: string) => string;
  taskSidebarTaskCount: (count: number, description: string, loading: boolean) => string;
  taskSidebarSetPriority: (priority: string) => string;
  taskSidebarAddComment: string;
  taskSidebarAddCommentTitle: string;
  taskSidebarCommentName: string;
  taskSidebarCommentPlaceholder: string;
  taskSidebarCommentEmptyNotice: string;
  taskSidebarSelectedTaskMissingNotice: string;
}

const COPY: Record<TaskManagerLocale, SettingsCopy> = {
  zh: {
    languageName: "界面语言",
    languageDesc: "自动跟随 Obsidian 语言，或手动切换为中文和英文。",
    languageAuto: "自动",
    languageChinese: "中文",
    languageEnglish: "English",
    watchedFolderName: "监听文件夹",
    watchedFolderDesc:
      "留空时默认跟踪当前正在编辑的文件；填写文件夹路径后，仅监听该目录下的 Markdown 文件。",
    watchedFolderPlaceholder: "留空则跟踪当前文件",
    archiveRootFolderName: "归档根目录",
    archiveRootFolderDesc: "完成任务会按 年 / 月 / 周 文件归档到这里。",
    archiveRootFolderPlaceholder: "Task Archive",
    startTokenFormatName: "开始标记格式",
    startTokenFormatDesc: "使用 {date} 作为日期占位符。",
    doneTokenFormatName: "完成标记格式",
    doneTokenFormatDesc: "使用 {date} 作为日期占位符。",
    timestampPrecisionName: "时间戳精度",
    timestampPrecisionDesc: "控制 {date} 写入日期、分钟或秒级时间，归档仍按日期分组。",
    timestampPrecisionDate: "日期（YYYY-MM-DD）",
    timestampPrecisionMinute: "分钟（YYYY-MM-DD HH:mm）",
    timestampPrecisionSecond: "秒（YYYY-MM-DD HH:mm:ss）",
    hideMetadataTokensName: "隐藏任务元数据标签",
    hideMetadataTokensDesc: "默认关闭。开启后，在阅读模式和实时阅览模式中隐藏 @start、@done、@priority、@from、@archived 等行内标签。",
    archiveDontAskAgainLabel: "以后不再提示",
    immediateArchiveName: "立刻归档",
    immediateArchiveDesc:
      "默认关闭。开启后勾选任务会立刻归档并从原文档移除；关闭后只追加 @done 日期并保留在原文档。",
    scanVaultOnStartupName: "启动后后台扫描全库",
    scanVaultOnStartupDesc: "默认关闭。开启后插件启动时会在后台扫描整个仓库任务，不必等待点击全库。",
    githubName: "GitHub",
    githubDesc: GITHUB_REPO_URL,
    githubButtonLabel: "打开仓库",
    archiveFailureNotice: "Task Manager 归档已完成任务时失败。",
    archiveCurrentFileRibbonTitle: "归档当前页面中的全部任务",
    archiveCurrentTaskMenuLabel: "归档当前任务",
    archiveMissingFileNotice: "当前没有可归档的 Markdown 文件。",
    archiveNoTasksNotice: "当前页面中没有可归档的任务。",
    archiveSingleTaskSuccessNotice: "已归档当前任务。",
    archivePageSuccessNotice: (count) => `已归档当前页面中的 ${count} 个任务。`,
    archiveActionFailureNotice: "Task Manager 手动归档任务时失败。",
    archiveConfirmTitle: "确认归档",
    archiveCurrentFileConfirmMessage: (count) => `将归档当前页面中的 ${count} 个已完成任务。归档后这些任务会从当前页面移除。是否继续？`,
    archiveCurrentTaskConfirmMessage: "将归档当前已完成任务。归档后该任务会从当前页面移除。是否继续？",
    archiveConfirmButton: "确认归档",
    archiveCancelButton: "取消",
    archiveLocationLabel: "归档位置",
    archiveLocationsLabel: "归档位置",
    archiveSingleTaskSuccessWithPath: (path) => `已归档当前任务。归档位置：${path}`,
    archivePageSuccessWithPaths: (count, paths) => `已归档 ${count} 个任务。归档位置：${paths.join("；")}`,
    openTaskSidebarRibbonTitle: "打开任务侧边栏",
    taskSidebarTitle: "任务",
    taskSidebarFiltersTitle: "过滤器",
    taskSidebarFilePathLabel: "文件路径",
    taskSidebarFilePathPlaceholder: "当前文件、文件夹，或留空表示全库",
    taskSidebarSelectFolder: "选择文件夹…",
    taskSidebarCurrentFile: "当前文件",
    taskSidebarWholeVault: "全库",
    taskSidebarArchive: "归档",
    taskSidebarDateRange: "日期范围",
    taskSidebarPriority: "任务优先级",
    taskSidebarArchiveFilter: "归档状态",
    taskSidebarAllPriorities: "全部优先级",
    taskSidebarPriorityUrgent: "紧急",
    taskSidebarPriorityHigh: "高",
    taskSidebarPriorityMedium: "中",
    taskSidebarPriorityLow: "低",
    taskSidebarPriorityNone: "无优先级",
    taskSidebarAllTasks: "全部任务",
    taskSidebarNotArchived: "未归档",
    taskSidebarArchived: "已归档",
    taskSidebarToday: "今天",
    taskSidebarSevenDays: "7 天",
    taskSidebarThirtyDays: "30 天",
    taskSidebarReset: "重置",
    taskSidebarLoading: "加载中…",
    taskSidebarNoTasks: "没有找到任务。",
    taskSidebarEmptyTask: "（空任务）",
    taskSidebarInWholeVault: "（全库）",
    taskSidebarInCurrentFile: "（当前文件）",
    taskSidebarInPath: (path) => `（${path}）`,
    taskSidebarArchivedStatus: "已归档",
    taskSidebarNotArchivedStatus: "未归档",
    taskSidebarWithPriority: (priority) => `，优先级：${priority}`,
    taskSidebarFromTo: (startDate, endDate) => `，日期：${startDate || "…"} 到 ${endDate || "…"}`,
    taskSidebarTaskCount: (count, description, loading) => `${count} 个任务${description}${loading ? " · 加载中…" : ""}`,
    taskSidebarSetPriority: (priority) => `设为${priority}`,
    taskSidebarAddComment: "添加评论",
    taskSidebarAddCommentTitle: "添加任务评论",
    taskSidebarCommentName: "评论",
    taskSidebarCommentPlaceholder: "添加一条简短评论",
    taskSidebarCommentEmptyNotice: "评论不能为空。",
    taskSidebarSelectedTaskMissingNotice: "Task Manager 找不到选中的任务行。",
  },
  en: {
    languageName: "Language",
    languageDesc: "Follow Obsidian automatically, or switch the settings UI to Chinese or English.",
    languageAuto: "Auto",
    languageChinese: "中文",
    languageEnglish: "English",
    watchedFolderName: "Watched folder",
    watchedFolderDesc:
      "Leave this blank to track the file you are currently editing. Set a folder path to monitor only Markdown files inside that folder.",
    watchedFolderPlaceholder: "Leave blank to track the current file",
    archiveRootFolderName: "Archive root folder",
    archiveRootFolderDesc: "Completed tasks will be archived under year / month / week files here.",
    archiveRootFolderPlaceholder: "Task Archive",
    startTokenFormatName: "Start token format",
    startTokenFormatDesc: "Use {date} as the date placeholder.",
    doneTokenFormatName: "Done token format",
    doneTokenFormatDesc: "Use {date} as the date placeholder.",
    timestampPrecisionName: "Timestamp precision",
    timestampPrecisionDesc: "Controls whether {date} writes a date, minute timestamp, or second timestamp. Archives still group by day.",
    timestampPrecisionDate: "Date (YYYY-MM-DD)",
    timestampPrecisionMinute: "Minute (YYYY-MM-DD HH:mm)",
    timestampPrecisionSecond: "Second (YYYY-MM-DD HH:mm:ss)",
    hideMetadataTokensName: "Hide task metadata tokens",
    hideMetadataTokensDesc: "Disabled by default. When enabled, hides inline @start, @done, @priority, @from, @archived tokens in reading mode and live preview.",
    archiveDontAskAgainLabel: "Don't ask again",
    immediateArchiveName: "Immediate archive",
    immediateArchiveDesc:
      "Disabled by default. When enabled, completed tasks are archived and removed from the source note immediately. When disabled, only the @done date is added.",
    scanVaultOnStartupName: "Scan whole vault on startup",
    scanVaultOnStartupDesc: "Disabled by default. When enabled, scan tasks in the background right after startup without waiting for Whole vault click.",
    githubName: "GitHub",
    githubDesc: GITHUB_REPO_URL,
    githubButtonLabel: "Open repository",
    archiveFailureNotice: "Task Manager could not archive the completed task.",
    archiveCurrentFileRibbonTitle: "Archive all tasks in the current note",
    archiveCurrentTaskMenuLabel: "Archive current task",
    archiveMissingFileNotice: "There is no active Markdown file to archive.",
    archiveNoTasksNotice: "There are no tasks to archive in the current note.",
    archiveSingleTaskSuccessNotice: "Archived the current task.",
    archivePageSuccessNotice: (count) => `Archived ${count} tasks from the current note.`,
    archiveActionFailureNotice: "Task Manager could not archive the selected tasks.",
    archiveConfirmTitle: "Confirm archive",
    archiveCurrentFileConfirmMessage: (count) => `Archive ${count} completed tasks from the current note? They will be removed from the note after archiving.`,
    archiveCurrentTaskConfirmMessage: "Archive the current completed task? It will be removed from the note after archiving.",
    archiveConfirmButton: "Archive",
    archiveCancelButton: "Cancel",
    archiveLocationLabel: "Archive location",
    archiveLocationsLabel: "Archive locations",
    archiveSingleTaskSuccessWithPath: (path) => `Archived the current task to ${path}`,
    archivePageSuccessWithPaths: (count, paths) => `Archived ${count} tasks to ${paths.join("; ")}`,
    openTaskSidebarRibbonTitle: "Open Task Manager sidebar",
    taskSidebarTitle: "Tasks",
    taskSidebarFiltersTitle: "Filters",
    taskSidebarFilePathLabel: "File path",
    taskSidebarFilePathPlaceholder: "Current file, folder, or blank for vault",
    taskSidebarSelectFolder: "Select folder…",
    taskSidebarCurrentFile: "Current file",
    taskSidebarWholeVault: "Whole vault",
    taskSidebarArchive: "Archive",
    taskSidebarDateRange: "Date range",
    taskSidebarPriority: "Task priority",
    taskSidebarArchiveFilter: "Archive",
    taskSidebarAllPriorities: "All priorities",
    taskSidebarPriorityUrgent: "Urgent",
    taskSidebarPriorityHigh: "High",
    taskSidebarPriorityMedium: "Medium",
    taskSidebarPriorityLow: "Low",
    taskSidebarPriorityNone: "No priority",
    taskSidebarAllTasks: "All tasks",
    taskSidebarNotArchived: "Not archived",
    taskSidebarArchived: "Archived",
    taskSidebarToday: "Today",
    taskSidebarSevenDays: "7 days",
    taskSidebarThirtyDays: "30 days",
    taskSidebarReset: "Reset",
    taskSidebarLoading: "Loading…",
    taskSidebarNoTasks: "No tasks found.",
    taskSidebarEmptyTask: "(empty task)",
    taskSidebarInWholeVault: " in whole vault",
    taskSidebarInCurrentFile: " in current file",
    taskSidebarInPath: (path) => ` in ${path}`,
    taskSidebarArchivedStatus: "archived",
    taskSidebarNotArchivedStatus: "not archived",
    taskSidebarWithPriority: (priority) => ` with ${priority} priority`,
    taskSidebarFromTo: (startDate, endDate) => ` from ${startDate || "…"} to ${endDate || "…"}`,
    taskSidebarTaskCount: (count, description, loading) => `${count} task(s)${description}${loading ? " · loading…" : ""}`,
    taskSidebarSetPriority: (priority) => `Set priority: ${priority}`,
    taskSidebarAddComment: "Add comment",
    taskSidebarAddCommentTitle: "Add task comment",
    taskSidebarCommentName: "Comment",
    taskSidebarCommentPlaceholder: "Add a short comment",
    taskSidebarCommentEmptyNotice: "Comment cannot be empty.",
    taskSidebarSelectedTaskMissingNotice: "Task Manager could not find the selected task line.",
  },
};

export function resolveLocale(
  languageMode: TaskManagerLanguageMode,
): TaskManagerLocale {
  if (languageMode === "zh" || languageMode === "en") {
    return languageMode;
  }

  try {
    return getLanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function getSettingsCopy(
  settings: Pick<TaskManagerSettings, "languageMode">,
): SettingsCopy {
  return COPY[resolveLocale(settings.languageMode)];
}
