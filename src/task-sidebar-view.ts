import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { parseTaskLine } from "./tasks/task-line";
import type TaskManagerPlugin from "./main";
import type { TaskPriority } from "./types";
import { getDatePart } from "./utils/date";
import { isFileInsideFolder, isMarkdownFile } from "./utils/path";

export const TASK_SIDEBAR_VIEW_TYPE = "task-manager-sidebar-view";

interface SidebarTask {
  file: TFile;
  lineNumber: number;
  text: string;
  checked: boolean;
  date: string | null;
  priority: TaskPriority;
}

export class TaskSidebarView extends ItemView {
  private dateInputEl?: HTMLInputElement;
  private taskListEl?: HTMLElement;
  private statusEl?: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: TaskManagerPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TASK_SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Task Manager";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    this.renderShell();
    await this.refreshTasks();
    this.registerEvent(this.app.vault.on("modify", () => void this.refreshTasks()));
    this.registerEvent(this.app.vault.on("create", () => void this.refreshTasks()));
    this.registerEvent(this.app.vault.on("delete", () => void this.refreshTasks()));
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  private renderShell(): void {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("task-manager-sidebar");

    const header = container.createDiv({ cls: "task-manager-sidebar-header" });
    header.createEl("h3", { text: "Tasks" });

    const controls = container.createDiv({ cls: "task-manager-sidebar-controls" });
    controls.createEl("label", { text: "Filter by date" });
    this.dateInputEl = controls.createEl("input", {
      type: "date",
      cls: "task-manager-sidebar-date-filter",
    });
    this.dateInputEl.addEventListener("change", () => void this.refreshTasks());

    const buttonRow = controls.createDiv({ cls: "task-manager-sidebar-actions" });
    const todayButton = buttonRow.createEl("button", { text: "Today" });
    todayButton.addEventListener("click", () => {
      this.dateInputEl!.value = new Date().toISOString().slice(0, 10);
      void this.refreshTasks();
    });
    const clearButton = buttonRow.createEl("button", { text: "All" });
    clearButton.addEventListener("click", () => {
      this.dateInputEl!.value = "";
      void this.refreshTasks();
    });

    this.statusEl = container.createDiv({ cls: "task-manager-sidebar-status" });
    this.taskListEl = container.createDiv({ cls: "task-manager-sidebar-list" });
  }

  private async refreshTasks(): Promise<void> {
    if (!this.taskListEl || !this.statusEl) {
      return;
    }

    const selectedDate = this.dateInputEl?.value.trim() || "";
    const tasks = (await this.collectTasks()).filter(
      (task) => !selectedDate || task.date === selectedDate,
    );

    this.taskListEl.empty();
    this.statusEl.setText(
      selectedDate
        ? `${tasks.length} task(s) on ${selectedDate}`
        : `${tasks.length} task(s) in monitored notes`,
    );

    if (tasks.length === 0) {
      this.taskListEl.createDiv({ cls: "task-manager-sidebar-empty", text: "No tasks found." });
      return;
    }

    for (const task of tasks) {
      const item = this.taskListEl.createDiv({
        cls: `task-manager-sidebar-task is-priority-${task.priority}`,
      });
      item.createDiv({
        cls: "task-manager-sidebar-task-title",
        text: task.text.replace(/@(?:start|done|priority)\([^)]+\)/g, "").trim(),
      });
      const meta = item.createDiv({ cls: "task-manager-sidebar-task-meta" });
      meta.createSpan({ text: task.file.path });
      if (task.date) {
        meta.createSpan({ text: ` · ${task.date}` });
      }
      if (task.priority !== "none") {
        meta.createSpan({ text: ` · ${task.priority}` });
      }
      item.addEventListener("click", () => void this.openTask(task));
    }
  }

  private async collectTasks(): Promise<SidebarTask[]> {
    const markdownFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.isMonitoredFile(file));
    const tasks: SidebarTask[] = [];

    for (const file of markdownFiles) {
      if (!isMarkdownFile(file)) {
        continue;
      }

      const content = await this.app.vault.cachedRead(file);
      content.split("\n").forEach((line, index) => {
        const parsedTask = parseTaskLine(line);
        if (!parsedTask) {
          return;
        }

        const tokenDate = parsedTask.doneToken ?? parsedTask.startToken;
        const date = tokenDate ? getDatePart(tokenDate.replace(/^@\w+\(|\)$/g, "")) : null;
        tasks.push({
          file,
          lineNumber: index,
          text: parsedTask.body,
          checked: parsedTask.checked,
          date,
          priority: parsedTask.priority,
        });
      });
    }

    return tasks.sort((a, b) => {
      const dateCompare = (b.date ?? "").localeCompare(a.date ?? "");
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    });
  }

  private isMonitoredFile(file: TFile): boolean {
    const watchedFolder = this.plugin.settings.watchedFolder.trim();
    return !watchedFolder || isFileInsideFolder(file, watchedFolder);
  }

  private async openTask(task: SidebarTask): Promise<void> {
    await this.app.workspace.openLinkText(task.file.path, "", false);
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    activeView?.editor.setCursor({ line: task.lineNumber, ch: 0 });
  }
}

function priorityWeight(priority: TaskPriority): number {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}
