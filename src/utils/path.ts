import { normalizePath, TFile } from "obsidian";

export function isMarkdownFile(file: TFile): boolean {
  return file.extension.toLowerCase() === "md";
}

export function isFileInsideFolder(file: TFile, folderPath: string): boolean {
  const normalizedFolder = normalizeConfiguredFolder(folderPath);
  if (!normalizedFolder) {
    return false;
  }

  const normalizedFilePath = normalizePath(file.path);
  return normalizedFilePath.startsWith(`${normalizedFolder}/`);
}

export function normalizeConfiguredFolder(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return normalizePath(trimmed).replace(/\/$/, "");
}
