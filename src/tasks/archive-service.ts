import type { TFile } from "obsidian";

export const SQLITE_ARCHIVE_LOCATION = "completed-tasks.sqlite#archived_tasks";

export interface ArchiveWriteResult {
  archivePath: string;
}

export class TaskArchiveService {
  async archiveCompletedTask(
    _sourceFile: TFile,
    _archivedTaskBlock: string,
    _completedDate: string,
  ): Promise<ArchiveWriteResult> {
    return { archivePath: SQLITE_ARCHIVE_LOCATION };
  }

  async archiveTaskLine(
    _sourceFile: TFile,
    _archivedTaskBlock: string,
    _archivedDate: string,
  ): Promise<ArchiveWriteResult> {
    return { archivePath: SQLITE_ARCHIVE_LOCATION };
  }
}
