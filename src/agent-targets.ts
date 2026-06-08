import type { App, WorkspaceLeaf } from "obsidian";

const CLAUDE_SIDEBAR_PLUGIN_ID = "claude-sidebar";
const CLAUDE_SIDEBAR_VIEW_TYPE = "vault-terminal";
const leafTargetIds = new WeakMap<WorkspaceLeaf, string>();
let leafTargetSeq = 0;

interface ClaudeSidebarPlugin {
  lastActiveTerminalLeaf?: WorkspaceLeaf;
  sendTextToTerminal?: (text: string) => Promise<boolean> | boolean;
}

interface ClaudeSidebarView {
  hasOutput?: boolean;
  proc?: {
    killed?: boolean;
    stdin?: {
      write?: (text: string) => void;
    };
  };
  term?: {
    focus?: () => void;
  };
  workingDir?: string | null;
}

interface AppWithPluginRegistry extends App {
  plugins?: {
    plugins?: Record<string, unknown>;
  };
}

export interface AgentTarget {
  id: string;
  isActive: boolean;
  label: string;
}

export async function sendToClaudeSidebar(
  app: App,
  text: string,
  targetId?: string
): Promise<boolean> {
  if (targetId) {
    const sentToTarget = await sendToClaudeSidebarTarget(app, text, targetId);
    if (sentToTarget) {
      return true;
    }
  }

  const plugin = getClaudeSidebarPlugin(app);
  if (!plugin?.sendTextToTerminal) {
    return false;
  }

  return Boolean(await plugin.sendTextToTerminal(`${text.trimEnd()}\n`));
}

export function listClaudeSidebarTargets(app: App): AgentTarget[] {
  const leaves = app.workspace
    .getLeavesOfType(CLAUDE_SIDEBAR_VIEW_TYPE)
    .filter(isUsableClaudeSidebarLeaf);
  const plugin = getClaudeSidebarPlugin(app);
  const activeLeaf = plugin?.lastActiveTerminalLeaf;

  return leaves.map((leaf, index) => {
    const view = leaf.view as unknown as ClaudeSidebarView;
    const workingDir = view.workingDir || "Vault root";
    const status = view.proc && !view.proc.killed ? "ready" : "starting";
    const isActive = leaf === activeLeaf;
    return {
      id: targetIdForLeaf(leaf),
      isActive,
      label: `${isActive ? "最近使用 · " : ""}${index + 1}. ${shortenPath(
        workingDir
      )} (${status})`
    };
  });
}

export function resolveDefaultClaudeSidebarTargetId(
  app: App,
  preferredTargetId: string
): string {
  const targets = listClaudeSidebarTargets(app);
  if (targets.some((target) => target.id === preferredTargetId)) {
    return preferredTargetId;
  }
  return (
    targets.find((target) => target.isActive)?.id ||
    targets[0]?.id ||
    ""
  );
}

async function sendToClaudeSidebarTarget(
  app: App,
  text: string,
  targetId: string
): Promise<boolean> {
  const leaf = findClaudeSidebarLeaf(app, targetId);
  if (!leaf) {
    return false;
  }

  const view = leaf.view as unknown as ClaudeSidebarView;
  if (!view.proc || view.proc.killed || !view.proc.stdin?.write) {
    return false;
  }

  view.proc.stdin.write(`${text.trimEnd()}\n`);
  app.workspace.setActiveLeaf(leaf, { focus: true });
  view.term?.focus?.();
  return true;
}

function getClaudeSidebarPlugin(app: App): ClaudeSidebarPlugin | null {
  const plugins = (app as AppWithPluginRegistry).plugins?.plugins;
  const plugin = plugins?.[CLAUDE_SIDEBAR_PLUGIN_ID];
  return isClaudeSidebarPlugin(plugin) ? plugin : null;
}

function isClaudeSidebarPlugin(value: unknown): value is ClaudeSidebarPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "sendTextToTerminal" in value &&
    typeof (value as ClaudeSidebarPlugin).sendTextToTerminal === "function"
  );
}

function findClaudeSidebarLeaf(
  app: App,
  targetId: string
): WorkspaceLeaf | null {
  return (
    app.workspace
      .getLeavesOfType(CLAUDE_SIDEBAR_VIEW_TYPE)
      .filter(isUsableClaudeSidebarLeaf)
      .find((leaf) => targetIdForLeaf(leaf) === targetId) ?? null
  );
}

function isUsableClaudeSidebarLeaf(leaf: WorkspaceLeaf): boolean {
  const view = leaf.view as unknown as ClaudeSidebarView;
  const containerEl = leaf.view?.containerEl;
  return Boolean(
    containerEl?.isConnected &&
      view.proc &&
      !view.proc.killed &&
      view.proc.stdin?.write
  );
}

function targetIdForLeaf(leaf: WorkspaceLeaf): string {
  const existing = leafTargetIds.get(leaf);
  if (existing) {
    return existing;
  }
  leafTargetSeq += 1;
  const id = `claude-sidebar-${leafTargetSeq}`;
  leafTargetIds.set(leaf, id);
  return id;
}

function shortenPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) {
    return normalized || "Vault root";
  }
  return `.../${parts.slice(-2).join("/")}`;
}
