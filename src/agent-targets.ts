import type { App } from "obsidian";

interface ClaudeSidebarPlugin {
  sendTextToTerminal?: (text: string) => Promise<boolean> | boolean;
}

interface AppWithPluginRegistry extends App {
  plugins?: {
    plugins?: Record<string, unknown>;
  };
}

export async function sendToClaudeSidebar(
  app: App,
  text: string
): Promise<boolean> {
  const plugin = getClaudeSidebarPlugin(app);
  if (!plugin?.sendTextToTerminal) {
    return false;
  }

  return Boolean(await plugin.sendTextToTerminal(`${text.trimEnd()}\n`));
}

function getClaudeSidebarPlugin(app: App): ClaudeSidebarPlugin | null {
  const plugins = (app as AppWithPluginRegistry).plugins?.plugins;
  const plugin = plugins?.["claude-sidebar"];
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
