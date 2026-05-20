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
  sidebarTitle: string;
  sidebarFiltersSummary: string;
  sidebarFilePathLabel: string;
  sidebarFilePathPlaceholder: string;
  sidebarCurrentFileButton: string;
  sidebarWholeVaultButton: string;
  sidebarArchiveButton: string;
  sidebarDateRangeLabel: string;
  sidebarPriorityLabel: string;
  sidebarArchiveLabel: string;
  sidebarPriorityAll: string;
  sidebarPriorityUrgent: string;
  sidebarPriorityHigh: string;
  sidebarPriorityMedium: string;
  sidebarPriorityLow: string;
  sidebarPriorityNone: string;
  sidebarArchiveAll: string;
  sidebarArchiveActive: string;
  sidebarArchiveArchived: string;
  sidebarTodayButton: string;
  sidebarWeekButton: string;
  sidebarMonthButton: string;
  sidebarResetButton: string;
  sidebarLoading: string;
  sidebarLoadingTasks: string;
  sidebarNoTasksFound: string;
  sidebarEmptyTask: string;
  sidebarArchivedBadge: string;
  sidebarFolderSelectPlaceholder: string;
  sidebarStatusTasks: (count: number) => string;
  sidebarStatusLoadingSuffix: string;
  sidebarStatusWholeVault: string;
  sidebarStatusCurrentFile: string;
  sidebarStatusInPath: (path: string) => string;
  sidebarStatusArchived: string;
  sidebarStatusNotArchived: string;
  sidebarStatusDateRange: (startDate: string, endDate: string) => string;
  sidebarStatusPriority: (priority: string) => string;
  sidebarMenuSetPriority: (priority: string) => string;
  sidebarMenuAddComment: string;
  sidebarTaskMissingNotice: string;
  sidebarCommentModalTitle: string;
  sidebarCommentFieldName: string;
  sidebarCommentFieldPlaceholder: string;
  sidebarCommentCancelButton: string;
  sidebarCommentSubmitButton: string;
  sidebarCommentEmptyNotice: string;
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
    hideMetadataTokensDesc: "默认关闭。开启后，在阅读模式中隐藏 @start、@done、@priority、@from、@archived 等行内标签；编辑器中保留可编辑标签以便正常打标签。",
    archiveDontAskAgainLabel: "以后不再提示",
    immediateArchiveName: "立刻归档",
    immediateArchiveDesc:
      "默认关闭。开启后勾选任务会立刻归档并从原文档移除；关闭后只追加 @done 日期并保留在原文档。",
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
    sidebarTitle: "任务",
    sidebarFiltersSummary: "筛选器",
    sidebarFilePathLabel: "文件路径",
    sidebarFilePathPlaceholder: "当前文件、文件夹，或留空表示整个库",
    sidebarCurrentFileButton: "当前文件",
    sidebarWholeVaultButton: "整个仓库",
    sidebarArchiveButton: "归档",
    sidebarDateRangeLabel: "日期范围",
    sidebarPriorityLabel: "优先级",
    sidebarArchiveLabel: "归档状态",
    sidebarPriorityAll: "全部优先级",
    sidebarPriorityUrgent: "紧急",
    sidebarPriorityHigh: "高",
    sidebarPriorityMedium: "中",
    sidebarPriorityLow: "低",
    sidebarPriorityNone: "无优先级",
    sidebarArchiveAll: "全部任务",
    sidebarArchiveActive: "未归档",
    sidebarArchiveArchived: "已归档",
    sidebarTodayButton: "今天",
    sidebarWeekButton: "7 天",
    sidebarMonthButton: "30 天",
    sidebarResetButton: "重置",
    sidebarLoading: "加载中…",
    sidebarLoadingTasks: "正在加载任务…",
    sidebarNoTasksFound: "没有找到任务。",
    sidebarEmptyTask: "（空任务）",
    sidebarArchivedBadge: "已归档",
    sidebarFolderSelectPlaceholder: "选择文件夹…",
    sidebarStatusTasks: (count) => `${count} 个任务`,
    sidebarStatusLoadingSuffix: " · 加载中…",
    sidebarStatusWholeVault: " 在整个仓库中",
    sidebarStatusCurrentFile: " 在当前文件中",
    sidebarStatusInPath: (path) => ` 在 ${path} 中`,
    sidebarStatusArchived: " 已归档",
    sidebarStatusNotArchived: " 未归档",
    sidebarStatusDateRange: (startDate, endDate) => ` 从 ${startDate || "…"} 到 ${endDate || "…"}`,
    sidebarStatusPriority: (priority) => ` 优先级：${priority}`,
    sidebarMenuSetPriority: (priority) => `设置优先级：${priority}`,
    sidebarMenuAddComment: "添加评论",
    sidebarTaskMissingNotice: "Task Manager 找不到所选任务所在的行。",
    sidebarCommentModalTitle: "添加任务评论",
    sidebarCommentFieldName: "评论",
    sidebarCommentFieldPlaceholder: "添加一条简短评论",
    sidebarCommentCancelButton: "取消",
    sidebarCommentSubmitButton: "添加评论",
    sidebarCommentEmptyNotice: "评论不能为空。",
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
    hideMetadataTokensDesc: "Disabled by default. When enabled, hides inline @start, @done, @priority, @from, @archived tokens in reading mode while keeping editor tokens editable for tagging.",
    archiveDontAskAgainLabel: "Don't ask again",
    immediateArchiveName: "Immediate archive",
    immediateArchiveDesc:
      "Disabled by default. When enabled, completed tasks are archived and removed from the source note immediately. When disabled, only the @done date is added.",
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
    sidebarTitle: "Tasks",
    sidebarFiltersSummary: "Filters",
    sidebarFilePathLabel: "File path",
    sidebarFilePathPlaceholder: "Current file, folder, or blank for vault",
    sidebarCurrentFileButton: "Current file",
    sidebarWholeVaultButton: "Whole vault",
    sidebarArchiveButton: "Archive",
    sidebarDateRangeLabel: "Date range",
    sidebarPriorityLabel: "Priority",
    sidebarArchiveLabel: "Archive",
    sidebarPriorityAll: "All priorities",
    sidebarPriorityUrgent: "Urgent",
    sidebarPriorityHigh: "High",
    sidebarPriorityMedium: "Medium",
    sidebarPriorityLow: "Low",
    sidebarPriorityNone: "No priority",
    sidebarArchiveAll: "All tasks",
    sidebarArchiveActive: "Not archived",
    sidebarArchiveArchived: "Archived",
    sidebarTodayButton: "Today",
    sidebarWeekButton: "7 days",
    sidebarMonthButton: "30 days",
    sidebarResetButton: "Reset",
    sidebarLoading: "Loading…",
    sidebarLoadingTasks: "Loading tasks…",
    sidebarNoTasksFound: "No tasks found.",
    sidebarEmptyTask: "(empty task)",
    sidebarArchivedBadge: "archived",
    sidebarFolderSelectPlaceholder: "Select folder…",
    sidebarStatusTasks: (count) => `${count} task(s)`,
    sidebarStatusLoadingSuffix: " · loading…",
    sidebarStatusWholeVault: " in whole vault",
    sidebarStatusCurrentFile: " in current file",
    sidebarStatusInPath: (path) => ` in ${path}`,
    sidebarStatusArchived: " archived",
    sidebarStatusNotArchived: " not archived",
    sidebarStatusDateRange: (startDate, endDate) => ` from ${startDate || "…"} to ${endDate || "…"}`,
    sidebarStatusPriority: (priority) => ` with ${priority} priority`,
    sidebarMenuSetPriority: (priority) => `Set priority: ${priority}`,
    sidebarMenuAddComment: "Add comment",
    sidebarTaskMissingNotice: "Task Manager could not find the selected task line.",
    sidebarCommentModalTitle: "Add task comment",
    sidebarCommentFieldName: "Comment",
    sidebarCommentFieldPlaceholder: "Add a short comment",
    sidebarCommentCancelButton: "Cancel",
    sidebarCommentSubmitButton: "Add comment",
    sidebarCommentEmptyNotice: "Comment cannot be empty.",
  },
};

export function resolveLocale(
  languageMode: TaskManagerLanguageMode,
): TaskManagerLocale {
  if (languageMode === "zh" || languageMode === "en") {
    return languageMode;
  }

  try {
    const language =
      window.localStorage.getItem("language")
      ?? activeDocument.documentElement.lang
      ?? window.navigator.language
      ?? "en";

    return language.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function getSettingsCopy(
  settings: Pick<TaskManagerSettings, "languageMode">,
): SettingsCopy {
  return COPY[resolveLocale(settings.languageMode)];
}
