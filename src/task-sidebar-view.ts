import {
  App,
  ItemView,
  MarkdownView,
  Menu,
  Modal,
  normalizePath,
  Notice,
  Setting,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { getSettingsCopy, resolveLocale } from "./i18n";
import type TaskManagerPlugin from "./main";
import {
  getTaskTokenDates,
  parseTaskLine,
  stripMetadataTokens,
} from "./tasks/task-line";
import type { TaskPriority } from "./types";
import { getDatePart } from "./utils/date";
import { isMarkdownFile } from "./utils/path";

export const TASK_SIDEBAR_VIEW_TYPE = "task-manager-sidebar-view";

type PriorityFilter = TaskPriority | "all";
type FileScopeFilter = "current" | "path" | "vault";
type ArchiveFilter = "all" | "active" | "archived";
type CompletionFilter = "all" | "open" | "done";
type FilePathOptionType = "folder" | "file";

interface SidebarTask {
  file: TFile;
  lineNumber: number;
  text: string;
  checked: boolean;
  date: string | null;
  startTimestamp: string | null;
  doneTimestamp: string | null;
  durationText: string | null;
  priority: TaskPriority;
  archived: boolean;
  indentLevel: number;
  parentLineNumber: number | null;
  childLineNumbers: number[];
  comments: SidebarComment[];
}

interface SidebarComment {
  text: string;
  timestamp: string | null;
}

interface CachedSidebarTask extends Omit<SidebarTask, "file"> {
  filePath: string;
}

interface SidebarFilters {
  startDate: string;
  endDate: string;
  priority: PriorityFilter;
  archive: ArchiveFilter;
  completion: CompletionFilter;
  filePath: string;
  fileScope: FileScopeFilter;
}

let cachedSidebarTasks: CachedSidebarTask[] = [];

export async function preloadSidebarTaskCache(app: App): Promise<void> {
  const tasks = await collectSidebarTasks(app, () => true);
  cachedSidebarTasks = tasks.map(toCachedSidebarTask);
}

export class TaskSidebarView extends ItemView {
  private startDateInputEl?: HTMLInputElement;
  private endDateInputEl?: HTMLInputElement;
  private prioritySelectEl?: HTMLSelectElement;
  private archiveSelectEl?: HTMLSelectElement;
  private completionSelectEl?: HTMLSelectElement;
  private filePathInputEl?: HTMLInputElement;
  private filePathSuggestionsEl?: HTMLElement;
  private taskListEl?: HTMLElement;
  private statusEl?: HTMLElement;
  private loadingEl?: HTMLElement;
  private fileScope: FileScopeFilter = "current";
  private refreshId = 0;
  private readonly collapsedTaskIds = new Set<string>();
  private filePathOptions: Array<{ value: string; type: FilePathOptionType }> = [];
  private selectedFilePath = "";

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
    void this.refreshTasks();
    this.registerEvent(this.app.vault.on("modify", () => void this.refreshTasks()));
    this.registerEvent(this.app.vault.on("create", () => {
      this.updateFolderOptions();
      this.renderFilePathSuggestions();
      void this.refreshTasks();
    }));
    this.registerEvent(this.app.vault.on("delete", () => {
      this.updateFolderOptions();
      this.renderFilePathSuggestions();
      void this.refreshTasks();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => {
      if (this.fileScope === "current") {
        this.setFilePathToActiveFile();
      }
      void this.refreshTasks();
    }));
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  private renderShell(): void {
    const uiLanguageTag = this.getUiLanguageTag();
    const copy = this.copy;
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("task-manager-sidebar");
    container.setAttr("lang", uiLanguageTag);
    this.updateFolderOptions();

    const header = container.createDiv({ cls: "task-manager-sidebar-header" });
    header.createEl("h3", { text: copy.sidebarTitle });
    this.loadingEl = header.createDiv({ cls: "task-manager-sidebar-loading" });

    const filterDetails = container.createEl("details", { cls: "task-manager-sidebar-filter-details" });
    filterDetails.open = true;
    filterDetails.createEl("summary", { text: copy.sidebarFiltersSummary });
    const controls = filterDetails.createDiv({ cls: "task-manager-sidebar-controls" });
    controls.createEl("label", { text: copy.sidebarFilePathLabel });

    const filePathContainer = controls.createDiv({ cls: "task-manager-sidebar-file-path-container" });
    this.filePathInputEl = filePathContainer.createEl("input", {
      type: "text",
      cls: "task-manager-sidebar-file-filter",
      placeholder: copy.sidebarFilePathPlaceholder,
    });
    this.filePathInputEl.addEventListener("input", () => {
      this.renderFilePathSuggestions();
    });
    this.filePathInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      const candidate = this.filePathInputEl?.value.trim() ?? "";
      if (!candidate) {
        return;
      }

      const match = this.filePathOptions.find((option) => option.value === candidate);
      if (!match) {
        return;
      }

      this.applyFilePathSelection(match.value);
    });
    this.filePathInputEl.addEventListener("focus", () => {
      this.renderFilePathSuggestions();
    });
    this.filePathSuggestionsEl = filePathContainer.createDiv({
      cls: "task-manager-sidebar-file-suggestions",
    });

    const fileButtonRow = controls.createDiv({ cls: "task-manager-sidebar-actions" });
    const currentFileButton = fileButtonRow.createEl("button", { text: copy.sidebarCurrentFileButton });
    currentFileButton.addEventListener("click", () => {
      this.fileScope = "current";
      this.selectedFilePath = "";
      this.setFilePathToActiveFile();
      this.renderFilePathSuggestions();
      void this.refreshTasks();
    });
    const vaultButton = fileButtonRow.createEl("button", { text: copy.sidebarWholeVaultButton });
    vaultButton.addEventListener("click", () => {
      this.fileScope = "vault";
      this.selectedFilePath = "";
      if (this.filePathInputEl) {
        this.filePathInputEl.value = "";
      }
      this.renderFilePathSuggestions();
      void this.refreshTasks();
    });
    const archiveRootButton = fileButtonRow.createEl("button", { text: copy.sidebarArchiveButton });
    archiveRootButton.addEventListener("click", () => {
      this.applyFilePathSelection(this.plugin.settings.archiveRootFolder);
      if (this.archiveSelectEl) {
        this.archiveSelectEl.value = "archived";
      }
    });
    this.initializeFileFilter();

    controls.createEl("label", { text: copy.sidebarDateRangeLabel });
    const dateRangeRow = controls.createDiv({ cls: "task-manager-sidebar-date-range" });
    this.startDateInputEl = dateRangeRow.createEl("input", {
      type: "date",
      cls: "task-manager-sidebar-date-filter",
    });
    this.startDateInputEl.lang = uiLanguageTag;
    dateRangeRow.createSpan({ cls: "task-manager-sidebar-date-separator", text: "~" });
    this.endDateInputEl = dateRangeRow.createEl("input", {
      type: "date",
      cls: "task-manager-sidebar-date-filter",
    });
    this.endDateInputEl.lang = uiLanguageTag;
    this.startDateInputEl.addEventListener("change", () => void this.refreshTasks());
    this.endDateInputEl.addEventListener("change", () => void this.refreshTasks());

    const selectRow = controls.createDiv({ cls: "task-manager-sidebar-select-row is-three-columns" });

    const priorityColumn = selectRow.createDiv();
    priorityColumn.createEl("label", { text: copy.sidebarPriorityLabel });
    this.prioritySelectEl = priorityColumn.createEl("select", {
      cls: "task-manager-sidebar-priority-filter",
    });
    for (const [value, label] of [
      ["all", copy.sidebarPriorityAll],
      ["urgent", copy.sidebarPriorityUrgent],
      ["high", copy.sidebarPriorityHigh],
      ["medium", copy.sidebarPriorityMedium],
      ["low", copy.sidebarPriorityLow],
      ["none", copy.sidebarPriorityNone],
    ] as const) {
      this.prioritySelectEl.createEl("option", { value, text: label });
    }
    this.prioritySelectEl.addEventListener("change", () => void this.refreshTasks());

    const archiveColumn = selectRow.createDiv();
    archiveColumn.createEl("label", { text: copy.sidebarArchiveLabel });
    this.archiveSelectEl = archiveColumn.createEl("select", {
      cls: "task-manager-sidebar-archive-filter",
    });
    for (const [value, label] of [
      ["all", copy.sidebarArchiveAll],
      ["active", copy.sidebarArchiveActive],
      ["archived", copy.sidebarArchiveArchived],
    ] as const) {
      this.archiveSelectEl.createEl("option", { value, text: label });
    }
    this.archiveSelectEl.value = "active";
    this.archiveSelectEl.addEventListener("change", () => void this.refreshTasks());

    const completionColumn = selectRow.createDiv();
    completionColumn.createEl("label", { text: copy.sidebarCompletionLabel });
    this.completionSelectEl = completionColumn.createEl("select", {
      cls: "task-manager-sidebar-completion-filter",
    });
    for (const [value, label] of [
      ["all", copy.sidebarCompletionAll],
      ["open", copy.sidebarCompletionOpen],
      ["done", copy.sidebarCompletionDone],
    ] as const) {
      this.completionSelectEl.createEl("option", { value, text: label });
    }
    this.completionSelectEl.addEventListener("change", () => void this.refreshTasks());

    const buttonRow = controls.createDiv({ cls: "task-manager-sidebar-actions" });
    const todayButton = buttonRow.createEl("button", { text: copy.sidebarTodayButton });
    todayButton.addEventListener("click", () => {
      const today = formatDateInputValue(new Date());
      this.setDateRange(today, today);
      void this.refreshTasks();
    });
    const weekButton = buttonRow.createEl("button", { text: copy.sidebarWeekButton });
    weekButton.addEventListener("click", () => {
      this.setDateRange(formatDateInputValue(addDays(new Date(), -6)), formatDateInputValue(new Date()));
      void this.refreshTasks();
    });
    const monthButton = buttonRow.createEl("button", { text: copy.sidebarMonthButton });
    monthButton.addEventListener("click", () => {
      this.setDateRange(formatDateInputValue(addDays(new Date(), -29)), formatDateInputValue(new Date()));
      void this.refreshTasks();
    });
    const clearButton = buttonRow.createEl("button", { text: copy.sidebarResetButton });
    clearButton.addEventListener("click", () => {
      this.setDateRange("", "");
      this.initializeFileFilter();
      if (this.prioritySelectEl) {
        this.prioritySelectEl.value = "all";
      }
      if (this.archiveSelectEl) {
        this.archiveSelectEl.value = "active";
      }
      if (this.completionSelectEl) {
        this.completionSelectEl.value = "all";
      }
      this.renderFilePathSuggestions();
      void this.refreshTasks();
    });

    this.statusEl = container.createDiv({ cls: "task-manager-sidebar-status" });
    this.taskListEl = container.createDiv({ cls: "task-manager-sidebar-list" });
    this.renderFilePathSuggestions();
  }

  private async refreshTasks(): Promise<void> {
    if (!this.taskListEl || !this.statusEl) {
      return;
    }

    const refreshId = ++this.refreshId;
    const filters = this.getFilters();
    this.setLoading(true);
    this.renderTasks(this.getCachedTasks(), filters, true);

    const tasks = await collectSidebarTasks(
      this.app,
      (file) => this.isMonitoredFile(file),
    );
    if (refreshId !== this.refreshId) {
      return;
    }

    cachedSidebarTasks = tasks.map(toCachedSidebarTask);

    this.setLoading(false);
    this.renderTasks(tasks, filters, false);
  }

  private renderTasks(tasks: SidebarTask[], filters: SidebarFilters, loading: boolean): void {
    if (!this.taskListEl || !this.statusEl) {
      return;
    }

    const copy = this.copy;
    const visibleTasks = this.getVisibleTasks(tasks, filters);
    this.taskListEl.empty();
    this.statusEl.setText(
      `${copy.sidebarStatusTasks(visibleTasks.length)}${this.describeFilters(filters)}${loading ? copy.sidebarStatusLoadingSuffix : ""}`,
    );

    if (visibleTasks.length === 0) {
      this.taskListEl.createDiv({
        cls: "task-manager-sidebar-empty",
        text: loading ? copy.sidebarLoadingTasks : copy.sidebarNoTasksFound,
      });
      return;
    }

    const taskById = new Map(visibleTasks.map((task) => [getTaskId(task), task]));
    const roots = visibleTasks.filter(
      (task) =>
        task.parentLineNumber === null ||
        !taskById.has(getTaskIdForLine(task.file.path, task.parentLineNumber)),
    );

    roots.forEach((task, index) => {
      if (index > 0) {
        this.taskListEl?.createDiv({ cls: "task-manager-sidebar-root-divider" });
      }
      this.renderTaskNode(task, taskById, this.taskListEl, 0);
    });
  }

  private renderTaskNode(
    task: SidebarTask,
    taskById: Map<string, SidebarTask>,
    container: HTMLElement,
    depth: number,
  ): void {
    const copy = this.copy;
    const childTasks = task.childLineNumbers
      .map((lineNumber) => taskById.get(getTaskIdForLine(task.file.path, lineNumber)))
      .filter((child): child is SidebarTask => Boolean(child));
    const taskId = getTaskId(task);
    const hasChildren = childTasks.length > 0 || task.comments.length > 0;
    const collapsed = this.collapsedTaskIds.has(taskId);
    const item = container.createDiv({
      cls: `task-manager-sidebar-task is-priority-${task.priority}${task.archived ? " is-archived" : ""}${task.checked ? " is-completed" : " is-open"}`,
    });
    item.style.setProperty("--task-manager-task-depth", String(depth));

    const row = item.createDiv({ cls: "task-manager-sidebar-task-row" });
    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "task-manager-sidebar-task-checkbox",
    });
    checkbox.checked = task.checked;
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("change", () => {
      void this.toggleTaskChecked(task, checkbox.checked);
    });

    const toggle = row.createEl("button", {
      cls: "task-manager-sidebar-task-toggle",
      text: hasChildren ? (collapsed ? "▸" : "▾") : "•",
    });
    toggle.disabled = !hasChildren;
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (collapsed) {
        this.collapsedTaskIds.delete(taskId);
      } else {
        this.collapsedTaskIds.add(taskId);
      }
      this.renderTasks(this.getCachedTasks(), this.getFilters(), false);
    });

    const content = row.createDiv({ cls: "task-manager-sidebar-task-content" });
    const title = content.createDiv({
      cls: "task-manager-sidebar-task-title",
      text: stripMetadataTokens(task.text),
    });
    if (!title.textContent?.trim()) {
      title.setText(copy.sidebarEmptyTask);
    }

    const meta = content.createDiv({ cls: "task-manager-sidebar-task-meta" });
    meta.createSpan({ text: task.file.path });
    meta.createSpan({ text: ` · ${task.checked ? copy.sidebarCompletedBadge : copy.sidebarOpenBadge}` });
    if (task.date) {
      meta.createSpan({ text: ` · ${task.date}` });
    }
    if (task.priority !== "none") {
      meta.createSpan({ text: ` · ${this.getPriorityLabel(task.priority)}` });
    }
    if (task.archived) {
      meta.createSpan({ text: ` · ${copy.sidebarArchivedBadge}` });
      if (task.durationText) {
        meta.createSpan({ text: ` · ${copy.sidebarDurationLabel(task.durationText)}` });
      }
    }

    item.addEventListener("click", () => void this.openTask(task));
    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.openTaskMenu(task, event);
    });

    if (!collapsed && hasChildren) {
      const childrenEl = container.createDiv({ cls: "task-manager-sidebar-children" });
      childrenEl.style.setProperty("--task-manager-task-depth", String(depth + 1));
      for (const comment of task.comments) {
        const commentEl = childrenEl.createDiv({
          cls: "task-manager-sidebar-comment",
          text: stripMetadataTokens(comment.text),
        });
        if (comment.timestamp) {
          commentEl.createSpan({
            cls: "task-manager-sidebar-comment-timestamp",
            text: ` · ${comment.timestamp}`,
          });
        }
      }
      for (const child of childTasks) {
        this.renderTaskNode(child, taskById, childrenEl, depth + 1);
      }
    }
  }

  private getVisibleTasks(tasks: SidebarTask[], filters: SidebarFilters): SidebarTask[] {
    const taskById = new Map(tasks.map((task) => [getTaskId(task), task]));
    const directMatches = new Set(
      tasks.filter((task) => this.matchesFilters(task, filters)).map((task) => getTaskId(task)),
    );
    const visible = new Set<string>();

    for (const taskId of directMatches) {
      let current = taskById.get(taskId);
      while (current) {
        visible.add(getTaskId(current));
        current = current.parentLineNumber === null
          ? undefined
          : taskById.get(getTaskIdForLine(current.file.path, current.parentLineNumber));
      }
    }

    return tasks.filter((task) => visible.has(getTaskId(task)));
  }

  private getFilters(): SidebarFilters {
    return normalizeFilters({
      startDate: this.startDateInputEl?.value.trim() ?? "",
      endDate: this.endDateInputEl?.value.trim() ?? "",
      priority: (this.prioritySelectEl?.value as PriorityFilter | undefined) ?? "all",
      archive: (this.archiveSelectEl?.value as ArchiveFilter | undefined) ?? "active",
      completion: (this.completionSelectEl?.value as CompletionFilter | undefined) ?? "all",
      filePath: this.selectedFilePath,
      fileScope: this.fileScope,
    });
  }

  private matchesFilters(task: SidebarTask, filters: SidebarFilters): boolean {
    if (!this.matchesFileFilter(task.file, filters)) {
      return false;
    }

    if (filters.archive === "archived" && !task.archived) {
      return false;
    }

    if (filters.archive === "active" && task.archived) {
      return false;
    }

    if (filters.completion === "open" && task.checked) {
      return false;
    }

    if (filters.completion === "done" && !task.checked) {
      return false;
    }

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

  private matchesFileFilter(
    file: TFile,
    filters: { filePath: string; fileScope: FileScopeFilter },
  ): boolean {
    if (filters.fileScope === "vault") {
      return true;
    }

    if (filters.fileScope === "current") {
      return this.app.workspace.getActiveFile()?.path === file.path;
    }

    return matchesFilePath(file, filters.filePath);
  }

  private describeFilters(filters: SidebarFilters): string {
    const copy = this.copy;
    const descriptions: string[] = [];
    if (filters.fileScope === "vault") {
      descriptions.push(copy.sidebarStatusWholeVault);
    } else if (filters.fileScope === "current") {
      descriptions.push(copy.sidebarStatusCurrentFile);
    } else if (filters.filePath) {
      descriptions.push(copy.sidebarStatusInPath(filters.filePath));
    }

    if (filters.archive === "archived") {
      descriptions.push(copy.sidebarStatusArchived);
    } else if (filters.archive === "active") {
      descriptions.push(copy.sidebarStatusNotArchived);
    }

    if (filters.completion !== "all") {
      descriptions.push(
        copy.sidebarStatusCompletion(
          filters.completion === "open"
            ? copy.sidebarCompletionOpen
            : copy.sidebarCompletionDone,
        ),
      );
    }

    if (filters.startDate || filters.endDate) {
      descriptions.push(copy.sidebarStatusDateRange(filters.startDate, filters.endDate));
    }

    if (filters.priority !== "all") {
      descriptions.push(copy.sidebarStatusPriority(this.getPriorityLabel(filters.priority)));
    }

    return descriptions.join("");
  }

  private updateFolderOptions(): void {
    this.filePathOptions = getFilePathOptions(this.app.vault.getMarkdownFiles());
  }

  private renderFilePathSuggestions(): void {
    const suggestionsEl = this.filePathSuggestionsEl;
    if (!suggestionsEl) {
      return;
    }

    suggestionsEl.empty();
    const query = this.filePathInputEl?.value.trim().toLowerCase() ?? "";
    if (!query) {
      suggestionsEl.hide();
      return;
    }

    const matches = this.filePathOptions
      .filter((option) => option.value.toLowerCase().includes(query))
      .slice(0, 8);

    if (matches.length === 0) {
      suggestionsEl.createDiv({
        cls: "task-manager-sidebar-file-suggestion is-empty",
        text: this.copy.sidebarFileSuggestionsEmpty,
      });
      suggestionsEl.show();
      return;
    }

    for (const match of matches) {
      const button = suggestionsEl.createEl("button", {
        cls: "task-manager-sidebar-file-suggestion",
        text: match.value,
      });
      button.type = "button";
      button.createSpan({
        cls: "task-manager-sidebar-file-suggestion-type",
        text: match.type === "folder" ? "folder" : "file",
      });
      button.addEventListener("click", () => {
        this.applyFilePathSelection(match.value);
      });
    }

    suggestionsEl.show();
  }

  private initializeFileFilter(): void {
    const watchedFolder = this.plugin.settings.watchedFolder.trim();
    if (watchedFolder) {
      this.applyFilePathSelection(watchedFolder, false);
      return;
    }

    this.fileScope = "current";
    this.selectedFilePath = "";
    this.setFilePathToActiveFile();
  }

  private setFilePathToActiveFile(): void {
    if (!this.filePathInputEl) {
      return;
    }

    this.filePathInputEl.value = this.app.workspace.getActiveFile()?.path ?? "";
  }

  private setDateRange(startDate: string, endDate: string): void {
    if (this.startDateInputEl) {
      this.startDateInputEl.value = startDate;
    }
    if (this.endDateInputEl) {
      this.endDateInputEl.value = endDate;
    }
  }

  private setLoading(isLoading: boolean): void {
    this.loadingEl?.setText(isLoading ? this.copy.sidebarLoading : "");
    this.containerEl.toggleClass("is-loading", isLoading);
  }

  private getCachedTasks(): SidebarTask[] {
    return cachedSidebarTasks.flatMap((task) => {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (!(file instanceof TFile)) {
        return [];
      }

      return [{ ...task, file }];
    });
  }

  private isMonitoredFile(file: TFile): boolean {
    if (this.fileScope === "vault") {
      return true;
    }

    if (this.fileScope === "current") {
      return this.app.workspace.getActiveFile()?.path === file.path;
    }

    return matchesFilePath(
      file,
      this.filePathInputEl?.value.trim() || this.plugin.settings.watchedFolder,
    );
  }

  private async openTask(task: SidebarTask): Promise<void> {
    await this.app.workspace.openLinkText(task.file.path, "", false);
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    activeView?.editor.setCursor({ line: task.lineNumber, ch: 0 });
  }

  private openTaskMenu(task: SidebarTask, event: MouseEvent): void {
    const copy = this.copy;
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle(task.checked ? copy.sidebarMenuToggleReopen : copy.sidebarMenuToggleComplete)
        .setIcon(task.checked ? "rotate-ccw" : "check")
        .onClick(() => void this.toggleTaskChecked(task, !task.checked)),
    );

    menu.addItem((item) =>
      item
        .setTitle(copy.sidebarMenuPriorityParent)
        .setIcon("flag")
        .onClick((evt) => this.openPrioritySubmenu(task, evt)),
    );

    menu.addItem((item) =>
      item
        .setTitle(copy.sidebarMenuAddComment)
        .setIcon("message-square-plus")
        .onClick(() => {
          new TaskCommentModal(this.app, copy, async (comment) => {
            const updated = await this.plugin.addTaskComment(task.file, task.lineNumber, comment);
            if (!updated) {
              new Notice(copy.sidebarTaskMissingNotice);
              return;
            }
            void this.refreshTasks();
          }).open();
        }),
    );

    menu.showAtMouseEvent(event);
    this.attachPriorityHoverMenu(copy.sidebarMenuPriorityParent, event, (evt) => {
      this.openPrioritySubmenu(task, evt);
    });
  }

  private openPrioritySubmenu(
    task: SidebarTask,
    evt: MouseEvent | KeyboardEvent,
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
          .onClick(() => void this.updatePriority(task, priority)),
      );
    }

    menu.showAtMouseEvent(evt);
  }

  private async updatePriority(task: SidebarTask, priority: TaskPriority): Promise<void> {
    const updated = await this.plugin.updateTaskPriority(task.file, task.lineNumber, priority);
    if (!updated) {
      new Notice(this.copy.sidebarTaskMissingNotice);
      return;
    }
    void this.refreshTasks();
  }

  private async toggleTaskChecked(task: SidebarTask, checked: boolean): Promise<void> {
    const updated = await this.plugin.setTaskCompletion(task.file, task.lineNumber, checked);
    if (!updated) {
      new Notice(this.copy.sidebarTaskMissingNotice);
      return;
    }
    void this.refreshTasks();
  }

  private getUiLanguageTag(): string {
    return resolveLocale(this.plugin.settings.languageMode) === "zh" ? "zh-CN" : "en";
  }

  private getPriorityLabel(priority: TaskPriority | PriorityFilter): string {
    switch (priority) {
      case "urgent":
        return this.copy.sidebarPriorityUrgent;
      case "high":
        return this.copy.sidebarPriorityHigh;
      case "medium":
        return this.copy.sidebarPriorityMedium;
      case "low":
        return this.copy.sidebarPriorityLow;
      case "none":
        return this.copy.sidebarPriorityNone;
      default:
        return this.copy.sidebarPriorityAll;
    }
  }

  private get copy() {
    return getSettingsCopy(this.plugin.settings);
  }

  private applyFilePathSelection(value: string, refresh = true): void {
    this.fileScope = "path";
    this.selectedFilePath = value;
    if (this.filePathInputEl) {
      this.filePathInputEl.value = value;
    }
    this.filePathSuggestionsEl?.hide();
    if (refresh) {
      void this.refreshTasks();
    }
  }

  private attachPriorityHoverMenu(
    title: string,
    event: MouseEvent,
    openMenu: (evt: MouseEvent) => void,
  ): void {
    window.setTimeout(() => {
      const menus = Array.from(activeDocument.querySelectorAll(".menu"));
      const latestMenu = menus.at(-1);
      if (!(latestMenu instanceof HTMLElement)) {
        return;
      }

      const items = Array.from(latestMenu.querySelectorAll(".menu-item"));
      const target = items.find((item) =>
        item.textContent?.trim().includes(title),
      );
      if (!(target instanceof HTMLElement)) {
        return;
      }

      target.addEventListener("mouseenter", () => {
        openMenu(new MouseEvent("contextmenu", {
          bubbles: true,
          clientX: target.getBoundingClientRect().right - 4,
          clientY: target.getBoundingClientRect().top + 4,
          view: window,
        }));
      }, { once: true });
    }, 0);
  }
}

