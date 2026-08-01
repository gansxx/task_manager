import { ItemView, WorkspaceLeaf } from "obsidian";
import type TaskManagerPlugin from "./main";
import { getTaskTokenDates, parseTaskLine } from "./tasks/task-line";

export const TASK_ANALYTICS_VIEW_TYPE = "task-manager-analytics-view";

interface CompletedTask {
  done: Date | null;
  durationMs: number | null;
}

interface WeekPoint {
  label: string;
  count: number;
}

export class TaskAnalyticsView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: TaskManagerPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return TASK_ANALYTICS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Task completion analytics";
  }

  getIcon(): string {
    return "bar-chart-3";
  }

  async onOpen(): Promise<void> {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("task-manager-analytics");
    root.createEl("h3", { text: this.getDisplayText() });

    const refreshButton = root.createEl("button", {
      cls: "task-manager-analytics-refresh",
      text: this.isChinese ? "刷新分析" : "Refresh analytics",
    });
    refreshButton.addEventListener("click", () => void this.refresh());

    const tasks = await this.collectCompletedTasks();
    const timedTasks = tasks.filter((task) => task.durationMs !== null);
    const stats = root.createDiv({ cls: "task-manager-analytics-stats" });
    this.renderMetric(stats, this.isChinese ? "已完成任务" : "Completed tasks", String(tasks.length));
    this.renderMetric(
      stats,
      this.isChinese ? "平均完成耗时" : "Average completion time",
      timedTasks.length ? formatDuration(average(timedTasks.map((task) => task.durationMs!))) : "—",
      timedTasks.length
        ? (this.isChinese ? `基于 ${timedTasks.length} 个含开始与完成时间的任务` : `From ${timedTasks.length} tasks with start and done times`)
        : (this.isChinese ? "任务需要同时包含 @start 与 @done" : "Tasks need both @start and @done"),
    );
    this.renderMetric(stats, this.isChinese ? "本周完成" : "Completed this week", String(this.countThisWeek(tasks)));

    const chartSection = root.createDiv({ cls: "task-manager-analytics-chart-section" });
    chartSection.createEl("h4", { text: this.isChinese ? "每周完成任务数" : "Tasks completed each week" });
    chartSection.createDiv({
      cls: "task-manager-analytics-subtitle",
      text: this.isChinese ? "最近 12 周（按 @done 日期统计）" : "Last 12 weeks (by @done date)",
    });
    this.renderLineChart(chartSection, this.getWeeklyPoints(tasks));
  }

  private get isChinese(): boolean {
    return this.plugin.settings.languageMode === "zh" ||
      (this.plugin.settings.languageMode === "auto" && navigator.language.toLowerCase().startsWith("zh"));
  }

  private renderMetric(container: HTMLElement, label: string, value: string, hint?: string): void {
    const metric = container.createDiv({ cls: "task-manager-analytics-metric" });
    metric.createDiv({ cls: "task-manager-analytics-metric-label", text: label });
    metric.createDiv({ cls: "task-manager-analytics-metric-value", text: value });
    if (hint) metric.createDiv({ cls: "task-manager-analytics-metric-hint", text: hint });
  }

  private async collectCompletedTasks(): Promise<CompletedTask[]> {
    const tasks: CompletedTask[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const content = await this.app.vault.cachedRead(file);
      for (const line of content.split("\n")) {
        const parsed = parseTaskLine(line);
        if (!parsed?.checked) continue;
        const { start, done } = getTaskTokenDates(line);
        const doneDate = parseLocalDate(done);
        const startDate = parseLocalDate(start);
        const durationMs = startDate && doneDate && doneDate >= startDate
          ? doneDate.getTime() - startDate.getTime()
          : null;
        tasks.push({ done: doneDate, durationMs });
      }
    }
    return tasks;
  }

  private countThisWeek(tasks: CompletedTask[]): number {
    const weekStart = startOfWeek(new Date());
    return tasks.filter((task) => task.done !== null && task.done >= weekStart).length;
  }

  private getWeeklyPoints(tasks: CompletedTask[]): WeekPoint[] {
    const currentWeek = startOfWeek(new Date());
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(currentWeek);
      start.setDate(currentWeek.getDate() - (11 - index) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return {
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        count: tasks.filter((task) => task.done !== null && task.done >= start && task.done < end).length,
      };
    });
  }

  private renderLineChart(container: HTMLElement, points: WeekPoint[]): void {
    const chart = container.createDiv({ cls: "task-manager-analytics-chart" });
    const width = 600;
    const height = 220;
    const padding = { top: 18, right: 18, bottom: 38, left: 34 };
    const max = Math.max(1, ...points.map((point) => point.count));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", this.isChinese ? "每周完成任务数量折线图" : "Weekly completed tasks line chart");
    chart.appendChild(svg);

    for (let row = 0; row <= 4; row += 1) {
      const y = padding.top + (height - padding.top - padding.bottom) * row / 4;
      appendSvg(svg, "line", { x1: padding.left, x2: width - padding.right, y1: y, y2: y, class: "task-manager-analytics-grid" });
      appendSvg(svg, "text", { x: padding.left - 7, y: y + 4, "text-anchor": "end", class: "task-manager-analytics-axis-label" }, String(Math.round(max * (4 - row) / 4)));
    }

    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;
    const coordinates = points.map((point, index) => ({
      x: padding.left + usableWidth * index / (points.length - 1),
      y: padding.top + usableHeight * (1 - point.count / max),
    }));
    appendSvg(svg, "polyline", { points: coordinates.map((point) => `${point.x},${point.y}`).join(" "), class: "task-manager-analytics-line" });
    coordinates.forEach((point, index) => {
      const title = `${points[index].label}: ${points[index].count}`;
      appendSvg(svg, "circle", { cx: point.x, cy: point.y, r: 4, class: "task-manager-analytics-point" }, title);
      if (index % 2 === 0 || index === points.length - 1) {
        appendSvg(svg, "text", { x: point.x, y: height - 12, "text-anchor": "middle", class: "task-manager-analytics-axis-label" }, points[index].label);
      }
    });
  }
}

function appendSvg(svg: SVGElement, tag: string, attributes: Record<string, string | number>, text?: string): void {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  if (text) {
    if (tag === "circle") {
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = text;
      element.appendChild(title);
    } else element.textContent = text;
  }
  svg.appendChild(element);
}

function parseLocalDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(value)) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${remainingMinutes}m`;
  return `${remainingMinutes}m`;
}
