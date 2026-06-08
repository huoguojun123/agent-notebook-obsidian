import type { App, WorkspaceLeaf } from "obsidian";
import { execFile } from "child_process";

const CLAUDE_SIDEBAR_PLUGIN_ID = "claude-sidebar";
const CLAUDE_SIDEBAR_VIEW_TYPE = "vault-terminal";
const leafTargetIds = new WeakMap<WorkspaceLeaf, string>();
let leafTargetSeq = 0;

interface ClaudeSidebarPlugin {
  createNewTab?: (
    workingDir?: string | null,
    yoloMode?: boolean,
    continueSession?: boolean
  ) => Promise<void> | void;
  lastActiveTerminalLeaf?: WorkspaceLeaf;
  pluginData?: {
    cliBackend?: string;
    flagsByProvider?: Record<string, string>;
  };
  saveData?: (data: unknown) => Promise<void>;
  sendTextToTerminal?: (text: string) => Promise<boolean> | boolean;
}

interface ClaudeSidebarView {
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

export interface OpencodeSession {
  directory: string;
  id: string;
  title: string;
  updated: number;
}

export async function sendToClaudeSidebar(
  app: App,
  text: string,
  targetId?: string
): Promise<boolean> {
  if (targetId?.startsWith("open:")) {
    return sendToClaudeSidebarTarget(
      app,
      text,
      targetId.slice("open:".length)
    );
  }

  if (targetId?.startsWith("session:")) {
    const sessionId = targetId.slice("session:".length);
    const session = (await listOpencodeSessions(app)).find(
      (item) => item.id === sessionId
    );
    if (session) {
      return openOpencodeSessionInClaudeSidebar(app, session, text);
    }
    return false;
  }

  const openTargetId = resolveDefaultClaudeSidebarTargetId(
    app,
    "",
    listClaudeSidebarTargets(app)
  );
  if (openTargetId.startsWith("open:")) {
    return sendToClaudeSidebarTarget(
      app,
      text,
      openTargetId.slice("open:".length)
    );
  }
  return false;
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
    const status = view.proc && !view.proc.killed ? "就绪" : "启动中";
    const isActive = leaf === activeLeaf;
    return {
      id: `open:${targetIdForLeaf(leaf)}`,
      isActive,
      label: `${isActive ? "打开 · 当前 · " : "打开 · "}${index + 1}. ${shortenPath(
        workingDir
      )} (${status})`
    };
  });
}

export async function listAgentTargets(app: App): Promise<AgentTarget[]> {
  const openTargets = listClaudeSidebarTargets(app);
  let sessions: OpencodeSession[] = [];
  try {
    sessions = await listOpencodeSessions(app);
  } catch {
    return openTargets;
  }

  const sessionTargets = sessions.map((session, index) => ({
    id: `session:${session.id}`,
    isActive: false,
    label: `${index === 0 ? "最近 · " : ""}${sessionName(session)}`
  }));

  return [...sessionTargets, ...openTargets];
}

export async function listOpencodeSessions(
  app: App,
  maxCount?: number
): Promise<OpencodeSession[]> {
  const maxCountArg =
    typeof maxCount === "number" ? ` --max-count ${Math.max(1, maxCount)}` : "";
  const raw = await execShell(
    `opencode session list --format json${maxCountArg}`,
    getVaultPath(app)
  );
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map(normalizeSession)
    .filter((session): session is OpencodeSession => Boolean(session))
    .sort((a, b) => b.updated - a.updated);
}

export function resolveDefaultClaudeSidebarTargetId(
  app: App,
  preferredTargetId: string,
  targets = listClaudeSidebarTargets(app)
): string {
  if (targets.some((target) => target.id === preferredTargetId)) {
    return preferredTargetId;
  }
  return (
    targets.find((target) => target.id.startsWith("session:"))?.id ||
    targets.find((target) => target.isActive)?.id ||
    targets[0]?.id ||
    ""
  );
}

async function openOpencodeSessionInClaudeSidebar(
  app: App,
  session: OpencodeSession,
  text: string
): Promise<boolean> {
  const plugin = getClaudeSidebarPlugin(app);
  if (!plugin?.createNewTab || !plugin.pluginData) {
    return false;
  }

  const flagsByProvider = plugin.pluginData.flagsByProvider || {};
  const previousBackend = plugin.pluginData.cliBackend;
  const previousOpencodeFlags = flagsByProvider.opencode || "";
  const existingLeaves = new Set(
    app.workspace.getLeavesOfType(CLAUDE_SIDEBAR_VIEW_TYPE)
  );
  plugin.pluginData.flagsByProvider = flagsByProvider;
  plugin.pluginData.cliBackend = "opencode";
  flagsByProvider.opencode = [
    "--session",
    shellQuote(session.id),
    "--prompt",
    shellQuote(text.trimEnd())
  ]
    .filter(Boolean)
    .join(" ");

  await plugin.saveData?.(plugin.pluginData);

  try {
    await plugin.createNewTab(session.directory || null, false, false);
    await waitForNewClaudeSidebarProcess(app, existingLeaves);
    return true;
  } finally {
    if (previousOpencodeFlags) {
      flagsByProvider.opencode = previousOpencodeFlags;
    } else {
      delete flagsByProvider.opencode;
    }
    if (previousBackend) {
      plugin.pluginData.cliBackend = previousBackend;
    } else {
      delete plugin.pluginData.cliBackend;
    }
    await plugin.saveData?.(plugin.pluginData);
  }
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

function formatSessionUpdated(value: number): string {
  const date = new Date(value);
  if (!Number.isFinite(value) || Number.isNaN(date.getTime())) {
    return "时间未知";
  }
  const pad = (item: number) => item.toString().padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function sessionName(session: OpencodeSession): string {
  const title = session.title.trim();
  if (title) {
    return title;
  }
  const date = formatSessionUpdated(session.updated);
  return date === "时间未知" ? "未命名 session" : `未命名 session · ${date}`;
}

function execShell(command: string, cwd: string): Promise<string> {
  const shell = process.env.SHELL || "/bin/zsh";
  return new Promise((resolve, reject) => {
    execFile(
      shell,
      ["-lc", command],
      {
        cwd,
        timeout: 15000
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );
  });
}

function getVaultPath(app: App): string {
  const adapter = app.vault.adapter;
  if ("getBasePath" in adapter && typeof adapter.getBasePath === "function") {
    return adapter.getBasePath();
  }
  return app.vault.getName();
}

function normalizeSession(value: unknown): OpencodeSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string") {
    return null;
  }
  return {
    directory: typeof item.directory === "string" ? item.directory : "",
    id: item.id,
    title: typeof item.title === "string" ? item.title : "",
    updated: typeof item.updated === "number" ? item.updated : 0
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function waitForNewClaudeSidebarProcess(
  app: App,
  existingLeaves: Set<WorkspaceLeaf>
): Promise<void> {
  let newLeafSeenAt = 0;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const newLeaf = app.workspace
      .getLeavesOfType(CLAUDE_SIDEBAR_VIEW_TYPE)
      .find((leaf) => !existingLeaves.has(leaf));
    const view = newLeaf?.view as ClaudeSidebarView | undefined;
    if (view?.proc) {
      return;
    }
    if (newLeaf && !newLeafSeenAt) {
      newLeafSeenAt = Date.now();
    }
    if (newLeafSeenAt && Date.now() - newLeafSeenAt > 1200) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}
