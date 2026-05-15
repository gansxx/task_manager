import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import { parseTaskLine } from "./tasks/task-line";
import type TaskManagerPlugin from "./main";
import type { TaskPriority } from "./types";
import { getDatePart } from "./utils/date";
import { isFileInsideFolder, isMarkdownFile } from "./utils/path";

export const TASK_SIDEBAR_VIEW_TYPE = "task-manager-sidebar-view";

type PriorityFilter = TaskPriority | "all";

interface SidebarTask {
  file: TFile;
  lineNumber: number;
  text: string;
  checked: boolean;
  date: string | null;
  priority: TaskPriority;
}

export class TaskSidebarView extends ItemView {
  private startDateInputEl?: HTMLInputElement;
  private endDateInputEl?: HTMLInputElement;
  private prioritySelectEl?: HTMLSelectElement;
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
    controls.createEl("label", { text: "Date range" });

    const dateRangeRow = controls.createDiv({ cls: "task-manager-sidebar-date-range" });
    this.startDateInputEl = dateRangeRow.createEl("input", {
      type: "date",
      cls: "task-manager-sidebar-date-filter",
    });
    dateRangeRow.createSpan({ cls: "task-manager-sidebar-date-separator", text: "~" });
    this.endDateInputEl = dateRangeRow.createEl("input", {
      type: "date",
      cls: "task-manager-sidebar-date-filter",
    });
    this.startDateInputEl.addEventListener("change", () => void this.refreshTasks());
    this.endDateInputEl.addEventListener("change", () => void this.refreshTasks());

    controls.createEl("label", { text: "Priority" });
    this.prioritySelectEl = controls.createEl("select", {
      cls: "task-manager-sidebar-priority-filter",
    });
    for (const [value, label] of [
      ["all", "All priorities"],
      ["urgent", "Urgent"],
      ["high", "High"],
      ["medium", "Medium"],
      ["low", "Low"],
      ["none", "No priority"],
    ] as const) {
      this.prioritySelectEl.createEl("option", { value, text: label });
    }
    this.prioritySelectEl.addEventListener("change", () => void this.refreshTasks());

    const buttonRow = controls.createDiv({ cls: "task-manager-sidebar-actions" });
    const todayButton = buttonRow.createEl("button", { text: "Today" });
    todayButton.addEventListener("click", () => {
      const today = formatDateInputValue(new Date());
      this.setDateRange(today, today);
      void this.refreshTasks();
    });
    const weekButton = buttonRow.createEl("button", { text: "7 days" });
    weekButton.addEventListener("click", () => {
      this.setDateRange(formatDateInputValue(addDays(new Date(), -6)), formatDateInputValue(new Date()));
      void this.refreshTasks();
    });
    const monthButton = buttonRow.createEl("button", { text: "30 days" });
    monthButton.addEventListener("click", () => {
      this.setDateRange(formatDateInputValue(addDays(new Date(), -29)), formatDateInputValue(new Date()));
      void this.refreshTasks();
    });
    const clearButton = buttonRow.createEl("button", { text: "All" });
    clearButton.addEventListener("click", () => {
      this.setDateRange("", "");
      if (this.prioritySelectEl) {
        this.prioritySelectEl.value = "all";
      }
      void this.refreshTasks();
    });

    this.statusEl = container.createDiv({ cls: "task-manager-sidebar-status" });
    this.taskListEl = container.createDiv({ cls: "task-manager-sidebar-list" });
  }

  private async refreshTasks(): Promise<void> {
    if (!this.taskListEl || !this.statusEl) {
      return;
    }

    const filters = this.getFilters();
    const tasks = (await this.collectTasks()).filter((task) => this.matchesFilters(task, filters));

    this.taskListEl.empty();
    this.statusEl.setText(`${tasks.length} task(s)${this.describeFilters(filters)}`);

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
        text: task.text.replace(/@(?:start|done|priority|archived)\([^)]+\)|@from\("[^"]+"\)/g, "").trim(),
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

  private getFilters(): {
    startDate: string;
    endDate: string;
    priority: PriorityFilter;
  } {
    return normalizeFilters({
      startDate: this.startDateInputEl?.value.trim() ?? "",
      endDate: this.endDateInputEl?.value.trim() ?? "",
      priority: (this.prioritySelectEl?.value as PriorityFilter | undefined) ?? "all",
    });
  }

  private matchesFilters(
    task: SidebarTask,
    filters: { startDate: string; endDate: string; priority: PriorityFilter },
  ): boolean {
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }

    if (!filters.startDate && !filters.endDate) {
      return true;
    }

    if (!task.date) {
      return false;
    }

    if (filters.startDate && task.date < filters.startDate) {
      return false;
    }

    if (filters.endDate && task.date > filters.endDate) {
      return false;
    }

    return true;
  }

  private describeFilters(filters: {
    startDate: string;
    endDate: string;
    priority: PriorityFilter;
  }): string {
    const descriptions: string[] = [];
    if (filters.startDate || filters.endDate) {
      descriptions.push(` from ${filters.startDate || "…"} to ${filters.endDate || "…"}`);
    } else {
      descriptions.push(" in monitored notes");
    }

    if (filters.priority !== "all") {
      descriptions.push(` with ${filters.priority} priority`);
    }

    return descriptions.join("");
  }

  private setDateRange(startDate: string, endDate: string): void {
    if (this.startDateInputEl) {
      this.startDateInputEl.value = startDate;
    }
    if (this.endDateInputEl) {
      this.endDateInputEl.value = endDate;
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

function normalizeFilters(filters: {
  startDate: string;
  endDate: string;
  priority: PriorityFilter;
}): { startDate: string; endDate: string; priority: PriorityFilter } {
  const startDate = filters.startDate;
  const endDate = filters.endDate;

  if (startDate && endDate && startDate > endDate) {
    return { ...filters, startDate: endDate, endDate: startDate };
  }

  return filters;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
