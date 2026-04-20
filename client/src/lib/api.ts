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
    id: "default-light",
    name: "雾蓝简报",
    description: "适合理性、克制的产业观察和技术分析类文章。"
  },
  {
    id: "insight-dark",
    name: "夜读洞察",
    description: "适合长文评论、趋势判断和更强氛围感的阅读场景。"
  },
  {
    id: "fresh-green",
    name: "清新文摘",
    description: "清新绿底，自然温暖，适合生活方式和成长随笔。"
  },
  {
    id: "warm-peach",
    name: "暖阳随笔",
    description: "暖橙色调，温和亲切，适合生活记录和情感文字。"
  },
  {
    id: "minimal-gray",
    name: "极简主义",
    description: "黑白灰极简，突出内容，适合产品设计和方法论文章。"
  },
  {
    id: "sunset",
    name: "落日暖调",
    description: "暖红渐变，情感强烈，适合个人品牌和观点表达。"
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

export async function renderArticle(articleId: string, templateId: string): Promise<ArticleDetail> {
  const response = await fetch(buildApiUrl("/api/articles/render"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      articleId,
      templateId
    })
  });

  const payload = await parseJsonResponse<ArticleDetail | { error: string }>(response);
  if (!response.ok || "error" in payload) {
    throw new Error("error" in payload ? payload.error : "渲染失败。");
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
