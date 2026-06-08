import {
  ButtonComponent,
  DropdownComponent,
  ItemView,
  MarkdownView,
  Notice,
  ToggleComponent,
  WorkspaceLeaf
} from "obsidian";
import { collectNotebookContext } from "../context";
import { nameFromPath, upsertNotebook } from "../notebooks";
import { buildNotebookTaskPrompt } from "../prompt-builder";
import { createRunDraft as writeRunDraft } from "../run-log";
import type AgentNotebookPlugin from "../main";
import type {
  NonFocusPolicy,
  NotebookContext,
  NotebookStage,
  NotebookTaskScope
} from "../types";
import {
  NON_FOCUS_POLICY_LABELS,
  SCOPE_LABELS,
  STAGE_LABELS
} from "../types";
import {
  listClaudeSidebarTargets,
  resolveDefaultClaudeSidebarTargetId,
  sendToClaudeSidebar
} from "../agent-targets";

export const AGENT_NOTEBOOK_VIEW_TYPE = "agent-notebook-view";

const STAGES = Object.keys(STAGE_LABELS) as NotebookStage[];
const SCOPES = Object.keys(SCOPE_LABELS) as NotebookTaskScope[];
const NON_FOCUS_POLICIES = Object.keys(
  NON_FOCUS_POLICY_LABELS
) as NonFocusPolicy[];

export class AgentNotebookView extends ItemView {
  private createRunDraft = true;
  private instruction = "";
  private nonFocusPolicy: NonFocusPolicy = "suggest";
  private readonly plugin: AgentNotebookPlugin;
  private selectedTargetId = "";
  private sendToSidebar = true;
  private stage: NotebookStage = "optimize";
  private taskScope: NotebookTaskScope = "selection";

  constructor(leaf: WorkspaceLeaf, plugin: AgentNotebookPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "sparkles";
    this.navigation = false;
    this.createRunDraft = plugin.settings.createRunDraftByDefault;
    this.selectedTargetId = plugin.settings.lastClaudeSidebarTargetId;
    this.sendToSidebar = plugin.settings.sendToClaudeSidebarByDefault;
  }

  getViewType(): string {
    return AGENT_NOTEBOOK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Agent Notebook";
  }

