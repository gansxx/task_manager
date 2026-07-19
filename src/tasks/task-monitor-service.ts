import { App, Editor, EventRef, MarkdownView, Notice, TFile } from "obsidian";
import { getSettingsCopy } from "../i18n";
import { TaskEventPipeline } from "../pipeline";
import type { TaskManagerSettings, TaskPriority } from "../types";
import { getCurrentTimestamp } from "../utils/date";
import { isFileInsideFolder, isMarkdownFile } from "../utils/path";
import { TaskCompletionStore } from "./task-completion-store";
import {
  appendDoneToken,
  appendTaskCommentWithTimestamp,
  createStartLine,
  getCheckboxCursorOffset,
  isEmptyUncheckedTask,
  parseTaskLine,
  removeDoneToken,
  setTaskChecked,
  setTaskPriority,
  wasTaskCompleted,
  wasTaskReopened,
} from "./task-line";

export interface TaskRefreshResult {
  scannedFiles: number;
  updatedFiles: number;
}

export class TaskMonitorService {
  private readonly snapshots = new Map<string, string[]>();
  private readonly suppressedPaths = new Map<string, number>();
  private readonly eventRefs: EventRef[] = [];

  constructor(
    private readonly app: App,
    private readonly getSettings: () => TaskManagerSettings,
    private readonly pipeline: TaskEventPipeline,
    private readonly completionStore: TaskCompletionStore,
  ) {}

  start(): void {
    this.eventRefs.push(this.app.workspace.on("editor-change", (editor, info) => {
      void this.handleEditorChange(editor, info as MarkdownView | null);
    }));
    this.eventRefs.push(this.app.workspace.on("file-open", (file) => void this.seedSnapshot(file)));
    void this.seedSnapshot(this.app.workspace.getActiveFile());
    void this.refreshTasks();
  }

  stop(): void {
    this.eventRefs.forEach((eventRef) => this.app.workspace.offref(eventRef));
    this.eventRefs.length = 0;
    this.snapshots.clear();
    this.suppressedPaths.clear();
  }

  async preloadVaultSnapshots(): Promise<void> {
    await Promise.all(this.app.vault.getMarkdownFiles().map((file) => this.seedSnapshot(file)));
  }

  async refreshTasks(): Promise<TaskRefreshResult> {
    const files = this.app.vault.getMarkdownFiles().filter((file) => this.isRefreshTargetFile(file));
    let updatedFiles = 0;
    for (const file of files) {
      if (await this.refreshFile(file)) updatedFiles += 1;
    }
    return { scannedFiles: files.length, updatedFiles };
  }

  async updateTaskPriority(file: TFile, lineNumber: number, priority: TaskPriority): Promise<boolean> {
    return this.updateTaskLineContent(file, lineNumber, (line) => setTaskPriority(line, priority));
  }

  async addTaskComment(file: TFile, lineNumber: number, comment: string): Promise<boolean> {
    return this.updateTaskLineContent(file, lineNumber, (line) => appendTaskCommentWithTimestamp(
      line, comment, getCurrentTimestamp(this.getSettings().timestampPrecision),
    ));
  }

  async setTaskCompletion(file: TFile, lineNumber: number, checked: boolean): Promise<boolean> {
    const lines = (await this.app.vault.cachedRead(file)).split("\n");
    const currentLine = lines[lineNumber];
    const parsed = currentLine === undefined ? null : parseTaskLine(currentLine);
    if (!parsed) return false;
    const updatedLine = checked
      ? setTaskChecked(currentLine, true, this.formatToken(this.getSettings().doneTokenFormat, getCurrentTimestamp(this.getSettings().timestampPrecision)))
      : setTaskChecked(currentLine, false);
    if (updatedLine === currentLine) return false;
    if (checked) {
      const completed = parseTaskLine(updatedLine);
      if (completed) await this.completionStore.recordCompletion(file.path, lineNumber, updatedLine, completed);
    } else {
      await this.completionStore.markReopened(file.path, lineNumber, currentLine);
    }
    lines[lineNumber] = updatedLine;
    await this.app.vault.modify(file, lines.join("\n"));
    this.snapshots.set(file.path, lines);
    return true;
  }

  registerDefaultHandlers(): void {
    this.pipeline.on("taskCreated", (event) => {
      const nextLine = createStartLine(event.currentLine, this.formatToken(this.getSettings().startTokenFormat, event.date));
      if (nextLine === event.currentLine) return;
      this.runWithSuppressedFile(event.file.path, () => {
        event.editor.setLine(event.lineNumber, nextLine);
        event.editor.setCursor({ line: event.lineNumber, ch: getCheckboxCursorOffset(nextLine) });
      });
      this.updateSnapshotFromEditor(event.file, event.editor);
    });

    this.pipeline.on("taskReopened", async (event) => {
      await this.completionStore.markReopened(event.file.path, event.lineNumber, event.currentLine);
      const reopenedLine = removeDoneToken(event.currentLine);
      if (reopenedLine !== event.currentLine) {
        this.runWithSuppressedFile(event.file.path, () => event.editor.setLine(event.lineNumber, reopenedLine));
      }
      this.updateSnapshotFromEditor(event.file, event.editor);
    });

    this.pipeline.on("taskCompleted", async (event) => {
      const completedLine = appendDoneToken(event.currentLine, this.formatToken(this.getSettings().doneTokenFormat, event.date));
      if (completedLine !== event.currentLine) {
        this.runWithSuppressedFile(event.file.path, () => event.editor.setLine(event.lineNumber, completedLine));
      }
      const completed = parseTaskLine(completedLine);
      if (completed) await this.completionStore.recordCompletion(event.file.path, event.lineNumber, completedLine, completed);
      this.updateSnapshotFromEditor(event.file, event.editor);
    });
  }

