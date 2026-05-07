import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { ConfirmModal } from "./confirm-modal";
import { getSettingsCopy } from "./i18n";
import { registerDateTokenDecorations } from "./date-token-decorations";
import { TaskEventPipeline } from "./pipeline";
import { DEFAULT_SETTINGS, TaskManagerSettingTab } from "./settings";
import { TaskArchiveService } from "./tasks/archive-service";
import { isTaskArchivable } from "./tasks/task-line";
import { TaskMonitorService } from "./tasks/task-monitor-service";
import type { TaskManagerSettings } from "./types";

export default class TaskManagerPlugin extends Plugin {
  settings: TaskManagerSettings = DEFAULT_SETTINGS;

  private pipeline!: TaskEventPipeline;
  private archiveService!: TaskArchiveService;
  private monitorService!: TaskMonitorService;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.pipeline = new TaskEventPipeline();
    this.archiveService = new TaskArchiveService(this.app, () => this.settings);
    this.monitorService = new TaskMonitorService(
      this.app,
      () => this.settings,
      this.pipeline,
      this.archiveService,
    );

    this.monitorService.registerDefaultHandlers();
    this.monitorService.start();
    registerDateTokenDecorations(this);
    this.registerArchiveUi();

    this.addSettingTab(
      new TaskManagerSettingTab(this.app, this, async () => {
        await this.saveSettings();
      }),
    );
  }

  onunload(): void {
    this.monitorService?.stop();
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private registerArchiveUi(): void {
    this.addRibbonIcon("archive", this.copy.archiveCurrentFileRibbonTitle, () => {
      void this.archiveActiveFileTasks();
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, info) => {
        if (!(info instanceof MarkdownView) || !info.file) {
          return;
        }

        if (!isTaskArchivable(editor.getLine(editor.getCursor().line))) {
          return;
        }

        menu.addItem((item) =>
          item
            .setTitle(this.copy.archiveCurrentTaskMenuLabel)
            .setIcon("archive")
            .onClick(() => {
              void this.archiveCurrentTask(info.file, editor);
            }),
        );
      }),
    );
  }

  private async archiveActiveFileTasks(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file || !activeView.editor) {
      new Notice(this.copy.archiveMissingFileNotice);
      return;
    }

    const taskCount = this.countArchivableTasks(activeView.editor);
    if (taskCount === 0) {
      new Notice(this.copy.archiveNoTasksNotice);
      return;
    }

    const confirmed = await this.confirmArchive(
      this.copy.archiveCurrentFileConfirmMessage(taskCount),
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await this.monitorService.archiveTasksInActiveFile();
      if (result.count === 0) {
        new Notice(this.copy.archiveNoTasksNotice);
        return;
      }

      new Notice(
        this.copy.archivePageSuccessWithPaths(result.count, result.archivePaths),
        10000,
      );
    } catch (error) {
      console.error("Task Manager: failed to archive tasks from active file", error);
      new Notice(this.copy.archiveActionFailureNotice);
    }
  }

  private async archiveCurrentTask(
    file: MarkdownView["file"],
    editor: MarkdownView["editor"],
  ): Promise<void> {
    if (!file || !editor) {
      new Notice(this.copy.archiveMissingFileNotice);
      return;
    }

    const lineText = editor.getLine(editor.getCursor().line);
    if (!isTaskArchivable(lineText)) {
      new Notice(this.copy.archiveNoTasksNotice);
      return;
    }

    const confirmed = await this.confirmArchive(
      this.copy.archiveCurrentTaskConfirmMessage,
    );
    if (!confirmed) {
      return;
    }

    try {
      const archived = await this.monitorService.archiveTaskAtCursor(file, editor);
      if (!archived) {
        new Notice(this.copy.archiveNoTasksNotice);
        return;
      }

      new Notice(
        this.copy.archiveSingleTaskSuccessWithPath(archived.archivePath),
        10000,
      );
    } catch (error) {
      console.error("Task Manager: failed to archive current task", error);
      new Notice(this.copy.archiveActionFailureNotice);
    }
  }

  private countArchivableTasks(editor: Editor): number {
    return editor
      .getValue()
      .split("\n")
      .filter((line) => isTaskArchivable(line)).length;
  }

  private async confirmArchive(message: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      new ConfirmModal(
        this.app,
        this.copy.archiveConfirmTitle,
        message,
        this.copy.archiveConfirmButton,
        this.copy.archiveCancelButton,
        resolve,
      ).open();
    });
  }

  private get copy() {
    return getSettingsCopy(this.settings);
  }
}
