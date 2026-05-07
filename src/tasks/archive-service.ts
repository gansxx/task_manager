import { App, normalizePath, TFile } from "obsidian";
import type { TaskManagerSettings } from "../types";
import { getIsoWeekParts } from "../utils/date";
import { getTaskReferenceDate } from "./task-line";

const UNTIMED_FOLDER_NAME = "untimed";
const UNTIMED_FILE_NAME = "untimed-tasks.md";

export interface ArchiveWriteResult {
  archivePath: string;
}

export class TaskArchiveService {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => TaskManagerSettings,
  ) {}

  async archiveCompletedTask(
    sourceFile: TFile,
    archivedTaskLine: string,
    completedDate: string,
  ): Promise<ArchiveWriteResult> {
    return this.archiveTaskLine(sourceFile, archivedTaskLine, completedDate);
  }

  async archiveTaskLine(
    sourceFile: TFile,
    archivedTaskLine: string,
    archivedDate: string,
  ): Promise<ArchiveWriteResult> {
    const archiveRoot = this.getSettings().archiveRootFolder.trim();
    if (!archiveRoot) {
      return { archivePath: "" };
    }

    const archiveLine = `${archivedTaskLine} @from("${sourceFile.path}") @archived(${archivedDate})`;
    const referenceDate = getTaskReferenceDate(archivedTaskLine);
    if (!referenceDate) {
      const untimedFolder = normalizePath(`${archiveRoot}/${UNTIMED_FOLDER_NAME}`);
      const untimedPath = normalizePath(`${untimedFolder}/${UNTIMED_FILE_NAME}`);

      await this.ensureFolderExists(untimedFolder);
      await this.appendArchiveLine(
        untimedPath,
        "# Untimed Tasks",
        archiveLine,
      );
      return { archivePath: untimedPath };
    }

    const { isoYear, isoWeek, archiveMonth } = getIsoWeekParts(
      new Date(`${referenceDate}T00:00:00`),
    );
    const yearFolder = normalizePath(`${archiveRoot}/${isoYear}`);
    const monthFolder = normalizePath(`${yearFolder}/${archiveMonth}`);
    const archivePath = normalizePath(
      `${monthFolder}/${isoYear}-W${String(isoWeek).padStart(2, "0")}.md`,
    );

    await this.ensureFolderExists(monthFolder);
    await this.appendArchiveLine(
      archivePath,
      `# ${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
      archiveLine,
    );
    return { archivePath };
  }

  private async appendArchiveLine(
    archivePath: string,
    title: string,
    archiveLine: string,
  ): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(archivePath);
    if (existing instanceof TFile) {
      const current = await this.app.vault.read(existing);
      const next = current.trimEnd().length > 0
        ? `${current.trimEnd()}\n${archiveLine}\n`
        : `${archiveLine}\n`;
      await this.app.vault.modify(existing, next);
      return;
    }

    const initial = `${title}\n\n${archiveLine}\n`;
    await this.app.vault.create(archivePath, initial);
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const segments = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
}
