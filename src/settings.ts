import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type TaskManagerPlugin from "./main";
import type { TaskManagerSettings } from "./types";

export const DEFAULT_SETTINGS: TaskManagerSettings = {
  watchedFolder: "Tasks",
  archiveRootFolder: "Task Archive",
  startTokenFormat: "@start({date})",
  doneTokenFormat: "@done({date})",
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
    containerEl.empty();

    new Setting(containerEl)
      .setName("Watched folder")
      .setDesc("Only Markdown files inside this vault folder will be monitored.")
      .addText((text) =>
        text
          .setPlaceholder("Tasks")
          .setValue(this.plugin.settings.watchedFolder)
          .onChange(async (value) => {
            this.plugin.settings.watchedFolder = normalizeVaultPath(value);
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName("Archive root folder")
      .setDesc("Completed tasks will be archived under year/week files here.")
      .addText((text) =>
        text
          .setPlaceholder("Task Archive")
          .setValue(this.plugin.settings.archiveRootFolder)
          .onChange(async (value) => {
            this.plugin.settings.archiveRootFolder = normalizeVaultPath(value);
            await this.onSave();
          }),
      );

    new Setting(containerEl)
      .setName("Start token format")
      .setDesc("Use {date} as the date placeholder.")
      .addText((text) =>
        text.setValue(this.plugin.settings.startTokenFormat).onChange(async (value) => {
          this.plugin.settings.startTokenFormat =
            value.trim() || DEFAULT_SETTINGS.startTokenFormat;
          await this.onSave();
        }),
      );

    new Setting(containerEl)
      .setName("Done token format")
      .setDesc("Use {date} as the date placeholder.")
      .addText((text) =>
        text.setValue(this.plugin.settings.doneTokenFormat).onChange(async (value) => {
          this.plugin.settings.doneTokenFormat =
            value.trim() || DEFAULT_SETTINGS.doneTokenFormat;
          await this.onSave();
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
