import { App, Modal, Setting } from "obsidian";

interface NotebookModalOptions {
  defaultTitle: string;
  rootPath: string;
  onSubmit: (title: string) => void | Promise<void>;
}

export class NotebookModal extends Modal {
  private titleValue: string;
  private readonly options: NotebookModalOptions;

  constructor(app: App, options: NotebookModalOptions) {
    super(app);
    this.options = options;
    this.titleValue = options.defaultTitle;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("agent-notebook-modal");
    contentEl.createEl("h2", { text: "标记 Notebook" });
    contentEl.createEl("p", {
      cls: "agent-notebook-muted",
      text: this.options.rootPath || "Vault root"
    });

    new Setting(contentEl).setName("名称").addText((text) => {
      text
        .setPlaceholder("Notebook 名称")
        .setValue(this.titleValue)
        .onChange((value) => {
          this.titleValue = value;
        });
      text.inputEl.focus();
      text.inputEl.select();
    });

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("保存")
        .setCta()
        .onClick(async () => {
          await this.options.onSubmit(this.titleValue);
          this.close();
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
