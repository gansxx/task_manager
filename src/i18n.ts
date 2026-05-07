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
  immediateArchiveName: string;
  immediateArchiveDesc: string;
  githubName: string;
  githubDesc: string;
  githubButtonLabel: string;
  archiveFailureNotice: string;
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
    immediateArchiveName: "立刻归档",
    immediateArchiveDesc:
      "默认关闭。开启后勾选任务会立刻归档并从原文档移除；关闭后只追加 @done 日期并保留在原文档。",
    githubName: "GitHub",
    githubDesc: GITHUB_REPO_URL,
    githubButtonLabel: "打开仓库",
    archiveFailureNotice: "Task Manager 归档已完成任务时失败。",
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
    immediateArchiveName: "Immediate archive",
    immediateArchiveDesc:
      "Disabled by default. When enabled, completed tasks are archived and removed from the source note immediately. When disabled, only the @done date is added.",
    githubName: "GitHub",
    githubDesc: GITHUB_REPO_URL,
    githubButtonLabel: "Open repository",
    archiveFailureNotice: "Task Manager could not archive the completed task.",
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
