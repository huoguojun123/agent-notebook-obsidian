import {
  Editor,
  MarkdownFileInfo,
  Notice,
  Plugin,
  TFile,
  TFolder,
  WorkspaceLeaf,
  normalizePath
} from "obsidian";
import {
  resolveDefaultClaudeSidebarTargetId,
  sendToClaudeSidebar
} from "./agent-targets";
import { collectNotebookContext } from "./context";
import { nameFromPath, upsertNotebook } from "./notebooks";
import { buildNotebookTaskPrompt } from "./prompt-builder";
import { createRunDraft } from "./run-log";
import type { AgentNotebookSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { NotebookModal } from "./ui/notebook-modal";
import {
  AGENT_NOTEBOOK_VIEW_TYPE,
  AgentNotebookView
} from "./ui/notebook-view";
import { TaskModal } from "./ui/task-modal";

export default class AgentNotebookPlugin extends Plugin {
  settings: AgentNotebookSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      AGENT_NOTEBOOK_VIEW_TYPE,
      (leaf) => new AgentNotebookView(leaf, this)
    );

    this.addRibbonIcon("sparkles", "Open Agent Notebook", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-agent-notebook-view",
      name: "Open Agent Notebook panel",
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: "mark-current-folder-as-notebook",
      name: "Mark current folder as notebook",
      editorCallback: (_editor: Editor, view: MarkdownFileInfo) => {
        this.openMarkNotebookModal(folderPathFromView(view));
      }
    });

    this.addCommand({
      id: "create-notebook-task-prompt",
      name: "Create notebook task prompt",
      editorCallback: (editor: Editor, view: MarkdownFileInfo) => {
        this.openTaskModal(editor, view);
      }
    });

    this.addCommand({
      id: "create-notebook-task-prompt-without-editor",
      name: "Create notebook task prompt from active file",
      callback: () => {
        this.openTaskModal(null, null);
      }
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("标记为 Agent Notebook")
              .setIcon("book-open")
              .onClick(() => this.openMarkNotebookModal(file.path));
          });
        }
        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item
              .setTitle("创建 Agent Notebook 任务")
              .setIcon("sparkles")
              .onClick(() => this.openTaskModal(null, null, file));
          });
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        menu.addItem((item) => {
          item
            .setTitle("用 Agent Notebook 处理当前内容")
            .setIcon("sparkles")
            .onClick(() => this.openTaskModal(editor, view));
        });
      })
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(AGENT_NOTEBOOK_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("无法打开 Agent Notebook 面板。");
        return;
      }
      await leaf.setViewState({
        active: true,
        type: AGENT_NOTEBOOK_VIEW_TYPE
      });
    }

    workspace.revealLeaf(leaf);
  }

  private openMarkNotebookModal(rootPath: string): void {
    const normalizedRoot = normalizePath(rootPath);
    new NotebookModal(this.app, {
      defaultTitle: nameFromPath(normalizedRoot),
      rootPath: normalizedRoot,
      onSubmit: async (title) => {
        const notebook = upsertNotebook(this.settings, normalizedRoot, title);
        await this.saveSettings();
        new Notice(`已标记 Notebook：${notebook.title}`);
      }
    }).open();
  }

  private openTaskModal(
    editor: Editor | null,
    view: MarkdownFileInfo | null,
    targetFile?: TFile
  ): void {
    const context = collectNotebookContext(
      this.app,
      editor,
      view,
      this.settings,
      targetFile
    );
    if (!context) {
      new Notice("请先打开一个 Markdown 文件。");
      return;
    }

    const notebookTitle =
      context.notebook?.title || nameFromPath(context.activeFolderPath);

    new TaskModal(this.app, {
      createRunDraftByDefault: this.settings.createRunDraftByDefault,
      notebookTitle,
      onSubmit: async (
        stage,
        scope,
        nonFocusPolicy,
        instruction,
        createDraft
      ) => {
        const built = buildNotebookTaskPrompt({
          context,
          createRunDraft: createDraft,
          instruction,
          nonFocusPolicy,
          scope,
          stage
        });

        let runPath = "";

        if (createDraft) {
          runPath = await createRunDraft(this.app.vault, context, built);
        }

        const targetId = resolveDefaultClaudeSidebarTargetId(
          this.app,
          this.settings.lastClaudeSidebarTargetId
        );
        const sent = this.settings.sendToClaudeSidebarByDefault
          ? await sendToClaudeSidebar(this.app, built.prompt, targetId)
          : false;

        if (sent) {
          this.settings.lastClaudeSidebarTargetId = targetId;
          await this.saveSettings();
          new Notice(runPath ? `任务已发送，run 草稿已创建：${runPath}` : "任务已发送。");
          return;
        }

        await navigator.clipboard.writeText(built.prompt);
        new Notice(
          runPath
            ? `未能发送到 Sidebar；Prompt 已复制，run 草稿已创建：${runPath}`
            : "Prompt 已复制。"
        );
      }
    }).open();
  }
}

function folderPathFromView(view: MarkdownFileInfo): string {
  const file = view.file;
  if (!file) {
    return "";
  }
  return file.parent?.path && file.parent.path !== "/"
    ? normalizePath(file.parent.path)
    : "";
}
