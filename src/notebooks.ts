import { normalizePath } from "obsidian";
import type { AgentNotebookSettings, NotebookConfig } from "./types";

export function upsertNotebook(
  settings: AgentNotebookSettings,
  rootPath: string,
  title: string
): NotebookConfig {
  const normalizedRoot = normalizePath(rootPath);
  const id = stableNotebookId(normalizedRoot);
  const notebook: NotebookConfig = {
    id,
    title: title.trim() || nameFromPath(normalizedRoot),
    rootPath: normalizedRoot
  };

  const index = settings.notebooks.findIndex((item) => item.id === id);
  if (index >= 0) {
    settings.notebooks[index] = notebook;
  } else {
    settings.notebooks.push(notebook);
  }

  settings.notebooks.sort((a, b) => a.rootPath.localeCompare(b.rootPath));
  return notebook;
}

export function nameFromPath(path: string): string {
  const normalized = normalizePath(path);
  if (!normalized) {
    return "Vault Root";
  }
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

function stableNotebookId(rootPath: string): string {
  return normalizePath(rootPath)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "vault-root";
}
