import type { Editor, TFile } from "obsidian";

export type TaskManagerLanguageMode = "auto" | "zh" | "en";

export interface TaskManagerSettings {
  watchedFolder: string;
  archiveRootFolder: string;
  startTokenFormat: string;
  doneTokenFormat: string;
  immediateArchiveEnabled: boolean;
  languageMode: TaskManagerLanguageMode;
}

export interface ParsedTaskLine {
  indent: string;
  checked: boolean;
  body: string;
  startToken?: string;
  doneToken?: string;
}

export type TaskLifecycleEventType = "taskCreated" | "taskCompleted";

export interface TaskLifecycleEvent {
  type: TaskLifecycleEventType;
  file: TFile;
  editor: Editor;
  lineNumber: number;
  previousLine: string;
  currentLine: string;
  parsedTask: ParsedTaskLine;
  date: string;
}
