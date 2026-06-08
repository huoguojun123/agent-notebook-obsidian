export type NotebookStage =
  | "ideate"
  | "outline"
  | "generate"
  | "study"
  | "optimize"
  | "supplement"
  | "review";

export interface NotebookConfig {
  id: string;
  title: string;
  rootPath: string;
}

export interface AgentNotebookSettings {
  notebooks: NotebookConfig[];
  createRunDraftByDefault: boolean;
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
  createRunDraftByDefault: true
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