class TaskCommentModal extends Modal {
  private comment = "";

  constructor(
    app: App,
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

function normalizeFilters(filters: SidebarFilters): SidebarFilters {
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

function getTaskId(task: SidebarTask): string {
  return getTaskIdForLine(task.file.path, task.lineNumber);
}

function getTaskIdForLine(filePath: string, lineNumber: number): string {
  return `${filePath}:${lineNumber}`;
}

function getIndentLevel(indent: string): number {
  return [...indent].reduce((level, character) => level + (character === "\t" ? 1 : 0.25), 0);
}

function parseCommentLine(line: string): { indentLevel: number; text: string; timestamp: string | null } | null {
  const match = /^(\s*)-\s+(.*?)\s*@comment(?:\(([^)]+)\))?\s*$/.exec(line);
  if (!match) {
    return null;
  }

  return {
    indentLevel: getIndentLevel(match[1]),
    text: match[2],
    timestamp: match[3] ?? null,
  };
}

function getFilePathOptions(files: TFile[]): Array<{ value: string; type: FilePathOptionType }> {
  const folders = new Set<string>();
  const paths = new Set<string>();
  for (const file of files) {
    paths.add(file.path);
    const lastSlashIndex = file.path.lastIndexOf("/");
    if (lastSlashIndex > 0) {
      folders.add(file.path.slice(0, lastSlashIndex));
    }
  }

  const folderOptions = [...folders]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, type: "folder" as const }));
  const fileOptions = [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, type: "file" as const }));
  return [...folderOptions, ...fileOptions];
}

