import { App, Editor, EventRef, MarkdownView, Notice, TFile } from "obsidian";
import { getSettingsCopy } from "../i18n";
import { TaskEventPipeline } from "../pipeline";
import type { TaskManagerSettings } from "../types";
import { getCurrentDateStamp } from "../utils/date";
import { isFileInsideFolder, isMarkdownFile } from "../utils/path";
import type { TaskArchiveService } from "./archive-service";
import {
  appendDoneToken,
  createStartLine,
  getCheckboxCursorOffset,
  isEmptyUncheckedTask,
  parseTaskLine,
  wasTaskCompleted,
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
        this.removeLine(event.editor, event.lineNumber, event.currentLine);
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
    const cursor = editor.getCursor();
    const lineNumber = cursor.line;
    const currentLine = currentLines[lineNumber] ?? "";
    const previousLine = previousLines[lineNumber] ?? "";
    const date = getCurrentDateStamp();

    if (isEmptyUncheckedTask(currentLine)) {
      const parsedTask = parseTaskLine(currentLine);
      if (parsedTask) {
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
    } else if (wasTaskCompleted(previousLine, currentLine)) {
      const parsedTask = parseTaskLine(currentLine);
      if (parsedTask) {
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
}
