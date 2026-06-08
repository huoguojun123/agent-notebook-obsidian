import {
  Editor,
  MarkdownFileInfo,
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath
} from "obsidian";
import { collectNotebookContext } from "./context";
import { nameFromPath, upsertNotebook } from "./notebooks";
import { buildNotebookTaskPrompt } from "./prompt-builder";
import { createRunDraft } from "./run-log";
import type { AgentNotebookSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { NotebookModal } from "./ui/notebook-modal";
import { TaskModal } from "./ui/task-modal";

export default class AgentNotebookPlugin extends Plugin {
  settings: AgentNotebookSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

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
      onSubmit: async (stage, instruction, createDraft) => {
        const built = buildNotebookTaskPrompt({
          context,
          createRunDraft: createDraft,
          instruction,
          stage
        });

        await navigator.clipboard.writeText(built.prompt);

        if (createDraft) {
          const runPath = await createRunDraft(this.app.vault, context, built);
          new Notice(`Prompt 已复制，run 草稿已创建：${runPath}`);
        } else {
          new Notice("Prompt 已复制。");
        }
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