  async onOpen(): Promise<void> {
    this.render();
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.render())
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", () => this.renderContextOnly())
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.render())
    );
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    const context = this.collectContext();
    contentEl.empty();
    contentEl.addClass("agent-notebook-view");

    const header = contentEl.createDiv("agent-notebook-view__header");
    header.createDiv({
      cls: "agent-notebook-eyebrow",
      text: "Agent Notebook"
    });
    header.createEl("h2", { text: context?.notebook?.title || "未标记 Notebook" });
    header.createEl("p", {
      text: context
        ? "把当前笔记上下文整理成可直接交给 opencode 的任务。"
        : "打开一个 Markdown 文件后开始。"
    });

    const contextEl = contentEl.createDiv("agent-notebook-context");
    this.renderContext(contextEl, context);

    if (!context) {
      return;
    }

    const formEl = contentEl.createDiv("agent-notebook-form");
    this.renderControls(formEl);
    this.renderInstruction(formEl);
    this.renderActions(formEl, context);
  }

  private renderContextOnly(): void {
    const contextEl = this.contentEl.querySelector(".agent-notebook-context");
    if (contextEl instanceof HTMLElement) {
      contextEl.empty();
      this.renderContext(contextEl, this.collectContext());
    }
  }

  private renderContext(container: HTMLElement, context: NotebookContext | null): void {
    if (!context) {
      container.createDiv({
        cls: "agent-notebook-empty",
        text: "没有可用上下文。请先打开一个 Markdown 文件。"
      });
      return;
    }

    const notebookRoot = context.notebook?.rootPath || context.activeFolderPath || ".";
    const rows = [
      ["Vault", context.vaultName],
      ["Notebook", context.notebook?.title || nameFromPath(notebookRoot)],
      ["Root", notebookRoot],
      ["File", context.activeFilePath],
      ["Heading", context.currentHeading || "未定位到标题"],
      ["Selection", context.selection ? `${context.selection.length} 字符` : "无"]
    ];

    for (const [label, value] of rows) {
      const row = container.createDiv("agent-notebook-context__row");
      row.createSpan({ cls: "agent-notebook-context__label", text: label });
      row.createSpan({ cls: "agent-notebook-context__value", text: value });
    }
  }

  private renderControls(container: HTMLElement): void {
    this.renderDropdownControl(container, "阶段", (dropdown) => {
      for (const stage of STAGES) {
        dropdown.addOption(stage, STAGE_LABELS[stage]);
      }
      dropdown.setValue(this.stage).onChange((value) => {
        this.stage = value as NotebookStage;
      });
    });

    this.renderDropdownControl(container, "范围", (dropdown) => {
      for (const scope of SCOPES) {
        dropdown.addOption(scope, SCOPE_LABELS[scope]);
      }
      dropdown.setValue(this.taskScope).onChange((value) => {
        this.taskScope = value as NotebookTaskScope;
      });
    });

    this.renderDropdownControl(container, "非焦点", (dropdown) => {
      for (const policy of NON_FOCUS_POLICIES) {
        dropdown.addOption(policy, NON_FOCUS_POLICY_LABELS[policy]);
      }
      dropdown.setValue(this.nonFocusPolicy).onChange((value) => {
        this.nonFocusPolicy = value as NonFocusPolicy;
      });
    });

    this.renderToggleControl(container, "Run", (toggle) => {
      toggle.setValue(this.createRunDraft).onChange((value) => {
        this.createRunDraft = value;
      });
    });

    this.renderToggleControl(container, "Sidebar", (toggle) => {
      toggle.setValue(this.sendToSidebar).onChange((value) => {
        this.sendToSidebar = value;
      });
    });

    this.renderTargetControl(container);
  }

  private renderTargetControl(container: HTMLElement): void {
    const targets = listClaudeSidebarTargets(this.app);
    this.selectedTargetId = resolveDefaultClaudeSidebarTargetId(
      this.app,
      this.selectedTargetId || this.plugin.settings.lastClaudeSidebarTargetId
    );

    this.renderDropdownControl(
      container,
      "Session",
      (dropdown) => {
        dropdown.addOption("", targets.length ? "最近使用" : "自动");

        for (const target of targets) {
          dropdown.addOption(target.id, target.label);
        }

        dropdown.setValue(this.selectedTargetId);
        dropdown.onChange(async (value) => {
          this.selectedTargetId = value;
          this.plugin.settings.lastClaudeSidebarTargetId = value;
          await this.plugin.saveSettings();
        });
      },
      targets.length ? "" : "未检测到打开的 Sidebar session"
    );
  }

  private renderDropdownControl(
    container: HTMLElement,
    label: string,
    configure: (dropdown: DropdownComponent) => void,
    hint = ""
  ): void {
    const row = container.createDiv("agent-notebook-control");
    const labelEl = row.createDiv("agent-notebook-control__label");
    labelEl.setText(label);
    const field = row.createDiv("agent-notebook-control__field");
    const dropdown = new DropdownComponent(field);
    configure(dropdown);
    if (hint) {
      row.createDiv({ cls: "agent-notebook-control__hint", text: hint });
    }
  }

  private renderToggleControl(
    container: HTMLElement,
    label: string,
    configure: (toggle: ToggleComponent) => void
  ): void {
    const row = container.createDiv("agent-notebook-control");
    row.createDiv({ cls: "agent-notebook-control__label", text: label });
    const field = row.createDiv("agent-notebook-control__field");
    const toggle = new ToggleComponent(field);
    configure(toggle);
  }

  private renderInstruction(container: HTMLElement): void {
    const wrapper = container.createDiv("agent-notebook-instruction");
    wrapper.createEl("label", { text: "要求" });
    const textarea = wrapper.createEl("textarea", {
      attr: {
        placeholder:
          "例如：按零基础学习者视角优化当前章节结构，非当前文件只提出建议。"
      }
    });
    textarea.value = this.instruction;
    textarea.addEventListener("input", () => {
      this.instruction = textarea.value;
    });
  }

  private renderActions(container: HTMLElement, context: NotebookContext): void {
    const actions = container.createDiv("agent-notebook-actions");

    new ButtonComponent(actions)
      .setButtonText("标记当前文件夹")
      .setTooltip("把当前文件所在文件夹标记为 Agent Notebook")
      .onClick(async () => {
        const notebook = upsertNotebook(
          this.plugin.settings,
          context.activeFolderPath,
          nameFromPath(context.activeFolderPath)
        );
        await this.plugin.saveSettings();
        new Notice(`已标记 Notebook：${notebook.title}`);
        this.render();
      });

    new ButtonComponent(actions)
      .setButtonText("发送任务")
      .setCta()
      .onClick(async () => {
        await this.buildAndDispatch(
          context,
          this.createRunDraft,
          this.sendToSidebar
        );
      });

    new ButtonComponent(actions)
      .setButtonText("只复制")
      .onClick(async () => {
        await this.buildAndDispatch(context, false, false);
      });
  }

  private async buildAndDispatch(
    context: NotebookContext,
    shouldCreateDraft: boolean,
    shouldSendToSidebar: boolean
  ): Promise<void> {
    if (!this.instruction.trim()) {
      new Notice("请先填写任务要求。");
      return;
    }

    const built = buildNotebookTaskPrompt({
      context,
      createRunDraft: shouldCreateDraft,
      instruction: this.instruction,
      nonFocusPolicy: this.nonFocusPolicy,
      scope: this.taskScope,
      stage: this.stage
    });

    let runPath = "";
    if (shouldCreateDraft) {
      runPath = await writeRunDraft(this.app.vault, context, built);
    }

    if (shouldSendToSidebar) {
      const targetId = resolveDefaultClaudeSidebarTargetId(
        this.app,
        this.selectedTargetId || this.plugin.settings.lastClaudeSidebarTargetId
      );
      const sent = await sendToClaudeSidebar(this.app, built.prompt, targetId);
      if (sent) {
        this.selectedTargetId = targetId;
        this.plugin.settings.lastClaudeSidebarTargetId = targetId;
        await this.plugin.saveSettings();
        new Notice(runPath ? `任务已发送，run 草稿已创建：${runPath}` : "任务已发送。");
        return;
      }
    }

    await navigator.clipboard.writeText(built.prompt);
    new Notice(
      runPath
        ? `未能发送到 Sidebar；Prompt 已复制，run 草稿已创建：${runPath}`
        : "Prompt 已复制。"
    );
  }

  private collectContext(): NotebookContext | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = markdownView?.file ?? this.app.workspace.getActiveFile();
    return collectNotebookContext(
      this.app,
      markdownView?.editor ?? null,
      markdownView ?? null,
      this.plugin.settings,
      file ?? undefined
    );
  }
}
