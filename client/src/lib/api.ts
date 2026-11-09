import type {
  ArticleDetail,
  ArticleSummary,
  PublishAccount,
  PublishLoginProbe,
  PublishTask,
  TemplateSummary
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export const FALLBACK_TEMPLATES: TemplateSummary[] = [
  {
    id: "claude",
    name: "Claude",
    description: "Anthropic's AI assistant. Warm terracotta accent, clean editorial layout."
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Enterprise AI platform. Vibrant gradients, data-rich dashboard aesthetic."
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "AI voice platform. Dark cinematic UI, audio-waveform aesthetics."
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "AI model provider. Bold dark interface with neon accents."
  },
  {
    id: "mistral-ai",
    name: "Mistral AI",
    description: "Open-weight LLM provider. French-engineered minimalism, purple-toned."
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Run LLMs locally. Terminal-first, monochrome simplicity."
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Run ML models via API. Clean white canvas, code-forward."
  },
  {
    id: "together-ai",
    name: "Together AI",
    description: "Open-source AI infrastructure. Technical, blueprint-style design."
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Music streaming. Vibrant green on dark, bold type, album-art-driven."
  },
  {
    id: "ferrari",
    name: "Ferrari",
    description: "Luxury automotive. Chiaroscuro editorial, Ferrari Red accents, cinematic black."
  },
  {
    id: "playstation",
    name: "PlayStation",
    description: "Gaming console retail. Three-surface channel layout, cyan hover-scale."
  },
  {
    id: "nike",
    name: "Nike",
    description: "Athletic retail. Monochrome UI, massive uppercase type, full-bleed photography."
  }
];

function buildApiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export function buildStoredAssetUrl(storageKey: string | null): string | null {
  if (!storageKey) {
    return null;
  }

  return buildApiUrl(`/data/${storageKey.replace(/\\/g, "/")}`);
}

export function buildDataFileUrl(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const dataMarkerIndex = normalizedPath.toLowerCase().indexOf("/data/");
  if (dataMarkerIndex === -1) {
    return null;
  }

  const relativePath = normalizedPath
    .slice(dataMarkerIndex + "/data/".length)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return buildApiUrl(`/data/${relativePath}`);
}

export function buildArticleAssetUrl(input: {
  storageKey: string | null;
  localPath: string | null;
}): string | null {
  return buildStoredAssetUrl(input.storageKey) ?? buildDataFileUrl(input.localPath);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(text || "服务返回了非 JSON 响应。");
  }

  return JSON.parse(text) as T;
}

export async function getArticles(): Promise<ArticleSummary[]> {
  const response = await fetch(buildApiUrl("/api/articles"));
  if (!response.ok) {
    throw new Error(`文章列表加载失败：HTTP ${response.status}`);
  }

  const data = await parseJsonResponse<{ items: ArticleSummary[] }>(response);
  return data.items;
}

export async function getDefaultPreviewArticle(): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/articles/default-preview"));
  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "默认预览文章加载失败。");
  }

  return payload;
}

export async function getTemplates(): Promise<TemplateSummary[]> {
  const response = await fetch(buildApiUrl("/api/templates"));
  if (!response.ok) {
    throw new Error(`模板列表加载失败：HTTP ${response.status}`);
  }

  const data = await parseJsonResponse<{ items: TemplateSummary[] }>(response);
  return data.items.map(({ id, name, description }) => ({ id, name, description }));
}

export async function getArticle(articleId: string): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl(`/api/articles/${articleId}`));
  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);

  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "文章详情加载失败。");
  }

  return payload;
}

export async function uploadArticle(file: File): Promise<ArticleSummary> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(buildApiUrl("/api/articles/upload"), {
    method: "POST",
    body: formData
  });

  const payload = await parseJsonResponse<ArticleSummary | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "上传失败。");
  }

  return payload;
}

export async function uploadArticleAsset(input: {
  articleId: string;
  kind: "cover" | "body";
  file: File;
  slotId?: string;
}): Promise<ArticleDetail> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);
  if (input.slotId) {
    formData.append("slotId", input.slotId);
  }

  const response = await fetch(buildApiUrl(`/api/articles/${input.articleId}/assets`), {
    method: "POST",
    body: formData
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "素材上传失败。");
  }

  return payload;
}

export async function renderArticle(
  articleId: string,
  templateId: string,
  customOptions?: {
    fontSize?: string;
    lineHeight?: string;
    paragraphIndent?: boolean;
    paragraphMargin?: string;
    sectionDivider?: string;
    endMarker?: string;
    platformName?: string;
    originalChecked?: boolean;
  }
): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/articles/render"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      articleId,
      templateId,
      customOptions
    })
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "渲染失败。");
  }

  return payload;
}

export async function updateArticleContent(articleId: string, rawMarkdown: string): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl(`/api/articles/${articleId}/content`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawMarkdown })
  });
  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "内容更新失败。");
  }
  return payload;
}

