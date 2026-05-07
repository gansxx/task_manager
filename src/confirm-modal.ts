import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
  private resolved = false;
  private readonly resolver: (value: boolean) => void;

  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly confirmLabel: string,
    private readonly cancelLabel: string,
    resolver: (value: boolean) => void,
  ) {
    super(app);
    this.resolver = resolver;
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: this.message });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(this.cancelLabel).onClick(() => {
          this.finish(false);
        }),
      )
      .addButton((button) =>
        button
          .setButtonText(this.confirmLabel)
          .setCta()
          .onClick(() => {
            this.finish(true);
          }),
      );
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolver(false);
    }

    this.contentEl.empty();
  }

  private finish(value: boolean): void {
    this.resolved = true;
    this.close();
    this.resolver(value);
  }
}