  private async handleEditorChange(editor: Editor, info: MarkdownView | null): Promise<void> {
    const file = info?.file;
    if (!file || !isMarkdownFile(file)) return;
    if (!this.isMonitoredFile(file) || this.isSuppressed(file.path)) {
      this.updateSnapshotFromEditor(file, editor);
      return;
    }
    const currentLines = this.getEditorLines(editor);
    const previousLines = this.snapshots.get(file.path) ?? currentLines;
    const changed = this.getChangedLineNumbers(previousLines, currentLines);
    const date = getCurrentTimestamp(this.getSettings().timestampPrecision);
    for (const lineNumber of changed) {
      const currentLine = currentLines[lineNumber] ?? "";
      const parsed = parseTaskLine(currentLine);
      if (isEmptyUncheckedTask(currentLine) && parsed) {
        await this.pipeline.emit({ type: "taskCreated", file, editor, lineNumber, previousLine: previousLines[lineNumber] ?? "", currentLine, parsedTask: parsed, date });
      }
    }
    for (const lineNumber of changed) {
      const currentLine = currentLines[lineNumber] ?? "";
      const previousLine = previousLines[lineNumber] ?? "";
      const parsed = parseTaskLine(currentLine);
      if (wasTaskReopened(previousLine, currentLine) && parsed) {
        await this.pipeline.emit({ type: "taskReopened", file, editor, lineNumber, previousLine, currentLine, parsedTask: parsed, date });
      }
    }
    for (const lineNumber of [...changed].reverse()) {
      const currentLine = currentLines[lineNumber] ?? "";
      const previousLine = previousLines[lineNumber] ?? "";
      const parsed = parseTaskLine(currentLine);
      if (!wasTaskCompleted(previousLine, currentLine) || !parsed) continue;
      try {
        await this.pipeline.emit({ type: "taskCompleted", file, editor, lineNumber, previousLine, currentLine, parsedTask: parsed, date });
      } catch (error) {
        console.error("Task Manager: failed to store completed task", error);
        const detail = error instanceof Error ? `: ${error.message}` : "";
        new Notice(`${getSettingsCopy(this.getSettings()).completionStorageFailureNotice}${detail}`, 10000);
      }
    }
    this.updateSnapshotFromEditor(file, editor);
  }

  private async refreshFile(file: TFile): Promise<boolean> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.file?.path === file.path ? activeView.editor : null;
    const lines = editor ? this.getEditorLines(editor) : (await this.app.vault.cachedRead(file)).split("\n");
    const date = getCurrentTimestamp(this.getSettings().timestampPrecision);
    let updated = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (isEmptyUncheckedTask(line)) {
        const next = createStartLine(line, this.formatToken(this.getSettings().startTokenFormat, date));
        if (next !== line) { lines[index] = next; updated = true; }
      } else {
        const parsed = parseTaskLine(line);
        if (parsed?.checked && !parsed.doneToken) {
          lines[index] = appendDoneToken(line, this.formatToken(this.getSettings().doneTokenFormat, date));
          updated = true;
        } else if (parsed && !parsed.checked && parsed.doneToken) {
          lines[index] = removeDoneToken(line);
          updated = true;
        }
      }
    }
    if (updated) {
      if (editor) this.runWithSuppressedFile(file.path, () => editor.setValue(lines.join("\n")));
      else await this.app.vault.modify(file, lines.join("\n"));
    }
    this.snapshots.set(file.path, lines);
    return updated;
  }

  private isMonitoredFile(file: TFile): boolean {
    const watchedFolder = this.getSettings().watchedFolder.trim();
    return watchedFolder ? isFileInsideFolder(file, watchedFolder) : this.app.workspace.getActiveFile()?.path === file.path;
  }

  private isRefreshTargetFile(file: TFile): boolean {
    return isMarkdownFile(file) && this.isMonitoredFile(file);
  }

  private formatToken(template: string, date: string): string {
    return (template.trim() || "@token({date})").replace("{date}", date);
  }

  private async updateTaskLineContent(file: TFile, lineNumber: number, updater: (line: string) => string): Promise<boolean> {
    const lines = (await this.app.vault.cachedRead(file)).split("\n");
    const line = lines[lineNumber];
    if (line === undefined || !parseTaskLine(line)) return false;
    const updated = updater(line);
    if (updated === line) return false;
    lines[lineNumber] = updated;
    await this.app.vault.modify(file, lines.join("\n"));
    this.snapshots.set(file.path, lines);
    return true;
  }

  private async seedSnapshot(file: TFile | null): Promise<void> {
    if (file && isMarkdownFile(file)) this.snapshots.set(file.path, (await this.app.vault.cachedRead(file)).split("\n"));
  }

  private getEditorLines(editor: Editor): string[] { return editor.getValue().split("\n"); }
  private getChangedLineNumbers(before: string[], after: string[]): number[] {
    return Array.from({ length: Math.max(before.length, after.length) }, (_, index) => index)
      .filter((index) => (before[index] ?? "") !== (after[index] ?? ""));
  }
  private updateSnapshotFromEditor(file: TFile, editor: Editor): void { this.snapshots.set(file.path, this.getEditorLines(editor)); }
  private isSuppressed(path: string): boolean { return (this.suppressedPaths.get(path) ?? 0) > 0; }
  private runWithSuppressedFile(path: string, callback: () => void): void {
    this.suppressedPaths.set(path, (this.suppressedPaths.get(path) ?? 0) + 1);
    try { callback(); } finally {
      const next = (this.suppressedPaths.get(path) ?? 1) - 1;
      if (next) this.suppressedPaths.set(path, next); else this.suppressedPaths.delete(path);
    }
  }
}
