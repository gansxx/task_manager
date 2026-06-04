import { App, Editor, EventRef, MarkdownView, TFile } from "obsidian";
import { TaskEventPipeline } from "../pipeline";
import type { TaskManagerSettings, TaskPriority } from "../types";
import { getCurrentDateStamp, getCurrentTimestamp } from "../utils/date";
import { isFileInsideFolder, isMarkdownFile } from "../utils/path";
import type { ArchiveWriteResult, TaskArchiveService } from "./archive-service";
import {
  appendDoneToken,
  appendTaskCommentWithTimestamp,
  createStartLine,
  getIndentLevel,
  getCheckboxCursorOffset,
  getTaskArchiveBlock,
  isEmptyUncheckedTask,
  isTaskArchivable,
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
  archivedTasks: number;
}

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
      this.app.workspace.on("file-open", (file) => {
        void this.seedSnapshot(file);
      }),
    );

    void this.seedSnapshot(this.app.workspace.getActiveFile());
    void this.refreshTasks();
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

  async preloadVaultSnapshots(): Promise<void> {
    await this.seedSnapshotsForVault();
  }

  async refreshTasks(): Promise<TaskRefreshResult> {
    const files = this.getRefreshTargetFiles();
    const result: TaskRefreshResult = {
      scannedFiles: files.length,
      updatedFiles: 0,
      archivedTasks: 0,
    };

    for (const file of files) {
      const fileResult = await this.refreshFile(file);
      if (fileResult.updated) {
        result.updatedFiles += 1;
      }
      result.archivedTasks += fileResult.archivedTasks;
    }

    return result;
  }

  async updateTaskPriority(file: TFile, lineNumber: number, priority: TaskPriority): Promise<boolean> {
    return this.updateTaskLineContent(file, lineNumber, (line) => setTaskPriority(line, priority));
  }

  async addTaskComment(file: TFile, lineNumber: number, comment: string): Promise<boolean> {
    return this.updateTaskLineContent(file, lineNumber, (line) =>
      appendTaskCommentWithTimestamp(
        line,
        comment,
        getCurrentTimestamp(this.getSettings().timestampPrecision),
      ));
  }

  async setTaskCompletion(file: TFile, lineNumber: number, checked: boolean): Promise<boolean> {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    const currentLine = lines[lineNumber];
    if (currentLine === undefined || !parseTaskLine(currentLine)) {
      return false;
    }

    const updatedLine = checked
      ? setTaskChecked(
          currentLine,
          true,
          this.formatToken(
            this.getSettings().doneTokenFormat,
            getCurrentTimestamp(this.getSettings().timestampPrecision),
          ),
        )
      : setTaskChecked(currentLine, false);

    if (!checked || !this.getSettings().immediateArchiveEnabled) {
      if (updatedLine === currentLine) {
        return false;
      }

      lines[lineNumber] = updatedLine;
      await this.app.vault.modify(file, lines.join("\n"));
      this.snapshots.set(file.path, lines);
      return true;
    }

    lines[lineNumber] = updatedLine;
    const archiveBlock = getTaskArchiveBlock(lines, lineNumber);
    if (!archiveBlock) {
      return false;
    }

    await this.archiveService.archiveCompletedTask(
      file,
      archiveBlock.text,
      getCurrentTimestamp(this.getSettings().timestampPrecision),
    );

    lines.splice(lineNumber, archiveBlock.lineCount);
    await this.app.vault.modify(file, lines.join("\n"));
    this.snapshots.set(file.path, lines);
    return true;
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

      this.runWithSuppressedFile(event.file.path, () => {
        if (archivedLine !== event.currentLine) {
          event.editor.setLine(event.lineNumber, archivedLine);
        }
      });

      const archiveBlock = getTaskArchiveBlock(this.getEditorLines(event.editor), event.lineNumber);
      if (!archiveBlock) {
        return;
      }

      await this.archiveService.archiveCompletedTask(
        event.file,
        archiveBlock.text,
        event.date,
      );

      this.runWithSuppressedFile(event.file.path, () => {
        this.removeLines(event.editor, event.lineNumber, archiveBlock.lineCount);
      });

      this.updateSnapshotFromEditor(event.file, event.editor);
    });
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

  private async seedSnapshot(file: TFile | null): Promise<void> {
    if (!file || !isMarkdownFile(file)) {
      return;
    }

    const content = await this.app.vault.cachedRead(file);
    this.snapshots.set(file.path, content.split("\n"));
  }

  private async seedSnapshotsForVault(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    await Promise.all(
      files.map(async (file) => {
        const content = await this.app.vault.cachedRead(file);
        this.snapshots.set(file.path, content.split("\n"));
      }),
    );
  }

  private getRefreshTargetFiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.isRefreshTargetFile(file));
  }

  private isRefreshTargetFile(file: TFile): boolean {
    if (!isMarkdownFile(file) || this.isArchiveFile(file)) {
      return false;
    }

    const watchedFolder = this.getSettings().watchedFolder.trim();
    if (watchedFolder) {
      return isFileInsideFolder(file, watchedFolder);
    }

    return this.app.workspace.getActiveFile()?.path === file.path;
  }

  private isArchiveFile(file: TFile): boolean {
    const archiveRoot = this.getSettings().archiveRootFolder.trim();
    return Boolean(archiveRoot && isFileInsideFolder(file, archiveRoot));
  }

  private async refreshFile(file: TFile): Promise<{ updated: boolean; archivedTasks: number }> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file?.path === file.path && activeView.editor) {
      return this.refreshEditorFile(file, activeView.editor);
    }

    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    const result = await this.refreshTaskLines(file, lines);
    if (result.updated) {
      await this.app.vault.modify(file, lines.join("\n"));
    }

    this.snapshots.set(file.path, lines);
    return result;
  }

  private async refreshEditorFile(
    file: TFile,
    editor: Editor,
  ): Promise<{ updated: boolean; archivedTasks: number }> {
    const lines = this.getEditorLines(editor);
    const result = await this.refreshTaskLines(file, lines);
    if (!result.updated) {
      this.snapshots.set(file.path, lines);
      return result;
    }

    this.runWithSuppressedFile(file.path, () => {
      editor.setValue(lines.join("\n"));
    });
    this.snapshots.set(file.path, lines);
    return result;
  }

  private async refreshTaskLines(
    file: TFile,
    lines: string[],
  ): Promise<{ updated: boolean; archivedTasks: number }> {
    const date = getCurrentTimestamp(this.getSettings().timestampPrecision);
    let updated = false;
    let archivedTasks = 0;

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber] ?? "";
      const parsed = parseTaskLine(line);

      if (isEmptyUncheckedTask(line)) {
        const nextLine = createStartLine(
          line,
          this.formatToken(this.getSettings().startTokenFormat, date),
        );
        if (nextLine !== line) {
          lines[lineNumber] = nextLine;
          updated = true;
        }
        continue;
      }

      if (!parsed) {
        continue;
      }

      if (!parsed.checked && parsed.doneToken) {
        const nextLine = removeDoneToken(line);
        if (nextLine !== line) {
          lines[lineNumber] = nextLine;
          updated = true;
        }
        continue;
      }

      if (!parsed.checked) {
        continue;
      }

      if (!parsed.doneToken) {
        const nextLine = appendDoneToken(
          line,
          this.formatToken(this.getSettings().doneTokenFormat, date),
        );
        if (nextLine !== line) {
          lines[lineNumber] = nextLine;
          updated = true;
        }
      }

      if (!this.getSettings().immediateArchiveEnabled) {
        continue;
      }

      const archiveBlock = getTaskArchiveBlock(lines, lineNumber);
      if (!archiveBlock) {
        continue;
      }

      await this.archiveService.archiveCompletedTask(file, archiveBlock.text, date);
      lines.splice(lineNumber, archiveBlock.lineCount);
      lineNumber -= 1;
      archivedTasks += 1;
      updated = true;
    }

    return { updated, archivedTasks };
  }

  private async updateTaskLineContent(
    file: TFile,
    lineNumber: number,
    updater: (line: string) => string,
  ): Promise<boolean> {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    const currentLine = lines[lineNumber];
    if (currentLine === undefined || !parseTaskLine(currentLine)) {
      return false;
    }

    const updatedLine = updater(currentLine);
    if (updatedLine === currentLine) {
      return false;
    }

    lines[lineNumber] = updatedLine;
    await this.app.vault.modify(file, lines.join("\n"));
    this.snapshots.set(file.path, lines);
    return true;
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

  private removeLines(editor: Editor, lineNumber: number, lineCount: number): void {
    for (let offset = lineCount - 1; offset >= 0; offset -= 1) {
      const currentLineNumber = lineNumber + offset;
      this.removeLine(editor, currentLineNumber, editor.getLine(currentLineNumber));
    }
  }

  private async archiveTasksFromEditor(
    file: TFile,
    editor: Editor,
  ): Promise<ArchiveBatchResult> {
    const lines = this.getEditorLines(editor);
    const taskEntries = getStandaloneArchivableLineNumbers(lines)
      .map((lineNumber) => ({ lineText: lines[lineNumber] ?? "", lineNumber }));

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

    const archiveBlock = getTaskArchiveBlock(this.getEditorLines(editor), lineNumber);
    if (!archiveBlock) {
      return null;
    }

    const result = await this.archiveService.archiveTaskLine(
      file,
      archiveBlock.text,
      getCurrentDateStamp(),
    );

    this.runWithSuppressedFile(file.path, () => {
      this.removeLines(editor, lineNumber, archiveBlock.lineCount);
    });

    return result;
  }
}

type ArchiveLineResult = ArchiveWriteResult;

export interface ArchiveBatchResult {
  count: number;
  archivePaths: string[];
}

function getStandaloneArchivableLineNumbers(lines: string[]): number[] {
  const lineNumbers: number[] = [];
  const checkedAncestorIndents: number[] = [];

  lines.forEach((line, lineNumber) => {
    const parsed = parseTaskLine(line);
    if (!parsed) {
      return;
    }

    const indentLevel = getIndentLevel(parsed.indent);
    while (
      checkedAncestorIndents.length > 0 &&
      checkedAncestorIndents[checkedAncestorIndents.length - 1] >= indentLevel
    ) {
      checkedAncestorIndents.pop();
    }

    if (!parsed.checked) {
      return;
    }

    if (checkedAncestorIndents.length === 0) {
      lineNumbers.push(lineNumber);
    }

    checkedAncestorIndents.push(indentLevel);
  });

  return lineNumbers;
}
