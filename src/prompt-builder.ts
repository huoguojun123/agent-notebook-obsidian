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
    "# Agent Notebook Task",
    "",
    "你正在通过 opencode 工作流处理一个 Obsidian notebook。请像文件工作流中的 agent 一样行动：先理解上下文，再给出判断，最后只做与任务边界匹配的改动。",
    "",
    "## Context",
    `Vault: ${context.vaultName}`,
    `Vault path: ${context.vaultPath}`,
    `Notebook: ${notebookTitle}`,
    `Notebook root: ${notebookRoot || "."}`,
    `Active file: ${context.activeFilePath}`,
    `Current heading: ${context.currentHeading || "未定位到标题"}`,
    `Stage: ${stageLabel}`,
    `Scope: ${scopeLabel}`,
    `Non-focus policy: ${nonFocusPolicyLabel}`,
    "",
    "## User intent",
    instruction.trim(),
    "",
    "## Focus",
    fenced(selectionBlock),
    "",
    "## Stage protocol",
    ...stageProtocol(stage),
    "",
    "## Boundaries",
    `- 本次任务范围是“${scopeLabel}”；不要把工作扩展成无边界的全库整理。`,
    `- 焦点内容可以按用户要求处理；非焦点内容按“${nonFocusPolicyLabel}”处理。`,
    "- 删除、移动、大规模重构必须先明确询问用户。",
    "- 保持 Obsidian 双链、相对路径、标题层级和 Markdown 可读性。",
    "- 如果需要新建文件夹或 Markdown 文件，先确保位置符合 notebook 结构，并在结果中列出清单。",
    `- 完成后更新或创建 _agent-runs/${runFileName}，记录目标、范围、改动、建议和下一步。`,
    "",
    "## Response style",
    "- 先给结论，再给改动清单和下一步。",
    "- 不要堆砌工具调用过程。",
    "- 如果用户意图仍然模糊，先给 2-3 个可选方向和你建议的默认方向。"
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
    "````text",
    input.prompt,
    "````",
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

function stageProtocol(stage: string): string[] {
  const protocols: Record<string, string[]> = {
    ideate: [
      "- 先判断这个 notebook 当前最值得解决的问题是什么。",
      "- 给出 2-3 个可行方向，并说明取舍。",
      "- 默认只输出建议和下一步，除非用户明确要求你直接改文件。"
    ],
    outline: [
      "- 先检查现有结构是否能承载目标。",
      "- 给出清晰的大纲层级、文件组织建议和必要的新建文件清单。",
      "- 可以补充导航或索引，但避免过早写长正文。"
    ],
    generate: [
      "- 先确认要生成的内容位置和标题层级。",
      "- 生成内容要能直接作为 Obsidian Markdown 阅读和继续维护。",
      "- 生成后列出新增或修改的文件。"
    ],
    study: [
      "- 以学习者视角解释内容，优先补足概念、例子和路径。",
      "- 标出卡住点、先修知识和下一步学习动作。",
      "- 避免把学习笔记写成泛泛百科。"
    ],
    optimize: [
      "- 先识别结构、表达、重复、缺口和阅读顺序问题。",
      "- 优先做小而清晰的改动。",
      "- 对非焦点内容保持克制，按非焦点策略处理。"
    ],
    supplement: [
      "- 先找出现有内容缺口。",
      "- 补充内容要贴合当前 notebook 的结构和语气。",
      "- 必要时给出可继续扩展的链接或占位标题。"
    ],
    review: [
      "- 先总结当前状态和已完成内容。",
      "- 找出问题、风险、遗漏和下一步。",
      "- 输出应方便用户快速恢复上下文。"
    ]
  };

  return protocols[stage] ?? protocols.optimize;
}

function truncateBlock(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}\n\n...（选区过长，已截断；执行时请以 Obsidian 当前选区为准）`;
}
