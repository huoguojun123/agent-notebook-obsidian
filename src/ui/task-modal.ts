import { App, Modal, Notice, Setting } from "obsidian";
import type { NotebookStage } from "../types";
import { STAGE_LABELS } from "../types";

interface TaskModalOptions {
  createRunDraftByDefault: boolean;
  notebookTitle: string;
  onSubmit: (
    stage: NotebookStage,
    instruction: string,
    createRunDraft: boolean
  ) => void | Promise<void>;
}

const STAGES = Object.keys(STAGE_LABELS) as NotebookStage[];

export class TaskModal extends Modal {
  private createRunDraft: boolean;
  private instruction = "";
  private readonly options: TaskModalOptions;
  private stage: NotebookStage = "optimize";

  constructor(app: App, options: TaskModalOptions) {
    super(app);
    this.options = options;
    this.createRunDraft = options.createRunDraftByDefault;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("agent-notebook-modal");
    contentEl.createEl("h2", { text: "创建 Agent Notebook 任务" });
    contentEl.createEl("p", {
      cls: "agent-notebook-muted",
      text: `Notebook: ${this.options.notebookTitle}`
    });

    new Setting(contentEl).setName("阶段").addDropdown((dropdown) => {
      for (const stage of STAGES) {
        dropdown.addOption(stage, STAGE_LABELS[stage]);
      }
      dropdown.setValue(this.stage).onChange((value) => {
        this.stage = value as NotebookStage;
      });
    });

    new Setting(contentEl).setName("创建 run 草稿").addToggle((toggle) => {
      toggle.setValue(this.createRunDraft).onChange((value) => {
        this.createRunDraft = value;
      });
    });

    new Setting(contentEl).setName("要求").setDesc("写清楚你希望 agent 对当前 notebook 做什么。");
    const textarea = contentEl.createEl("textarea", {
      attr: {
        placeholder: "例如：按零基础学习者视角优化当前章节结构，非当前文件只提建议。"
      }
    });
    textarea.addEventListener("input", () => {
      this.instruction = textarea.value;
    });
    textarea.focus();

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("生成 Prompt")
        .setCta()
        .onClick(async () => {
          if (!this.instruction.trim()) {
            new Notice("请先填写任务要求。");
            return;
          }

          await this.options.onSubmit(
            this.stage,
            this.instruction,
            this.createRunDraft
          );
          this.close();
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
