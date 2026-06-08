import {
  App,
  Editor,
  MarkdownFileInfo,
  TFile,
  normalizePath
} from "obsidian";
import type {
  AgentNotebookSettings,
  NotebookConfig,
  NotebookContext
} from "./types";

export function collectNotebookContext(
  app: App,
  editor: Editor | null,
  view: MarkdownFileInfo | null,
  settings: AgentNotebookSettings,
  targetFile?: TFile
): NotebookContext | null {
  const activeFile = targetFile ?? view?.file ?? app.workspace.getActiveFile();
  if (!activeFile) {
    return null;
  }

  const activeFilePath = activeFile.path;
  const activeFolderPath = folderPathForFile(activeFile);
  const selection = editor?.getSelection().trim() ?? "";
  const currentHeading = editor ? headingBeforeCursor(editor) : "";
  const notebook = resolveNotebookForPath(activeFilePath, settings.notebooks);

  return {
    vaultName: app.vault.getName(),
    vaultPath: getVaultPath(app),
    activeFilePath,
    activeFolderPath,
    currentHeading,
    selection,
    notebook
  };
}

export function folderPathForFile(file: TFile): string {
  return file.parent?.path && file.parent.path !== "/"
    ? normalizePath(file.parent.path)
    : "";
}

export function resolveNotebookForPath(
  filePath: string,
  notebooks: NotebookConfig[]
): NotebookConfig | null {
  const normalizedFilePath = normalizePath(filePath);
  const sorted = [...notebooks].sort(
    (a, b) => b.rootPath.length - a.rootPath.length
  );

  return (
    sorted.find((notebook) => {
      const rootPath = normalizePath(notebook.rootPath);
      return (
        normalizedFilePath === rootPath ||
        normalizedFilePath.startsWith(`${rootPath}/`)
      );
    }) ?? null
  );
}

function headingBeforeCursor(editor: Editor): string {
  const cursor = editor.getCursor();
  for (let line = cursor.line; line >= 0; line -= 1) {
    const text = editor.getLine(line).trim();
    const match = /^(#{1,6})\s+(.+)$/.exec(text);
    if (match) {
      return text;
    }
  }
  return "";
}

function getVaultPath(app: App): string {
  const adapter = app.vault.adapter;
  if ("getBasePath" in adapter && typeof adapter.getBasePath === "function") {
    return adapter.getBasePath();
  }
  return app.vault.getName();
}
