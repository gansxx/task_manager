import type { Editor, TFile } from "obsidian";
import type { TimestampPrecision } from "./utils/date";

export type TaskManagerLanguageMode = "auto" | "zh" | "en";
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface TaskManagerSettings {
  watchedFolder: string;
  archiveRootFolder: string;
  startTokenFormat: string;
  doneTokenFormat: string;
  timestampPrecision: TimestampPrecision;
  hideMetadataTokens: boolean;
  skipArchiveConfirmation: boolean;
  immediateArchiveEnabled: boolean;
  languageMode: TaskManagerLanguageMode;
}

export interface ParsedTaskLine {
  indent: string;
  checked: boolean;
  body: string;
  startToken?: string;
  doneToken?: string;
  priority: TaskPriority;
}

export type TaskLifecycleEventType = "taskCreated" | "taskCompleted" | "taskReopened";

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
