import { App, Modal, Notice, Setting } from "obsidian";
import type {
  NonFocusPolicy,
  NotebookStage,
  NotebookTaskScope
} from "../types";
import {
  NON_FOCUS_POLICY_LABELS,
  SCOPE_LABELS,
  STAGE_LABELS
} from "../types";

interface TaskModalOptions {
  createRunDraftByDefault: boolean;
  notebookTitle: string;
  onSubmit: (
    stage: NotebookStage,
    scope: NotebookTaskScope,
    nonFocusPolicy: NonFocusPolicy,
    instruction: string,
    createRunDraft: boolean
  ) => void | Promise<void>;
}

const STAGES = Object.keys(STAGE_LABELS) as NotebookStage[];
const SCOPES = Object.keys(SCOPE_LABELS) as NotebookTaskScope[];
const NON_FOCUS_POLICIES = Object.keys(
  NON_FOCUS_POLICY_LABELS
) as NonFocusPolicy[];

export class TaskModal extends Modal {
  private createRunDraft: boolean;
  private instruction = "";
  private readonly options: TaskModalOptions;
  private nonFocusPolicy: NonFocusPolicy = "suggest";
  private stage: NotebookStage = "optimize";
  private taskScope: NotebookTaskScope = "selection";

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

    new Setting(contentEl).setName("范围").addDropdown((dropdown) => {
      for (const scope of SCOPES) {
        dropdown.addOption(scope, SCOPE_LABELS[scope]);
      }
      dropdown.setValue(this.taskScope).onChange((value) => {
        this.taskScope = value as NotebookTaskScope;
      });
    });

    new Setting(contentEl).setName("非焦点").addDropdown((dropdown) => {
      for (const policy of NON_FOCUS_POLICIES) {
        dropdown.addOption(policy, NON_FOCUS_POLICY_LABELS[policy]);
      }
      dropdown.setValue(this.nonFocusPolicy).onChange((value) => {
        this.nonFocusPolicy = value as NonFocusPolicy;
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
            this.taskScope,
            this.nonFocusPolicy,
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
