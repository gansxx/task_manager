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
  skipArchiveConfirmationName: string;
  skipArchiveConfirmationDesc: string;
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
    skipArchiveConfirmationName: "跳过归档确认",
    skipArchiveConfirmationDesc: "开启后，手动归档任务时不再显示确认框。也可以在归档确认框中勾选以后不再提示。",
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
    skipArchiveConfirmationName: "Skip archive confirmation",
    skipArchiveConfirmationDesc: "Do not show confirmation dialogs before manual archive actions. You can also enable this from the confirmation dialog.",
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
