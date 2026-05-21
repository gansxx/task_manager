import { App, Editor, EventRef, MarkdownView, Notice, TFile } from "obsidian";
import { getSettingsCopy } from "../i18n";
import { TaskEventPipeline } from "../pipeline";
import type { TaskManagerSettings } from "../types";
import { getCurrentDateStamp, getCurrentTimestamp } from "../utils/date";
import { isFileInsideFolder, isMarkdownFile } from "../utils/path";
import type { ArchiveWriteResult, TaskArchiveService } from "./archive-service";
import {
  appendDoneToken,
  createStartLine,
  getCheckboxCursorOffset,
  isEmptyUncheckedTask,
  isTaskArchivable,
  parseTaskLine,
  removeDoneToken,
  wasTaskCompleted,
  wasTaskReopened,
} from "./task-line";

export class TaskMonitorService {
  private readonly snapshots = new Map<string, string[]>();
  private readonly suppressedPaths = new Map<string, number>();
  private readonly eventRefs: EventRef[] = [];

  constructor(
    private readonly app: App,
    private readonly getSettings: () => TaskManagerSettings,
    private readonly pipeline: TaskEventPipeline,
    private readonly archiveService: TaskArchiveService,
  ) {}

  start(): void {
    this.eventRefs.push(
      this.app.workspace.on("editor-change", (editor, info) => {
        void this.handleEditorChange(editor, info as MarkdownView | null);
      }),
    );

    this.eventRefs.push(
      this.app.workspace.on("file-open", (file) => {
        void this.seedSnapshot(file);
      }),
    );

    void this.seedSnapshot(this.app.workspace.getActiveFile());
  }

  stop(): void {
    for (const eventRef of this.eventRefs) {
      this.app.workspace.offref(eventRef);
    }
    this.eventRefs.length = 0;

    this.snapshots.clear();
    this.suppressedPaths.clear();
  }

  async archiveTasksInActiveFile(): Promise<ArchiveBatchResult> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = activeView?.file;
    const editor = activeView?.editor;
    if (!file || !editor || !isMarkdownFile(file)) {
      return { count: 0, archivePaths: [] };
    }

