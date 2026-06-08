export type NotebookStage =
  | "ideate"
  | "outline"
  | "generate"
  | "study"
  | "optimize"
  | "supplement"
  | "review";

export type NotebookTaskScope =
  | "selection"
  | "heading"
  | "file"
  | "notebook";

export type NonFocusPolicy = "suggest" | "ask" | "allow";

export interface NotebookConfig {
  id: string;
  title: string;
  rootPath: string;
}

export interface AgentNotebookSettings {
  notebooks: NotebookConfig[];
  createRunDraftByDefault: boolean;
  lastClaudeSidebarTargetId: string;
  sendToClaudeSidebarByDefault: boolean;
}

export interface NotebookContext {
  vaultName: string;
  vaultPath: string;
  activeFilePath: string;
  activeFolderPath: string;
  currentHeading: string;
  selection: string;
  notebook: NotebookConfig | null;
}

export interface NotebookTaskInput {
  context: NotebookContext;
  stage: NotebookStage;
  scope: NotebookTaskScope;
  nonFocusPolicy: NonFocusPolicy;
  instruction: string;
  createRunDraft: boolean;
}

export interface BuiltPrompt {
  prompt: string;
  runFileName: string;
  runContent: string;
}

export const DEFAULT_SETTINGS: AgentNotebookSettings = {
  notebooks: [],
  createRunDraftByDefault: true,
  lastClaudeSidebarTargetId: "",
  sendToClaudeSidebarByDefault: true
};

export const STAGE_LABELS: Record<NotebookStage, string> = {
  ideate: "构思",
  outline: "大纲",
  generate: "生成",
  study: "学习",
  optimize: "优化",
  supplement: "补充",
  review: "复盘"
};

export const SCOPE_LABELS: Record<NotebookTaskScope, string> = {
  selection: "当前选区",
  heading: "当前标题",
  file: "当前文件",
  notebook: "整个 Notebook"
};

export const NON_FOCUS_POLICY_LABELS: Record<NonFocusPolicy, string> = {
  suggest: "非焦点只提建议",
  ask: "修改非焦点前先问",
  allow: "允许联动修改"
};
