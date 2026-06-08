import { normalizePath, TFolder, Vault } from "obsidian";
import type { BuiltPrompt, NotebookContext } from "./types";

export async function createRunDraft(
  vault: Vault,
  context: NotebookContext,
  built: BuiltPrompt
): Promise<string> {
  const rootPath = normalizePath(
    context.notebook?.rootPath || context.activeFolderPath
  );
  const runFolderPath = normalizePath(
    rootPath ? `${rootPath}/_agent-runs` : "_agent-runs"
  );

  await ensureFolder(vault, runFolderPath);

  const basePath = normalizePath(`${runFolderPath}/${built.runFileName}`);
  const path = await nextAvailablePath(vault, basePath);
  await vault.create(path, built.runContent);
  return path;
}

async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  const existing = vault.getAbstractFileByPath(folderPath);
  if (existing instanceof TFolder) {
    return;
  }

  const parts = folderPath.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current);
    }
  }
}

async function nextAvailablePath(vault: Vault, path: string): Promise<string> {
  if (!vault.getAbstractFileByPath(path)) {
    return path;
  }

  const dotIndex = path.lastIndexOf(".");
  const base = dotIndex >= 0 ? path.slice(0, dotIndex) : path;
  const extension = dotIndex >= 0 ? path.slice(dotIndex) : "";

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}${extension}`;
    if (!vault.getAbstractFileByPath(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not create a unique run log path.");
}
