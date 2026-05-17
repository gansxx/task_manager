import { App, Modal, Setting } from "obsidian";

export interface ConfirmationResult {
  confirmed: boolean;
  dontAskAgain: boolean;
}

export class ConfirmModal extends Modal {
  private resolved = false;
  private dontAskAgain = false;
  private readonly resolver: (value: ConfirmationResult) => void;

  constructor(
    app: App,
    private readonly title: string,
    private readonly message: string,
    private readonly confirmLabel: string,
    private readonly cancelLabel: string,
    resolver: (value: ConfirmationResult) => void,
    private readonly dontAskAgainLabel?: string,
  ) {
    super(app);
    this.resolver = resolver;
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: this.message });

    if (this.dontAskAgainLabel) {
      new Setting(this.contentEl)
        .setName(this.dontAskAgainLabel)
        .addToggle((toggle) =>
          toggle.setValue(this.dontAskAgain).onChange((value) => {
            this.dontAskAgain = value;
          }),
        );
    }

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
      this.resolver({ confirmed: false, dontAskAgain: false });
    }

    this.contentEl.empty();
  }

  private finish(confirmed: boolean): void {
    this.resolved = true;
    this.close();
    this.resolver({
      confirmed,
      dontAskAgain: confirmed && this.dontAskAgain,
    });
  }
}
