import { App, normalizePath, TFile } from "obsidian";
import type { TaskManagerSettings } from "../types";
import { getIsoWeekParts } from "../utils/date";

export class TaskArchiveService {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => TaskManagerSettings,
  ) {}

  async archiveCompletedTask(
    sourceFile: TFile,
    archivedTaskLine: string,
    completedDate: string,
  ): Promise<void> {
    const { isoYear, isoWeek } = getIsoWeekParts(
      new Date(`${completedDate}T00:00:00`),
    );
    const archiveRoot = this.getSettings().archiveRootFolder.trim();
    if (!archiveRoot) {
      return;
    }

    const yearFolder = normalizePath(`${archiveRoot}/${isoYear}`);
    const archivePath = normalizePath(
      `${yearFolder}/${isoYear}-W${String(isoWeek).padStart(2, "0")}.md`,
    );

    await this.ensureFolderExists(yearFolder);

    const archiveLine = `${archivedTaskLine} @from("${sourceFile.path}") @archived(${completedDate})`;
    const existing = this.app.vault.getAbstractFileByPath(archivePath);
    if (existing instanceof TFile) {
      const current = await this.app.vault.read(existing);
      const next = current.trimEnd().length > 0
        ? `${current.trimEnd()}\n${archiveLine}\n`
        : `${archiveLine}\n`;
      await this.app.vault.modify(existing, next);
      return;
    }

    const initial = `# ${isoYear}-W${String(isoWeek).padStart(2, "0")}\n\n${archiveLine}\n`;
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
