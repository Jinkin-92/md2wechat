import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { getAppConfig } from "../config/app-config.js";
import type {
  ArticleBodyImageAsset,
  ArticleMediaAssets,
  ArticleRecord,
  ArticleSummary
} from "../shared/types.js";

const ARTICLES_DIR = path.resolve(process.cwd(), "data/articles");
const UPLOADS_DIR = path.resolve(process.cwd(), "data/uploads");
const ASSETS_DIR = path.resolve(process.cwd(), "data/article-assets");

function ensureStorageDirs(): void {
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function getArticleFilePath(articleId: string): string {
  return path.join(ARTICLES_DIR, `${articleId}.json`);
}

function getArticleAssetDir(articleId: string): string {
  return path.join(ASSETS_DIR, articleId);
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-\u4e00-\u9fa5() ]/g, "_");
}

function normalizeUploadedFileName(fileName: string): string {
  try {
    const normalized = Buffer.from(fileName, "latin1").toString("utf8");
    const replacementCount = [...normalized].filter((char) => char === "\uFFFD").length;

    if (replacementCount === 0 && /[\u4e00-\u9fa5]/.test(normalized)) {
      return normalized;
    }
  } catch {
    return fileName;
  }

  return fileName;
}

function resolveDesktopImagePath(basename: string): string | null {
  const desktopDir = path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Desktop");
  const candidates = [".png", ".jpg", ".jpeg", ".webp", ".gif"].map((extension) =>
    path.join(desktopDir, `${basename}${extension}`)
  );

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function extractImagePlaceholders(rawMarkdown: string): string[] {
  return [...rawMarkdown.matchAll(/\u3010\u6b64\u5904\u63d2\u5165[^\u3011]+\u3011/g)].map(
    (match) => match[0]
  );
}

function createBodyImageAsset(placeholder: string, index: number): ArticleBodyImageAsset {
  const slotId = `slot_${index + 1}`;
  return {
    id: slotId,
    placeholder,
    label: `正文图片 ${index + 1}`,
    markerToken: `[[MD2WECHAT_IMAGE_${slotId.toUpperCase()}]]`,
    localPath: resolveDesktopImagePath(String(index + 1)),
    storageKey: null
  };
}

function buildDefaultMediaAssets(markdown: string, coverLocalPath: string | null): ArticleMediaAssets {
  const placeholders = extractImagePlaceholders(markdown);
  const bodyImages = placeholders.map((placeholder, index) => createBodyImageAsset(placeholder, index));

  return {
    coverLocalPath: coverLocalPath ?? resolveDesktopImagePath(String(placeholders.length + 1)),
    coverStorageKey: null,
    bodyImages
  };
}

function normalizeBodyImageAsset(
  defaultItem: ArticleBodyImageAsset,
  matched: Partial<ArticleBodyImageAsset> | undefined
): ArticleBodyImageAsset {
  return {
    id: typeof matched?.id === "string" && matched.id.trim() ? matched.id : defaultItem.id,
    placeholder: defaultItem.placeholder,
    label:
      typeof matched?.label === "string" && matched.label.trim() ? matched.label.trim() : defaultItem.label,
    markerToken:
      typeof matched?.markerToken === "string" && matched.markerToken.trim()
        ? matched.markerToken.trim()
        : defaultItem.markerToken,
    localPath:
      typeof matched?.localPath === "string"
        ? matched.localPath.trim() || null
        : defaultItem.localPath,
    storageKey:
      typeof matched?.storageKey === "string"
        ? matched.storageKey.trim() || null
        : defaultItem.storageKey
  };
}

function normalizeMediaAssets(article: ArticleRecord): ArticleMediaAssets {
  const defaults = buildDefaultMediaAssets(article.rawMarkdown, article.coverImage.localPath);
  const existing = article.mediaAssets;

  if (!existing) {
    return defaults;
  }

  return {
    coverLocalPath:
      typeof existing.coverLocalPath === "string" ? existing.coverLocalPath : defaults.coverLocalPath,
    coverStorageKey:
      typeof existing.coverStorageKey === "string" ? existing.coverStorageKey : defaults.coverStorageKey,
    bodyImages: defaults.bodyImages.map((defaultItem) => {
      const matched =
        existing.bodyImages?.find(
          (item) => item.id === defaultItem.id || item.placeholder === defaultItem.placeholder
        ) ?? undefined;
      return normalizeBodyImageAsset(defaultItem, matched);
    })
  };
}

function readJsonFile(filePath: string): ArticleRecord {
  const content = fs.readFileSync(filePath, "utf8");
  const article = JSON.parse(content) as ArticleRecord;
  const normalizedFileName = normalizeUploadedFileName(article.sourceFileName);

  if (normalizedFileName !== article.sourceFileName) {
    article.sourceFileName = normalizedFileName;
  }

  article.mediaAssets = normalizeMediaAssets(article);

  return article;
}

function saveArticle(article: ArticleRecord): void {
  fs.writeFileSync(getArticleFilePath(article.id), JSON.stringify(article, null, 2), "utf8");
}

function deriveTitle(markdown: string, sourceFileName: string): string {
  const titleLine = markdown.split(/\r?\n/).find((line) => line.trim().startsWith("# "));

  if (titleLine) {
    return titleLine.replace(/^#\s+/, "").trim();
  }

  return path.parse(sourceFileName).name;
}

function countWords(markdown: string): number {
  return markdown.replace(/\s+/g, "").length;
}

export function getStoredAssetAbsolutePath(storageKey: string | null): string | null {
  if (!storageKey) {
    return null;
  }

  return path.join(getAppConfig().dataDir, storageKey);
}

export function getStoredAssetPublicUrl(storageKey: string | null): string | null {
  if (!storageKey) {
    return null;
  }

  return `/data/${storageKey.replace(/\\/g, "/")}`;
}

export function createArticleFromUpload(input: {
  sourceFileName: string;
  markdown: string;
}): ArticleRecord {
  ensureStorageDirs();

  const id = `art_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const normalizedSourceFileName = normalizeUploadedFileName(input.sourceFileName);
  const safeFileName = sanitizeFileName(normalizedSourceFileName);
  const uploadFilePath = path.join(UPLOADS_DIR, `${id}-${safeFileName}`);

  fs.writeFileSync(uploadFilePath, input.markdown, "utf8");

  const article: ArticleRecord = {
    id,
    title: deriveTitle(input.markdown, normalizedSourceFileName),
    sourceFileName: normalizedSourceFileName,
    rawMarkdown: input.markdown,
    templateId: null,
    renderedHtml: null,
    coverImage: {
      localPath: null,
      wechatMediaId: null
    },
    metadata: {
      author: "",
      digest: "",
      wordCount: countWords(input.markdown)
    },
    mediaAssets: buildDefaultMediaAssets(input.markdown, null),
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  saveArticle(article);
  return article;
}

export function listArticles(): ArticleSummary[] {
  ensureStorageDirs();

  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJsonFile(path.join(ARTICLES_DIR, fileName)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(({ rawMarkdown, renderedHtml, ...summary }) => summary);
}

export function getArticleById(articleId: string): ArticleRecord | null {
  ensureStorageDirs();

  const filePath = getArticleFilePath(articleId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return readJsonFile(filePath);
}

export function updateArticle(article: ArticleRecord): ArticleRecord {
  ensureStorageDirs();

  const updatedArticle: ArticleRecord = {
    ...article,
    mediaAssets: normalizeMediaAssets(article),
    updatedAt: new Date().toISOString()
  };

  saveArticle(updatedArticle);
  return updatedArticle;
}

export function saveArticleAsset(input: {
  articleId: string;
  kind: "cover" | "body";
  fileName: string;
  fileBuffer: Buffer;
  slotId?: string | null;
}): ArticleRecord | null {
  ensureStorageDirs();

  const article = getArticleById(input.articleId);
  if (!article) {
    return null;
  }

  const normalizedFileName = sanitizeFileName(normalizeUploadedFileName(input.fileName));
  const assetDir = getArticleAssetDir(input.articleId);
  fs.mkdirSync(assetDir, { recursive: true });

  const timestampedName = `${Date.now()}-${normalizedFileName}`;
  const absolutePath = path.join(assetDir, timestampedName);
  fs.writeFileSync(absolutePath, input.fileBuffer);

  const storageKey = path.relative(getAppConfig().dataDir, absolutePath).replace(/\\/g, "/");

  if (input.kind === "cover") {
    return updateArticle({
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
  }

  const slot = article.mediaAssets.bodyImages.find((item) => item.id === input.slotId);
  if (!slot) {
    return null;
  }

  return updateArticle({
    ...article,
    mediaAssets: {
      ...article.mediaAssets,
      bodyImages: article.mediaAssets.bodyImages.map((item) =>
        item.id === slot.id
          ? {
              ...item,
              localPath: absolutePath,
              storageKey
            }
          : item
      )
    }
  });
}