export async function updateArticleMetadata(
  articleId: string,
  input: {
    title: string;
    author: string;
    digest: string;
    mediaAssets?: ArticleDetail["mediaAssets"];
  }
): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl(`/api/articles/${articleId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "文章配置保存失败。");
  }

  return payload;
}

export async function getPublishAccounts(): Promise<PublishAccount[]> {
  const response = await fetch(buildApiUrl("/api/publish/accounts"));
  if (!response.ok) {
    throw new Error(`发布账号加载失败：HTTP ${response.status}`);
  }

  const payload = await parseJsonResponse<{ items: PublishAccount[] }>(response);
  return payload.items;
}

export async function getPublishTasks(articleId?: string): Promise<PublishTask[]> {
  const query = articleId ? `?articleId=${encodeURIComponent(articleId)}` : "";
  const response = await fetch(buildApiUrl(`/api/publish/tasks${query}`));
  if (!response.ok) {
    throw new Error(`发布任务加载失败：HTTP ${response.status}`);
  }

  const payload = await parseJsonResponse<{ items: PublishTask[] }>(response);
  return payload.items;
}

export async function createPublishTask(input: {
  articleId: string;
  accountId: string;
}): Promise<PublishTask> {
  const response = await fetch(buildApiUrl("/api/publish/tasks"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<PublishTask | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "创建发布任务失败。");
  }

  return payload;
}

export async function runPublishTask(taskId: string): Promise<PublishTask> {
  const response = await fetch(buildApiUrl(`/api/publish/tasks/${taskId}/run`), {
    method: "POST"
  });

  const payload = await parseJsonResponse<PublishTask | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "启动发布任务失败。");
  }

  return payload;
}

export async function importPublishSession(input: {
  accountId: string;
  cookies?: unknown[];
  cookieHeader?: string;
}): Promise<{ account: PublishAccount; sessionFilePath: string }> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${input.accountId}/session`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cookies: input.cookies,
      cookieHeader: input.cookieHeader
    })
  });

  const payload = await parseJsonResponse<
    { account: PublishAccount; sessionFilePath: string } | { error: string }
  >(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "导入 Session 失败。");
  }

  return payload;
}

export async function clearPublishSession(accountId: string): Promise<PublishAccount> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${accountId}/session`), {
    method: "DELETE"
  });

  const payload = await parseJsonResponse<PublishAccount | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "清除 Session 失败。");
  }

  return payload;
}

export async function refreshPublishAccount(accountId: string): Promise<{
  account: PublishAccount;
  probe: PublishLoginProbe;
}> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${accountId}/refresh`), {
    method: "POST"
  });

  const payload = await parseJsonResponse<
    {
      account: PublishAccount;
      probe: PublishLoginProbe;
    } | { error: string }
  >(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "刷新账号状态失败。");
  }

  return payload;
}

export async function startWechatQrLogin(accountId: string): Promise<{
  sessionId: string;
  screenshotPath: string;
  storageKey: string;
  pageTitle: string;
  finalUrl: string;
}> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${accountId}/qr-login/start`), {
    method: "POST"
  });

  const payload = await parseJsonResponse<{
    sessionId: string;
    screenshotPath: string;
    storageKey: string;
    pageTitle: string;
    finalUrl: string;
  } | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "启动二维码登录失败。");
  }

  return payload;
}

export async function checkWechatQrLogin(accountId: string, sessionId: string): Promise<{
  sessionId: string;
  accountId: string;
  status: "pending" | "authenticated" | "expired";
  screenshotPath: string;
  storageKey: string;
  pageTitle: string;
  finalUrl: string;
  sessionFilePath: string | null;
}> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${accountId}/qr-login/${sessionId}`));
  const payload = await parseJsonResponse<{
    sessionId: string;
    accountId: string;
    status: "pending" | "authenticated" | "expired";
    screenshotPath: string;
    storageKey: string;
    pageTitle: string;
    finalUrl: string;
    sessionFilePath: string | null;
  } | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "检查登录状态失败。");
  }

  return payload;
}

export async function cancelWechatQrLogin(accountId: string, sessionId: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/api/publish/accounts/${accountId}/qr-login/${sessionId}`), {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error("取消二维码登录失败。");
  }
}


export async function testAiConnection(input: {
  apiUrl: string;
  apiKey: string;
  model: string;
}): Promise<{ message: string }> {
  const response = await fetch(buildApiUrl("/api/ai/test"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<{ message: string } | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "连接测试失败。");
  }

  return payload;
}

export async function testImageAiConnection(input: {
  apiUrl: string;
  apiKey: string;
  model: string;
}): Promise<{ message: string }> {
  const response = await fetch(buildApiUrl("/api/ai/test-image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<{ message: string } | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "图像 AI 连接测试失败。");
  }

  return payload;
}

export async function generateCoverImage(input: {
  articleId: string;
  textApiUrl: string;
  textApiKey: string;
  textModel: string;
  imageApiUrl: string;
  imageApiKey: string;
  imageModel: string;
}): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/ai/generate-cover"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "封面生成失败。");
  }

  return payload;
}

export async function generateDigest(input: {
  articleId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/ai/generate-digest"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "摘要生成失败。");
  }

  return payload;
}

export async function applySmartTypesetting(input: {
  articleId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
}): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/ai/typeset"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "智能排版失败。");
  }

  return payload;
}

// ==================== Agent Detection ====================

export interface DetectedAgent {
  id: string;
  name: string;
  installed: boolean;
}

export async function fetchDetectedAgents(): Promise<DetectedAgent[]> {
  const response = await fetch(buildApiUrl("/api/agents"));
  const payload = await parseJsonResponse<{ agents: DetectedAgent[] }>(response);
  if (!response.ok) {
    return [];
  }
  return payload.agents ?? [];
}

// ==================== SSE Streaming ====================

export type StreamCallback = (data: { html?: string; done?: boolean; error?: string }) => void;

export function createAgentStream(
  agentId: string,
  input: string,
  system: string,
  onChunk: StreamCallback,
  onError: (err: Error) => void
): () => void {
  const es = new EventSource(
    `${buildApiUrl("/api/convert")}?agent=${encodeURIComponent(agentId)}&input=${encodeURIComponent(input)}&system=${encodeURIComponent(system)}`
  );

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onChunk(data);
      if (data.done || data.error) {
        es.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    onError(new Error("SSE 连接失败"));
    es.close();
  };

  return () => es.close();
}
