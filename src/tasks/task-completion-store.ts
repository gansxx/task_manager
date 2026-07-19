import { App } from "obsidian";
import initSqlJs, { type Database } from "sql.js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ParsedTaskLine } from "../types";
import { getTaskTokenDates, stripMetadataTokens } from "./task-line";

export interface CompletedTaskRecord {
  completedAt: string;
  startedAt: string | null;
}

export class TaskCompletionStore {
  private database: Database | null = null;
  private initialization: Promise<void> | null = null;

  constructor(private readonly app: App, private readonly pluginId: string) {}

  async recordCompletion(
    sourcePath: string,
    lineNumber: number,
    markdown: string,
    task: ParsedTaskLine,
  ): Promise<void> {
    await this.ensureReady();
    const { start, done } = getTaskTokenDates(markdown);
    if (!done || !this.database) return;

    const taskText = stripMetadataTokens(task.body);
    const completionKey = `${sourcePath}\u001f${lineNumber}\u001f${done}\u001f${taskText}`;
    this.database.run(
      `INSERT INTO completed_tasks (
        id, completion_key, task_text, raw_markdown, source_path, source_line,
        priority, started_at, completed_at, recorded_at, reopened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(completion_key) DO UPDATE SET reopened_at = NULL`,
      [
        createId(), completionKey, taskText, markdown, sourcePath, lineNumber,
        task.priority, start, done, new Date().toISOString(),
      ],
    );
    await this.persist();
  }

  async markReopened(sourcePath: string, lineNumber: number, markdown: string): Promise<void> {
    await this.ensureReady();
    const { done } = getTaskTokenDates(markdown);
    if (!done || !this.database) return;
    const task = stripMetadataTokens(markdown.replace(/^\s*-\s\[[ xX]\]\s?/, ""));
    const completionKey = `${sourcePath}\u001f${lineNumber}\u001f${done}\u001f${task}`;
    this.database.run(
      "UPDATE completed_tasks SET reopened_at = ? WHERE completion_key = ? AND reopened_at IS NULL",
      [new Date().toISOString(), completionKey],
    );
    await this.persist();
  }

  async getActiveCompletedTasks(): Promise<CompletedTaskRecord[]> {
    await this.ensureReady();
    if (!this.database) return [];
    const statement = this.database.prepare(
      "SELECT completed_at, started_at FROM completed_tasks WHERE reopened_at IS NULL ORDER BY completed_at ASC",
    );
    const tasks: CompletedTaskRecord[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as { completed_at: string; started_at: string | null };
      tasks.push({ completedAt: row.completed_at, startedAt: row.started_at });
    }
    statement.free();
    return tasks;
  }

  private async ensureReady(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    const wasmFile = await readFile(path.join(this.pluginDirectory, "sql-wasm.wasm"));
    const SqlJs = await initSqlJs({ wasmBinary: new Uint8Array(wasmFile).buffer });
    let existing: Uint8Array | undefined;
    try {
      existing = new Uint8Array(await readFile(this.databasePath));
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
    this.database = new SqlJs.Database(existing);
    this.database.run(`CREATE TABLE IF NOT EXISTS completed_tasks (
      id TEXT PRIMARY KEY,
      completion_key TEXT NOT NULL UNIQUE,
      task_text TEXT NOT NULL,
      raw_markdown TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      priority TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      reopened_at TEXT
    )`);
    this.database.run("CREATE INDEX IF NOT EXISTS completed_tasks_active_completed_at ON completed_tasks(reopened_at, completed_at)");
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.database) return;
    await mkdir(this.pluginDirectory, { recursive: true });
    await writeFile(this.databasePath, this.database.export());
  }

  private get pluginDirectory(): string {
    const adapter = this.app.vault.adapter as unknown as { getBasePath(): string };
    return path.join(adapter.getBasePath(), this.app.vault.configDir, "plugins", this.pluginId);
  }

  private get databasePath(): string {
    return path.join(this.pluginDirectory, "completed-tasks.sqlite");
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isMissingFileError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return error.code === "ENOENT";
}