    return this.archiveTasksFromEditor(file, editor);
  }

  async archiveTaskAtCursor(
    file: TFile,
    editor: Editor,
  ): Promise<ArchiveLineResult | null> {
    const lineNumber = editor.getCursor().line;
    const lineText = editor.getLine(lineNumber);
    if (!isTaskArchivable(lineText)) {
      return null;
    }

    const archived = await this.archiveTaskLine(file, editor, lineNumber, lineText);
    if (archived) {
      this.updateSnapshotFromEditor(file, editor);
    }

    return archived;
  }

  registerDefaultHandlers(): void {
    this.pipeline.on("taskCreated", (event) => {
      const startToken = this.formatToken(
        this.getSettings().startTokenFormat,
        event.date,
      );
      const nextLine = createStartLine(event.currentLine, startToken);
      if (nextLine === event.currentLine) {
        return;
      }

      const cursorOffset = getCheckboxCursorOffset(nextLine);
      this.runWithSuppressedFile(event.file.path, () => {
        event.editor.setLine(event.lineNumber, nextLine);
        event.editor.setCursor({
          line: event.lineNumber,
          ch: cursorOffset,
        });
      });

      this.updateSnapshotFromEditor(event.file, event.editor);
    });

    this.pipeline.on("taskReopened", (event) => {
      const reopenedLine = removeDoneToken(event.currentLine);
      if (reopenedLine === event.currentLine) {
        return;
      }

      this.runWithSuppressedFile(event.file.path, () => {
        event.editor.setLine(event.lineNumber, reopenedLine);
      });

      this.updateSnapshotFromEditor(event.file, event.editor);
    });

    this.pipeline.on("taskCompleted", async (event) => {
      const doneToken = this.formatToken(
        this.getSettings().doneTokenFormat,
        event.date,
      );
      const archivedLine = appendDoneToken(event.currentLine, doneToken);

      if (!this.getSettings().immediateArchiveEnabled) {
        if (archivedLine !== event.currentLine) {
          this.runWithSuppressedFile(event.file.path, () => {
            event.editor.setLine(event.lineNumber, archivedLine);
          });
        }

        this.updateSnapshotFromEditor(event.file, event.editor);
        return;
      }

      await this.archiveService.archiveCompletedTask(
        event.file,
        archivedLine.trim(),
        event.date,
      );

      this.runWithSuppressedFile(event.file.path, () => {
        if (archivedLine !== event.currentLine) {
          event.editor.setLine(event.lineNumber, archivedLine);
        }
        this.removeLine(event.editor, event.lineNumber, archivedLine);
      });

      this.updateSnapshotFromEditor(event.file, event.editor);
    });
  }

  private async handleEditorChange(
    editor: Editor,
    info: MarkdownView | null,
  ): Promise<void> {
    const file = info?.file;
    if (!file || !isMarkdownFile(file)) {
      return;
    }

    if (!this.isMonitoredFile(file)) {
      this.updateSnapshotFromEditor(file, editor);
      return;
    }

    if (this.isSuppressed(file.path)) {
      this.updateSnapshotFromEditor(file, editor);
      return;
    }

    const currentLines = this.getEditorLines(editor);
    const previousLines = this.snapshots.get(file.path) ?? currentLines;
    const changedLineNumbers = this.getChangedLineNumbers(previousLines, currentLines);
    const date = getCurrentTimestamp(this.getSettings().timestampPrecision);

    for (const lineNumber of changedLineNumbers) {
      const currentLine = currentLines[lineNumber] ?? "";
      const previousLine = previousLines[lineNumber] ?? "";
      if (!isEmptyUncheckedTask(currentLine)) {
        continue;
      }

      const parsedTask = parseTaskLine(currentLine);
      if (!parsedTask) {
        continue;
      }

      await this.pipeline.emit({
        type: "taskCreated",
        file,
        editor,
        lineNumber,
        previousLine,
        currentLine,
        parsedTask,
        date,
      });
    }

    for (const lineNumber of changedLineNumbers) {
      const currentLine = currentLines[lineNumber] ?? "";
      const previousLine = previousLines[lineNumber] ?? "";
      if (!wasTaskReopened(previousLine, currentLine)) {
        continue;
      }

      const parsedTask = parseTaskLine(currentLine);
      if (!parsedTask) {
        continue;
      }

      await this.pipeline.emit({
        type: "taskReopened",
        file,
        editor,
        lineNumber,
        previousLine,
        currentLine,
        parsedTask,
        date,
      });
    }

    for (const lineNumber of [...changedLineNumbers].reverse()) {
      const currentLine = currentLines[lineNumber] ?? "";
      const previousLine = previousLines[lineNumber] ?? "";
      if (!wasTaskCompleted(previousLine, currentLine)) {
        continue;
      }

      const parsedTask = parseTaskLine(currentLine);
      if (!parsedTask) {
        continue;
      }

      try {
        await this.pipeline.emit({
          type: "taskCompleted",
          file,
          editor,
          lineNumber,
          previousLine,
          currentLine,
          parsedTask,
          date,
        });
      } catch (error) {
        console.error("Task Manager: failed to archive completed task", error);
        new Notice(getSettingsCopy(this.getSettings()).archiveFailureNotice);
      }
    }

    this.updateSnapshotFromEditor(file, editor);
  }

  private isMonitoredFile(file: TFile): boolean {
    const watchedFolder = this.getSettings().watchedFolder;
    if (!watchedFolder.trim()) {
      return this.app.workspace.getActiveFile()?.path === file.path;
    }

    return isFileInsideFolder(file, watchedFolder);
  }

  private formatToken(template: string, date: string): string {
    return (template.trim() || "@token({date})").replace("{date}", date);
  }

  private getEditorLines(editor: Editor): string[] {
    return editor.getValue().split("\n");
  }

  private getChangedLineNumbers(
    previousLines: string[],
    currentLines: string[],
  ): number[] {
    const lineCount = Math.max(previousLines.length, currentLines.length);
    const changedLineNumbers: number[] = [];

    for (let lineNumber = 0; lineNumber < lineCount; lineNumber += 1) {
      if ((previousLines[lineNumber] ?? "") !== (currentLines[lineNumber] ?? "")) {
        changedLineNumbers.push(lineNumber);
      }
    }

    return changedLineNumbers;
  }

  private async seedSnapshot(file: TFile | null): Promise<void> {
    if (!file || !isMarkdownFile(file)) {
      return;
    }

    const content = await this.app.vault.cachedRead(file);
    this.snapshots.set(file.path, content.split("\n"));
  }

  private updateSnapshotFromEditor(file: TFile, editor: Editor): void {
    this.snapshots.set(file.path, this.getEditorLines(editor));
  }

  private isSuppressed(path: string): boolean {
    return (this.suppressedPaths.get(path) ?? 0) > 0;
  }

  private runWithSuppressedFile(path: string, callback: () => void): void {
    const current = this.suppressedPaths.get(path) ?? 0;
    this.suppressedPaths.set(path, current + 1);

    try {
      callback();
    } finally {
      const next = (this.suppressedPaths.get(path) ?? 1) - 1;
      if (next <= 0) {
        this.suppressedPaths.delete(path);
      } else {
        this.suppressedPaths.set(path, next);
      }
    }
  }

  private removeLine(editor: Editor, lineNumber: number, lineText: string): void {
    const lastLine = editor.lastLine();
    if (lastLine === 0) {
      editor.replaceRange("", { line: 0, ch: 0 }, { line: 0, ch: lineText.length });
      return;
    }

    if (lineNumber < lastLine) {
      editor.replaceRange("", { line: lineNumber, ch: 0 }, { line: lineNumber + 1, ch: 0 });
      return;
    }

    const previousLineLength = editor.getLine(lineNumber - 1).length;
    editor.replaceRange(
      "",
      { line: lineNumber - 1, ch: previousLineLength },
      { line: lineNumber, ch: lineText.length },
    );
  }

  private async archiveTasksFromEditor(
    file: TFile,
    editor: Editor,
  ): Promise<ArchiveBatchResult> {
    const lines = this.getEditorLines(editor);
    const taskEntries = lines
      .map((lineText, lineNumber) => ({ lineText, lineNumber }))
      .filter(({ lineText }) => isTaskArchivable(lineText));

    if (taskEntries.length === 0) {
      return { count: 0, archivePaths: [] };
    }

    let archivedCount = 0;
    const archivePaths = new Set<string>();
    for (const { lineNumber, lineText } of taskEntries.reverse()) {
      const archived = await this.archiveTaskLine(file, editor, lineNumber, lineText);
      if (archived) {
        archivedCount += 1;
        if (archived.archivePath) {
          archivePaths.add(archived.archivePath);
        }
      }
    }

    this.updateSnapshotFromEditor(file, editor);
    return { count: archivedCount, archivePaths: [...archivePaths] };
  }

  private async archiveTaskLine(
    file: TFile,
    editor: Editor,
    lineNumber: number,
    lineText: string,
  ): Promise<ArchiveLineResult | null> {
    if (!isTaskArchivable(lineText)) {
      return null;
    }

    const result = await this.archiveService.archiveTaskLine(
      file,
      lineText.trim(),
      getCurrentDateStamp(),
    );

    this.runWithSuppressedFile(file.path, () => {
      this.removeLine(editor, lineNumber, lineText);
    });

    return result;
  }
}

type ArchiveLineResult = ArchiveWriteResult;

export interface ArchiveBatchResult {
  count: number;
  archivePaths: string[];
}
