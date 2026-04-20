const STORAGE_KEY = "md2wechat.workbench";

export type PreviewMode = "preview" | "html";

export type WorkbenchState = {
  selectedArticleId: string;
  selectedTemplateId: string;
  previewMode: PreviewMode;
};

const defaultWorkbenchState: WorkbenchState = {
  selectedArticleId: "",
  selectedTemplateId: "default-light",
  previewMode: "preview"
};

export function readWorkbenchState(): WorkbenchState {
  if (typeof window === "undefined") {
    return defaultWorkbenchState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultWorkbenchState;
    }

    const parsed = JSON.parse(raw) as Partial<WorkbenchState>;
    return {
      selectedArticleId: parsed.selectedArticleId ?? defaultWorkbenchState.selectedArticleId,
      selectedTemplateId: parsed.selectedTemplateId ?? defaultWorkbenchState.selectedTemplateId,
      previewMode: parsed.previewMode ?? defaultWorkbenchState.previewMode
    };
  } catch {
    return defaultWorkbenchState;
  }
}

export function writeWorkbenchState(patch: Partial<WorkbenchState>): WorkbenchState {
  const nextState = {
    ...readWorkbenchState(),
    ...patch
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  return nextState;
}
