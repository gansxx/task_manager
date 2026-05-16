import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import { GITHUB_REPO_URL, getSettingsCopy } from "./i18n";
import type TaskManagerPlugin from "./main";
import type { TaskManagerSettings } from "./types";

export const DEFAULT_SETTINGS: TaskManagerSettings = {
  watchedFolder: "",
  archiveRootFolder: "Task Archive",
  startTokenFormat: "@start({date})",
  doneTokenFormat: "@done({date})",
  timestampPrecision: "date",
  hideMetadataTokens: false,
  skipArchiveConfirmation: false,
  immediateArchiveEnabled: false,
  languageMode: "auto",
};

export class TaskManagerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: TaskManagerPlugin,
    private readonly onSave: () => Promise<void>,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const copy = getSettingsCopy(this.plugin.settings);
    containerEl.empty();

    new Setting(containerEl)
      .setName(copy.languageName)
      .setDesc(copy.languageDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("auto", copy.languageAuto)
          .addOption("zh", copy.languageChinese)
          .addOption("en", copy.languageEnglish)
          .setValue(this.plugin.settings.languageMode)
          .onChange(async (value) => {
            this.plugin.settings.languageMode = value as TaskManagerSettings["languageMode"];
            await this.onSave();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName(copy.watchedFolderName)
      .setDesc(copy.watchedFolderDesc)
      .addText((text) =>
        text
          .setPlaceholder(copy.watchedFolderPlaceholder)
          .setValue(this.plugin.settings.watchedFolder)
          .onChange(async (value) => {
            this.plugin.settings.watchedFolder = normalizeVaultPath(value);
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.archiveRootFolderName)
      .setDesc(copy.archiveRootFolderDesc)
      .addText((text) =>
        text
          .setPlaceholder(copy.archiveRootFolderPlaceholder)
          .setValue(this.plugin.settings.archiveRootFolder)
          .onChange(async (value) => {
            this.plugin.settings.archiveRootFolder = normalizeVaultPath(value);
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.startTokenFormatName)
      .setDesc(copy.startTokenFormatDesc)
      .addText((text) =>
        text.setValue(this.plugin.settings.startTokenFormat).onChange(async (value) => {
          this.plugin.settings.startTokenFormat =
            value.trim() || DEFAULT_SETTINGS.startTokenFormat;
          await this.onSave();
        }),
      );

    new Setting(containerEl)
      .setName(copy.doneTokenFormatName)
      .setDesc(copy.doneTokenFormatDesc)
      .addText((text) =>
        text.setValue(this.plugin.settings.doneTokenFormat).onChange(async (value) => {
          this.plugin.settings.doneTokenFormat =
            value.trim() || DEFAULT_SETTINGS.doneTokenFormat;
          await this.onSave();
        }),
      );

    new Setting(containerEl)
      .setName(copy.timestampPrecisionName)
      .setDesc(copy.timestampPrecisionDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("date", copy.timestampPrecisionDate)
          .addOption("minute", copy.timestampPrecisionMinute)
          .addOption("second", copy.timestampPrecisionSecond)
          .setValue(this.plugin.settings.timestampPrecision)
          .onChange(async (value) => {
            this.plugin.settings.timestampPrecision = value as TaskManagerSettings["timestampPrecision"];
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.hideMetadataTokensName)
      .setDesc(copy.hideMetadataTokensDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideMetadataTokens)
          .onChange(async (value) => {
            this.plugin.settings.hideMetadataTokens = value;
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.skipArchiveConfirmationName)
      .setDesc(copy.skipArchiveConfirmationDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.skipArchiveConfirmation)
          .onChange(async (value) => {
            this.plugin.settings.skipArchiveConfirmation = value;
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.immediateArchiveName)
      .setDesc(copy.immediateArchiveDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.immediateArchiveEnabled)
          .onChange(async (value) => {
            this.plugin.settings.immediateArchiveEnabled = value;
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName(copy.githubName)
      .setDesc(copy.githubDesc)
      .addButton((button) =>
        button.setButtonText(copy.githubButtonLabel).onClick(() => {
          window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer");
        }),
      );
  }
}

function normalizeVaultPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return normalizePath(trimmed);
}
