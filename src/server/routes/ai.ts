import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

import { getAppConfig } from "../../config/app-config.js";
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

function stripBase64Images(markdown: string): string {
  const bodyImages = [
    { alt: "封面图" },
    { alt: "图片1" }, { alt: "图片2" }, { alt: "图片3" },
    { alt: "图片4" }, { alt: "图片5" }, { alt: "图片6" }
  ];
  let imageIndex = 0;
  const getNextPlaceholder = (): string => {
    const name = bodyImages[imageIndex]?.alt ?? `图片${imageIndex + 1}`;
    imageIndex++;
    return `【此处插入${name}】`;
  };
  // Replace <p><img ...base64...></p> blocks with placeholder text
  let result = markdown.replace(/<p[^>]*>\s*<img[^>]*base64[^>]*>\s*<\/p>/gi, () => `\n\n${getNextPlaceholder()}\n\n`);
  // Replace standalone <img ...base64...> tags
  result = result.replace(/<img[^>]*base64[^>]*\/?>/gi, () => `\n\n${getNextPlaceholder()}\n\n`);
  return result;
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
    const markdownForAi = stripBase64Images(article.rawMarkdown);
    const responseText = await callAnthropicCompatible({
      apiUrl,
      apiKey,
      model,
      system:
        "You are a Chinese WeChat article editor. Improve readability and structure, but do not fabricate facts. Keep the author's viewpoint, headings, tables, image placeholders and data unchanged. Return strict JSON with keys markdown and digest.",
      prompt: [
        "请对下面这篇中文文章做公众号智能排版优化。",
        "要求：",
        "1. 保留事实、数据、表格、标题结构原文。",
        "2. 可以优化段落切分、强调、引导语和小标题过渡。",
        "3. 【此处插入...】标记为图片占位符，必须原样保留，不得删除或改写。",
        "4. digest 输出为 40-80 字中文摘要。",
        "5. markdown 字段返回完整 Markdown 正文，不要加代码块。",
        "",
        `标题：${article.title}`,
        `作者：${article.metadata.author || "未填写"}`,
        "",
        markdownForAi
      ].join("\n"),
      maxTokens: 4000
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

async function callMinimaxImageGeneration(input: {
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
}): Promise<string | null> {
  const url = input.apiUrl.replace(/\/$/, "").replace(/\/v1\/messages$/, "") + "/v1/image_generation";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9"
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { image?: string; image_url?: string } }
    | null;

  return payload?.data?.image ?? payload?.data?.image_url ?? null;
}

router.post("/generate-cover", async (req, res) => {
  const articleId = typeof req.body.articleId === "string" ? req.body.articleId.trim() : "";
  const textApiUrl = typeof req.body.textApiUrl === "string" ? req.body.textApiUrl.trim() : "";
  const textApiKey = typeof req.body.textApiKey === "string" ? req.body.textApiKey.trim() : "";
  const textModel = typeof req.body.textModel === "string" ? req.body.textModel.trim() : "MiniMax-M2.7";
  const imageApiUrl = typeof req.body.imageApiUrl === "string" ? req.body.imageApiUrl.trim() : "";
  const imageApiKey = typeof req.body.imageApiKey === "string" ? req.body.imageApiKey.trim() : "";
  const imageModel = typeof req.body.imageModel === "string" ? req.body.imageModel.trim() : "image-01";

  if (!articleId || !textApiUrl || !textApiKey || !imageApiUrl || !imageApiKey) {
    return res.status(400).json({ error: "缺少 articleId、文本 AI 或图像 AI 的配置参数。" });
  }

  const article = getArticleById(articleId);
  if (!article) {
    return res.status(404).json({ error: "未找到对应的文章。" });
  }

  try {
    const promptText = await callAnthropicCompatible({
      apiUrl: textApiUrl,
      apiKey: textApiKey,
      model: textModel,
      system:
        "You are a prompt engineer for image generation. Given a Chinese article title and content, generate a concise English image generation prompt (max 200 words) suitable for creating a WeChat article cover image. The prompt should be vivid, visually descriptive, and suitable for a flat illustration or high-quality photo style.",
      prompt: [
        "Generate an English image generation prompt for a WeChat article cover based on the following content.",
        "",
        `Title: ${article.title}`,
        `Content excerpt: ${article.rawMarkdown.slice(0, 800)}`,
        "",
        "Requirements:",
        "1. The prompt must be in English.",
        "2. Max 200 words.",
        "3. Describe a visually striking scene that captures the essence of the article.",
        "4. Include style keywords like 'flat illustration', 'minimalist', 'high quality', 'clean background'.",
        "5. The cover image should be landscape orientation, approximately 2.35:1 aspect ratio (900x383 pixels), suitable for WeChat Official Account.",
        "6. Return ONLY the prompt text, no markdown, no quotes."
      ].join("\n"),
      maxTokens: 600
    });

    const imageBase64 = await callMinimaxImageGeneration({
      apiUrl: imageApiUrl,
      apiKey: imageApiKey,
      model: imageModel,
      prompt: promptText,
      aspectRatio: "16:9"
    });

    if (!imageBase64) {
      return res.status(502).json({
        error: "图像生成失败，AI 提示词已生成但未能获取图片。"
      });
    }

    const imageBuffer = Buffer.from(imageBase64, "base64");
    const assetDir = path.resolve(getAppConfig().dataDir, "article-assets", articleId);
    fs.mkdirSync(assetDir, { recursive: true });
    const fileName = `${Date.now()}-ai-cover.jpg`;
    const absolutePath = path.join(assetDir, fileName);
    fs.writeFileSync(absolutePath, imageBuffer);

    const storageKey = path.relative(getAppConfig().dataDir, absolutePath).replace(/\\/g, "/");

    const updatedArticle = updateArticle({
      ...article,
      coverImage: {
        ...article.coverImage,
        localPath: absolutePath
      },
      mediaAssets: {
        ...article.mediaAssets,
        coverLocalPath: absolutePath,
        coverStorageKey: storageKey
      }
    });

    return res.json(updatedArticle);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "封面生成失败。"
    });
  }
});

router.post("/generate-digest", async (req, res) => {
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
    const markdownForAi = stripBase64Images(article.rawMarkdown);
    const responseText = await callAnthropicCompatible({
      apiUrl,
      apiKey,
      model,
      system:
        "You are a Chinese WeChat article editor. Given an article title and content, write a concise and engaging 40-80 character Chinese digest (summary) suitable for a WeChat article cover card. Do not fabricate facts. Return strict JSON with key digest only.",
      prompt: [
        "请为下面这篇中文文章生成一段 40-80 字的公众号摘要。",
        "要求：",
        "1. 准确概括文章核心观点，不编造事实。",
        "2. 语言简洁、有吸引力，适合作为公众号推文摘要。",
        "3. 返回严格 JSON 格式，仅包含 digest 字段。",
        "",
        `标题：${article.title}`,
        `作者：${article.metadata.author || "未填写"}`,
        "",
        markdownForAi.slice(0, 2000)
      ].join("\n"),
      maxTokens: 400
    });

    const parsed = extractJsonBlock(responseText);
    const nextDigest = parsed.digest?.trim() || article.metadata.digest;

    const updatedArticle = updateArticle({
      ...article,
      metadata: {
        ...article.metadata,
        digest: nextDigest
      }
    });

    return res.json(updatedArticle);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "摘要生成失败。"
    });
  }
});

export default router;
