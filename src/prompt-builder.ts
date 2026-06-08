import { normalizePath } from "obsidian";
import type { BuiltPrompt, NotebookTaskInput } from "./types";
import {
  NON_FOCUS_POLICY_LABELS,
  SCOPE_LABELS,
  STAGE_LABELS
} from "./types";
import { nameFromPath } from "./notebooks";

export function buildNotebookTaskPrompt(input: NotebookTaskInput): BuiltPrompt {
  const { context, stage, instruction } = input;
  const stageLabel = STAGE_LABELS[stage];
  const scopeLabel = SCOPE_LABELS[input.scope];
  const nonFocusPolicyLabel = NON_FOCUS_POLICY_LABELS[input.nonFocusPolicy];
  const notebookTitle =
    context.notebook?.title || nameFromPath(context.activeFolderPath);
  const notebookRoot = normalizePath(
    context.notebook?.rootPath || context.activeFolderPath
  );
  const selectionBlock = context.selection
    ? truncateBlock(context.selection, 2200)
    : "无选区。请以当前文件和当前标题作为焦点。";
  const runFileName = buildRunFileName(stage);

  const prompt = [
    "你正在通过 opencode 工作流处理一个 Obsidian notebook。",
    "请按文件工作流执行，不要按普通聊天模式泛泛回答。",
    "",
    "工作范围：",
    `- Vault: ${context.vaultName}`,
    `- Vault path: ${context.vaultPath}`,
    `- Notebook: ${notebookTitle}`,
    `- Notebook root: ${notebookRoot || "."}`,
    `- Active file: ${context.activeFilePath}`,
    `- Current heading: ${context.currentHeading || "未定位到标题"}`,
    "",
    "焦点内容：",
    fenced(selectionBlock),
    "",
    `任务阶段：${stageLabel}`,
    `任务范围：${scopeLabel}`,
    `非焦点策略：${nonFocusPolicyLabel}`,
    "",
    "用户要求：",
    instruction.trim(),
    "",
    "执行规则：",
    "1. 先快速检查 notebook 结构和与焦点内容最相关的文件，再决定改动。",
    `2. 本次任务范围是“${scopeLabel}”；不要把工作扩展成无边界的全库整理。`,
    `3. 焦点内容可以按任务要求修改；非焦点内容按“${nonFocusPolicyLabel}”处理。`,
    "4. 可以在合适位置新建文件夹和 Markdown 文件，但需列出清单。",
    "5. 删除、移动、大规模重构必须先明确询问用户。",
    "6. 保持 Obsidian 双链、相对路径、标题层级和 Markdown 可读性。",
    `7. 完成后更新或创建 _agent-runs/${runFileName}，记录目标、范围、改动、建议和下一步。`,
    "8. 输出时先给结论，再给改动清单和下一步，不要堆砌工具调用过程。"
  ].join("\n");

  return {
    prompt,
    runFileName,
    runContent: buildRunContent({
      activeFile: context.activeFilePath,
      currentHeading: context.currentHeading,
      instruction,
      nonFocusPolicyLabel,
      notebookRoot,
      notebookTitle,
      prompt,
      scopeLabel,
      stageLabel
    })
  };
}

function buildRunContent(input: {
  activeFile: string;
  currentHeading: string;
  instruction: string;
  nonFocusPolicyLabel: string;
  notebookRoot: string;
  notebookTitle: string;
  prompt: string;
  scopeLabel: string;
  stageLabel: string;
}): string {
  return [
    `# ${input.stageLabel} · ${input.notebookTitle}`,
    "",
    "## 目标",
    "",
    input.instruction.trim(),
    "",
    "## 范围",
    "",
    `- Notebook: ${input.notebookTitle}`,
    `- Root: \`${input.notebookRoot || "."}\``,
    `- Active file: \`${input.activeFile}\``,
    `- Heading: ${input.currentHeading || "未定位到标题"}`,
    `- Scope: ${input.scopeLabel}`,
    `- Non-focus policy: ${input.nonFocusPolicyLabel}`,
    "",
    "## Prompt",
    "",
    "```text",
    input.prompt,
    "```",
    "",
    "## 执行结果",
    "",
    "- 待填写",
    "",
    "## 修改文件",
    "",
    "- 待填写",
    "",
    "## 非焦点建议",
    "",
    "- 待填写",
    "",
    "## 下一步",
    "",
    "- 待填写",
    ""
  ].join("\n");
}

function buildRunFileName(stage: string): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-");
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${stamp}-${time}-${stage}.md`;
}

function fenced(value: string): string {
  return ["```markdown", value, "```"].join("\n");
}

function truncateBlock(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}\n\n...（选区过长，已截断；执行时请以 Obsidian 当前选区为准）`;
}
