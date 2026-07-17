import { Editor, MarkdownView, Menu, Modal, Notice, Plugin, Setting, TFile } from "obsidian";
import { ConfirmModal } from "./confirm-modal";
import { getSettingsCopy } from "./i18n";
import { registerDateTokenDecorations } from "./date-token-decorations";
import { TaskEventPipeline } from "./pipeline";
import { DEFAULT_SETTINGS, TaskManagerSettingTab } from "./settings";
import { preloadSidebarTaskCache, TASK_SIDEBAR_VIEW_TYPE, TaskSidebarView } from "./task-sidebar-view";
import { TaskArchiveService } from "./tasks/archive-service";
import { isTaskArchivable, parseTaskLine, setTaskPriority } from "./tasks/task-line";
import { TaskMonitorService } from "./tasks/task-monitor-service";
import { TASK_ANALYTICS_VIEW_TYPE, TaskAnalyticsView } from "./task-analytics-view";
import type { TaskManagerSettings, TaskPriority } from "./types";

export default class TaskManagerPlugin extends Plugin {
  settings: TaskManagerSettings = DEFAULT_SETTINGS;

  private pipeline!: TaskEventPipeline;
  private archiveService!: TaskArchiveService;
  private monitorService!: TaskMonitorService;
  private refreshTasksPromise: Promise<void> | null = null;

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
    void preloadSidebarTaskCache(this.app);
    this.updateMetadataTokenVisibility();
    this.register(() => activeDocument.body.removeClass("task-manager-hide-metadata-tokens"));
    registerDateTokenDecorations(this);
    this.registerView(
      TASK_SIDEBAR_VIEW_TYPE,
      (leaf) => new TaskSidebarView(leaf, this),
    );
    this.registerView(
      TASK_ANALYTICS_VIEW_TYPE,
      (leaf) => new TaskAnalyticsView(leaf, this),
    );
    this.registerArchiveUi();
    this.registerRefreshUi();
    this.registerPriorityUi();
    this.registerTaskSidebarUi();
    this.registerTaskAnalyticsUi();

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
    const loaded = (await this.loadData()) as Partial<TaskManagerSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateMetadataTokenVisibility();
    if (this.settings.preloadVaultOnStartup) {
      void preloadSidebarTaskCache(this.app);
      void this.monitorService.preloadVaultSnapshots();
    }
  }

  updateMetadataTokenVisibility(): void {
    activeDocument.body.toggleClass(
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

  private registerRefreshUi(): void {
    this.addRibbonIcon("refresh-cw", this.copy.refreshTasksRibbonTitle, () => {
      void this.refreshTasks();
    });

    this.addCommand({
      id: "refresh-task-manager-tasks",
      name: this.copy.refreshTasksRibbonTitle,
      callback: () => {
        void this.refreshTasks();
      },
    });
  }


  private registerPriorityUi(): void {
    const priorities: TaskPriority[] = ["urgent", "high", "medium", "low", "none"];

    for (const priority of priorities) {
      this.addCommand({
        id: `set-task-priority-${priority}`,
        name: `Set current task priority: ${priority}`,
        editorCallback: (editor) => {
          this.setCurrentTaskPriority(editor, priority);
        },
      });
    }

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const lineText = editor.getLine(editor.getCursor().line);
        const activeFile = this.app.workspace.getActiveFile();
        if (!parseTaskLine(lineText)) {
          return;
        }
        menu.addItem((item) =>
          item
            .setTitle(this.copy.sidebarMenuPriorityParent)
            .setIcon("flag")
            .onClick((evt) => this.openPrioritySubmenu(evt, (priority) => {
              this.setCurrentTaskPriority(editor, priority);
            })),
        );
        window.setTimeout(() => {
          const menus = Array.from(activeDocument.querySelectorAll(".menu"));
          const latestMenu = menus[menus.length - 1];
          if (!(latestMenu instanceof HTMLElement)) {
            return;
          }

          const target = Array.from(latestMenu.querySelectorAll(".menu-item")).find((item) =>
            item.textContent?.trim().includes(this.copy.sidebarMenuPriorityParent),
          );
          if (!(target instanceof HTMLElement)) {
            return;
          }

          target.addEventListener("mouseenter", () => {
            this.openPrioritySubmenu(new MouseEvent("contextmenu", {
              bubbles: true,
              clientX: target.getBoundingClientRect().right - 4,
              clientY: target.getBoundingClientRect().top + 4,
              view: window,
            }), (priority) => {
              this.setCurrentTaskPriority(editor, priority);
            });
          }, { once: true });
        }, 0);
        if (activeFile) {
          menu.addItem((item) =>
            item
              .setTitle(this.copy.sidebarMenuAddComment)
              .setIcon("message-square-plus")
              .onClick(() => {
                new TaskCommentInputModal(this.app, this.copy, async (comment) => {
                  const updated = await this.addTaskComment(
                    activeFile,
                    editor.getCursor().line,
                    comment,
                  );
                  if (!updated) {
                    new Notice(this.copy.sidebarTaskMissingNotice);
                  }
                }).open();
              }),
          );
        }
      }),
    );
  }

  private registerTaskSidebarUi(): void {
    this.addRibbonIcon("list-checks", "Open Task Manager sidebar", () => {
      void this.activateTaskSidebar();
    });

    this.addCommand({
      id: "open-task-manager-sidebar",
      name: "Open Task Manager sidebar",
      callback: () => {
        void this.activateTaskSidebar();
      },
    });
  }

  private registerTaskAnalyticsUi(): void {
    this.addRibbonIcon("bar-chart-3", "Open task completion analytics", () => {
      void this.activateTaskAnalytics();
    });
    this.addCommand({
      id: "open-task-completion-analytics",
      name: "Open task completion analytics",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Y" }],
      callback: () => void this.activateTaskAnalytics(),
    });
  }

  private async activateTaskAnalytics(): Promise<void> {
    try {
      for (const existingLeaf of this.app.workspace.getLeavesOfType(TASK_ANALYTICS_VIEW_TYPE)) {
        existingLeaf.detach();
      }
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: TASK_ANALYTICS_VIEW_TYPE, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) {
      console.error("Task Manager: failed to open analytics view", error);
      new Notice(`Task analytics failed: ${error instanceof Error ? error.message : String(error)}`, 10000);
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

  async updateTaskPriority(file: TFile, lineNumber: number, priority: TaskPriority): Promise<boolean> {
    return this.monitorService.updateTaskPriority(file, lineNumber, priority);
  }

  async addTaskComment(file: TFile, lineNumber: number, comment: string): Promise<boolean> {
    return this.monitorService.addTaskComment(file, lineNumber, comment);
  }

  async setTaskCompletion(file: TFile, lineNumber: number, checked: boolean): Promise<boolean> {
    return this.monitorService.setTaskCompletion(file, lineNumber, checked);
  }

  async refreshTasks(): Promise<void> {
    if (this.refreshTasksPromise) {
      return this.refreshTasksPromise;
    }

    this.setSidebarRefreshState(true);
    this.refreshTasksPromise = (async () => {
      try {
        const result = await this.monitorService.refreshTasks();
        await preloadSidebarTaskCache(this.app);
        for (const leaf of this.app.workspace.getLeavesOfType(TASK_SIDEBAR_VIEW_TYPE)) {
          if (leaf.view instanceof TaskSidebarView) {
            leaf.view.refreshNow(false);
          }
        }
        new Notice(
          this.copy.taskRefreshSuccessNotice(
            result.scannedFiles,
            result.updatedFiles,
            result.archivedTasks,
          ),
          10000,
        );
      } catch (error) {
        console.error("Task Manager: failed to refresh tasks", error);
        new Notice(this.copy.taskRefreshFailureNotice);
      } finally {
        this.setSidebarRefreshState(false);
        this.refreshTasksPromise = null;
      }
    })();

    return this.refreshTasksPromise;
  }

  private async activateTaskSidebar(): Promise<void> {
    const existingLeaf = this.app.workspace.getLeavesOfType(TASK_SIDEBAR_VIEW_TYPE)[0];
    if (existingLeaf) {
      this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(true);
    await leaf?.setViewState({ type: TASK_SIDEBAR_VIEW_TYPE, active: true });
    if (leaf) {
      this.app.workspace.setActiveLeaf(leaf, { focus: true });
    }
  }

  private setSidebarRefreshState(isRefreshing: boolean): void {
    for (const leaf of this.app.workspace.getLeavesOfType(TASK_SIDEBAR_VIEW_TYPE)) {
      if (leaf.view instanceof TaskSidebarView) {
        leaf.view.setManualRefreshState(isRefreshing);
      }
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

  private openPrioritySubmenu(
    evt: MouseEvent | KeyboardEvent,
    onSelect: (priority: TaskPriority) => void,
  ): void {
    if (!(evt instanceof MouseEvent)) {
      return;
    }

    const menu = new Menu();
    const priorities: Array<{ priority: TaskPriority; title: string; icon: string }> = [
      { priority: "urgent", title: this.copy.sidebarPriorityUrgent, icon: "chevrons-up" },
      { priority: "high", title: this.copy.sidebarPriorityHigh, icon: "chevron-up" },
      { priority: "medium", title: this.copy.sidebarPriorityMedium, icon: "minus" },
      { priority: "low", title: this.copy.sidebarPriorityLow, icon: "chevron-down" },
      { priority: "none", title: this.copy.sidebarPriorityNone, icon: "x" },
    ];

    for (const { priority, title, icon } of priorities) {
      menu.addItem((item) =>
        item
          .setTitle(this.copy.sidebarMenuSetPriority(title))
          .setIcon(icon)
          .onClick(() => onSelect(priority)),
      );
    }

    menu.showAtMouseEvent(evt);
  }
}

class TaskCommentInputModal extends Modal {
  private comment = "";

  constructor(
    app: Plugin["app"],
    private readonly copy: ReturnType<typeof getSettingsCopy>,
    private readonly onSubmit: (comment: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.copy.sidebarCommentModalTitle);
    this.contentEl.empty();
    new Setting(this.contentEl)
      .setName(this.copy.sidebarCommentFieldName)
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.setPlaceholder(this.copy.sidebarCommentFieldPlaceholder).onChange((value) => {
          this.comment = value;
        });
      });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(this.copy.sidebarCommentCancelButton).onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(this.copy.sidebarCommentSubmitButton)
          .setCta()
          .onClick(() => {
            const comment = this.comment.trim();
            if (!comment) {
              new Notice(this.copy.sidebarCommentEmptyNotice);
              return;
            }

            void this.onSubmit(comment).then(() => this.close());
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