function matchesFilePath(file: TFile, path: string): boolean {
  const normalizedPath = normalizePath(path).replace(/\/$/, "");
  if (!normalizedPath) {
    return true;
  }

  const normalizedFilePath = normalizePath(file.path);
  return (
    normalizedFilePath === normalizedPath ||
    normalizedFilePath.startsWith(`${normalizedPath}/`)
  );
}

function toCachedSidebarTask(task: SidebarTask): CachedSidebarTask {
  return {
    filePath: task.file.path,
    lineNumber: task.lineNumber,
    text: task.text,
    checked: task.checked,
    date: task.date,
    startTimestamp: task.startTimestamp,
    doneTimestamp: task.doneTimestamp,
    durationText: task.durationText,
    priority: task.priority,
    archived: task.archived,
    indentLevel: task.indentLevel,
    parentLineNumber: task.parentLineNumber,
    childLineNumbers: task.childLineNumbers,
    comments: task.comments,
  };
}

async function collectSidebarTasks(
  app: App,
  filePredicate: (file: TFile) => boolean,
): Promise<SidebarTask[]> {
  const markdownFiles = app.vault.getMarkdownFiles().filter(filePredicate);
  const tasks: SidebarTask[] = [];

  for (const file of markdownFiles) {
    if (!isMarkdownFile(file)) {
      continue;
    }

    const content = await app.vault.cachedRead(file);
    const stack: SidebarTask[] = [];
    content.split("\n").forEach((line, index) => {
      const parsedTask = parseTaskLine(line);
      if (!parsedTask) {
        const comment = parseCommentLine(line);
        if (comment) {
          const parent = [...stack].reverse().find((task) => task.indentLevel < comment.indentLevel);
          parent?.comments.push({
            text: comment.text,
            timestamp: comment.timestamp,
          });
        }
        return;
      }

      const indentLevel = getIndentLevel(parsedTask.indent);
      while (stack.length > 0 && stack[stack.length - 1].indentLevel >= indentLevel) {
        stack.pop();
      }
      const parent = stack[stack.length - 1] ?? null;
      const tokenDates = getTaskTokenDates(line);
      const date = getDatePart(tokenDates.done ?? tokenDates.start ?? "");
      const task: SidebarTask = {
        file,
        lineNumber: index,
        text: parsedTask.body,
        checked: parsedTask.checked,
        date,
        startTimestamp: tokenDates.start,
        doneTimestamp: tokenDates.done,
        durationText: tokenDates.start && tokenDates.done
          ? formatDuration(tokenDates.start, tokenDates.done)
          : null,
        priority: parsedTask.priority,
        archived: /@archived\([^)]+\)/.test(parsedTask.body),
        indentLevel,
        parentLineNumber: parent?.lineNumber ?? null,
        childLineNumbers: [],
        comments: [],
      };
      parent?.childLineNumbers.push(task.lineNumber);
      tasks.push(task);
      stack.push(task);
    });
  }

  return tasks.sort((a, b) => {
    const archiveCompare = Number(a.archived) - Number(b.archived);
    if (archiveCompare !== 0) {
      return archiveCompare;
    }

    const completionCompare = Number(a.checked) - Number(b.checked);
    if (completionCompare !== 0) {
      return completionCompare;
    }

    const dateCompare = (b.date ?? "").localeCompare(a.date ?? "");
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return priorityWeight(b.priority) - priorityWeight(a.priority);
  });
}

function formatDuration(startTimestamp: string, doneTimestamp: string): string {
  const start = new Date(startTimestamp.replace(" ", "T"));
  const done = new Date(doneTimestamp.replace(" ", "T"));
  const diffMs = done.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "0m";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(minutes, 0)}m`;
}
