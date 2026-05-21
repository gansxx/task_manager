import { Editor, MarkdownView, Menu, Notice, Plugin } from "obsidian";
import { ConfirmModal } from "./confirm-modal";
import { getSettingsCopy } from "./i18n";
import { registerDateTokenDecorations } from "./date-token-decorations";
import { TaskEventPipeline } from "./pipeline";
import { DEFAULT_SETTINGS, TaskManagerSettingTab } from "./settings";
import { TASK_SIDEBAR_VIEW_TYPE, TaskSidebarView } from "./task-sidebar-view";
import { TaskArchiveService } from "./tasks/archive-service";
import { isTaskArchivable, parseTaskLine, setTaskPriority } from "./tasks/task-line";
import { TaskMonitorService } from "./tasks/task-monitor-service";
import type { TaskManagerSettings, TaskPriority } from "./types";

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
    this.updateMetadataTokenVisibility();
    this.register(() => document.body.removeClass("task-manager-hide-metadata-tokens"));
    registerDateTokenDecorations(this);
    this.registerView(
      TASK_SIDEBAR_VIEW_TYPE,
      (leaf) => new TaskSidebarView(leaf, this),
    );
    this.registerArchiveUi();
    this.registerPriorityUi();
    this.registerTaskSidebarUi();

    if (this.settings.scanVaultOnStartup) {
      void this.preloadVaultTaskScan();
    }

    this.addSettingTab(
      new TaskManagerSettingTab(this.app, this, async () => {
        await this.saveSettings();
      }),
    );
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TASK_SIDEBAR_VIEW_TYPE);
    this.monitorService?.stop();
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateMetadataTokenVisibility();
  }

  updateMetadataTokenVisibility(): void {
    document.body.toggleClass(
      "task-manager-hide-metadata-tokens",
      this.settings.hideMetadataTokens,
    );
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


  private registerPriorityUi(): void {
    const priorities: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];

    for (const priority of priorities) {
      this.addCommand({
        id: `set-task-priority-${priority}`,
        name: this.copy.taskSidebarSetPriority(this.getPriorityLabel(priority)),
        editorCallback: (editor) => {
          this.setCurrentTaskPriority(editor, priority);
        },
      });
    }

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const lineText = editor.getLine(editor.getCursor().line);
        if (!parseTaskLine(lineText)) {
          return;
        }

        const prioritySubmenu = new Menu();
        for (const priority of priorities) {
          prioritySubmenu.addItem((item) =>
            item
              .setTitle(this.copy.taskSidebarSetPriority(this.getPriorityLabel(priority)))
              .setIcon(priority === "none" ? "x" : "flag")
              .onClick(() => this.setCurrentTaskPriority(editor, priority)),
          );
        }

        menu.addItem((item) => {
          item.setTitle(this.copy.taskSidebarPriority).setIcon("flag");
          const itemWithSubmenu = item as typeof item & {
            setSubmenu?: (submenu: Menu) => typeof item;
          };
          if (itemWithSubmenu.setSubmenu) {
            itemWithSubmenu.setSubmenu(prioritySubmenu);
          } else {
            item.onClick((event) => prioritySubmenu.showAtMouseEvent(event as MouseEvent));
          }
        });
      }),
    );
  }

  private registerTaskSidebarUi(): void {
    this.addRibbonIcon("list-checks", this.copy.openTaskSidebarRibbonTitle, () => {
      void this.activateTaskSidebar();
    });

    this.addCommand({
      id: "open-task-manager-sidebar",
      name: this.copy.openTaskSidebarRibbonTitle,
      callback: () => {
        void this.activateTaskSidebar();
      },
    });
  }



  private async preloadVaultTaskScan(): Promise<void> {
    const files = this.app.vault.getMarkdownFiles();
    await Promise.all(files.map((file) => this.app.vault.cachedRead(file)));
  }

  private getPriorityLabel(priority: TaskPriority): string {
    switch (priority) {
      case "urgent":
        return this.copy.taskSidebarPriorityUrgent;
      case "high":
        return this.copy.taskSidebarPriorityHigh;
      case "medium":
        return this.copy.taskSidebarPriorityMedium;
      case "low":
        return this.copy.taskSidebarPriorityLow;
      default:
        return this.copy.taskSidebarPriorityNone;
    }
  }

  private setCurrentTaskPriority(editor: Editor, priority: TaskPriority): void {
    const lineNumber = editor.getCursor().line;
    const lineText = editor.getLine(lineNumber);
    const nextLine = setTaskPriority(lineText, priority);
    if (nextLine !== lineText) {
      editor.setLine(lineNumber, nextLine);
    }
  }

  private async activateTaskSidebar(): Promise<void> {
    const existingLeaf = this.app.workspace.getLeavesOfType(TASK_SIDEBAR_VIEW_TYPE)[0];
    if (existingLeaf) {
      this.app.workspace.revealLeaf(existingLeaf);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf?.setViewState({ type: TASK_SIDEBAR_VIEW_TYPE, active: true });
    if (leaf) {
      this.app.workspace.revealLeaf(leaf);
    }
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
    if (this.settings.skipArchiveConfirmation) {
      return true;
    }

    const result = await new Promise<{ confirmed: boolean; dontAskAgain: boolean }>((resolve) => {
      new ConfirmModal(
        this.app,
        this.copy.archiveConfirmTitle,
        message,
        this.copy.archiveConfirmButton,
        this.copy.archiveCancelButton,
        resolve,
        this.copy.archiveDontAskAgainLabel,
      ).open();
    });

    if (result.confirmed && result.dontAskAgain) {
      this.settings.skipArchiveConfirmation = true;
      await this.saveSettings();
    }

    return result.confirmed;
  }

  private get copy() {
    return getSettingsCopy(this.settings);
  }
}
