import { Router } from "express";

import { injectTemplateTokens } from "../../renderer/injector.js";
import { parseMarkdown } from "../../renderer/parser.js";
import { getArticleById, updateArticle } from "../../storage/articles.js";

const router = Router();

type AnthropicMessageResponse = {
  content?: string | Array<{
    type?: string;
    text?: string;
  }>;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    text?: string;
  }>;
  output_text?: string;
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
};

function buildMessagesUrl(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/$/, "");
  return trimmed.endsWith("/v1/messages") ? trimmed : `${trimmed}/v1/messages`;
}

async function callAnthropicCompatible(input: {
  apiUrl: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch(buildMessagesUrl(input.apiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: input.model,
      system: input.system,
      max_tokens: input.maxTokens ?? 1400,
      messages: [
        {
          role: "user",
          content: input.prompt
        }
      ]
    })
  });

  const payload = (await response.json().catch(() => null)) as AnthropicMessageResponse | { error?: unknown } | null;
  if (!response.ok) {
    const errorText =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : `HTTP ${response.status}`;
    throw new Error(`AI 请求失败：${errorText}`);
  }

  const responsePayload = payload && typeof payload === "object" ? (payload as AnthropicMessageResponse) : null;
  const readContent = (content: AnthropicMessageResponse["content"]): string => {
    if (typeof content === "string") {
      return content.trim();
    }
    return content?.find((item) => item.type === "text" || typeof item.text === "string")?.text?.trim() ?? "";
  };
  const text =
    readContent(responsePayload?.content) ||
    readContent(responsePayload?.message?.content) ||
    responsePayload?.choices?.map((choice) => readContent(choice.message?.content) || choice.text?.trim() || "").find(Boolean) ||
    responsePayload?.output_text?.trim() ||
    "";
  if (!text) {
    return "CONNECTED";
  }

  return text;
}

function extractJsonBlock(text: string): { markdown?: string; digest?: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { markdown: text.trim() };
  }

  try {
    return JSON.parse(match[0]) as { markdown?: string; digest?: string };
  } catch {
    return { markdown: text.trim() };
  }
}

router.post("/test", async (req, res) => {
  const apiUrl = typeof req.body.apiUrl === "string" ? req.body.apiUrl.trim() : "";
  const apiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  const model = typeof req.body.model === "string" ? req.body.model.trim() : "MiniMax-M2.7";

  if (!apiUrl || !apiKey) {
    return res.status(400).json({ error: "请先填写 API URL 和 API Key。" });
  }

  try {
    const text = await callAnthropicCompatible({
      apiUrl,
      apiKey,
      model,
      system: "You are a connectivity test assistant. Reply with exactly CONNECTED.",
      prompt: "Return CONNECTED only.",
      maxTokens: 16
    });

    return res.json({ message: text });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "连接测试失败。"
    });
  }
});

router.post("/typeset", async (req, res) => {
  const articleId = typeof req.body.articleId === "string" ? req.body.articleId.trim() : "";
  const apiUrl = typeof req.body.apiUrl === "string" ? req.body.apiUrl.trim() : "";
  const apiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
  const model = typeof req.body.model === "string" ? req.body.model.trim() : "MiniMax-M2.7";

  if (!articleId || !apiUrl || !apiKey) {
    return res.status(400).json({ error: "缺少 articleId、API URL 或 API Key。" });
  }

  const article = getArticleById(articleId);
  if (!article) {
    return res.status(404).json({ error: "未找到对应的文章。" });
  }

  try {
    const responseText = await callAnthropicCompatible({
      apiUrl,
      apiKey,
      model,
      system:
        "You are a Chinese WeChat article editor. Improve readability and structure, but do not fabricate facts. Keep the author's viewpoint, headings, tables, image placeholders and data unchanged. Return strict JSON with keys markdown and digest.",
      prompt: [
        "请对下面这篇中文文章做公众号智能排版优化。",
        "要求：",
        "1. 保留事实、数据、表格、标题结构、图片占位符原文。",
        "2. 可以优化段落切分、强调、引导语和小标题过渡。",
        "3. 不得删除图片占位符，如【此处插入...】。",
        "4. digest 输出为 40-80 字中文摘要。",
        "5. markdown 字段返回完整 Markdown 正文，不要加代码块。",
        "",
        `标题：${article.title}`,
        `作者：${article.metadata.author || "未填写"}`,
        "",
        article.rawMarkdown
      ].join("\n"),
      maxTokens: 3200
    });

    const parsed = extractJsonBlock(responseText);
    const nextMarkdown = parsed.markdown?.trim() || article.rawMarkdown;
    const nextDigest = parsed.digest?.trim() || article.metadata.digest;
    const baseHtml = await parseMarkdown(nextMarkdown);
    const renderedHtml = injectTemplateTokens(
      baseHtml,
      article.templateId ?? "claude",
      article.mediaAssets,
      undefined,
      {
        title: article.title,
        author: article.metadata.author,
        digest: nextDigest
      }
    );

    const updatedArticle = updateArticle({
      ...article,
      rawMarkdown: nextMarkdown,
      renderedHtml,
      status: "rendered",
      metadata: {
        ...article.metadata,
        digest: nextDigest,
        wordCount: nextMarkdown.replace(/\s+/g, "").length
      }
    });

    return res.json(updatedArticle);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "智能排版失败。"
    });
  }
});

export default router;
