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
import JSZip from "jszip";
import https from "node:https";
import http from "node:http";

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

function resolveWorkspaceImagePath(basename: string): string | null {
  const candidates = [".png", ".jpg", ".jpeg", ".webp", ".gif"].map((extension) =>
    path.join(process.cwd(), `${basename}${extension}`)
  );

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveSeedImagePath(basename: string): string | null {
  return resolveWorkspaceImagePath(basename) ?? resolveDesktopImagePath(basename);
}

function persistSeedAsset(articleId: string, sourcePath: string): {
  absolutePath: string;
  storageKey: string;
} {
  ensureStorageDirs();

  const assetDir = getArticleAssetDir(articleId);
  fs.mkdirSync(assetDir, { recursive: true });

  const targetName = `${Date.now()}-${sanitizeFileName(path.basename(sourcePath))}`;
  const absolutePath = path.join(assetDir, targetName);
  fs.copyFileSync(sourcePath, absolutePath);

  return {
    absolutePath,
    storageKey: path.relative(getAppConfig().dataDir, absolutePath).replace(/\\/g, "/")
  };
}

function extractImagePlaceholders(rawMarkdown: string): string[] {
  return [...rawMarkdown.matchAll(/\u3010\u6b64\u5904\u63d2\u5165[^\u3011]+\u3011/g)].map(
    (match) => match[0]
  );
}

function extractMarkdownImages(rawMarkdown: string): Array<{ alt: string; url: string }> {
  const matches = [...rawMarkdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  return matches.map((match) => ({
    alt: match[1] || "",
    url: match[2].trim()
  }));
}

function isExternalImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function downloadImageToFile(url: string, targetPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const file = fs.createWriteStream(targetPath);
    const request = client.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        downloadImageToFile(response.headers.location, targetPath).then(resolve);
        return;
      }
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        resolve(false);
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(true);
      });
    });
    request.on("error", () => {
      try { file.close(); } catch { /* ignore */ }
      resolve(false);
    });
    request.on("timeout", () => {
      request.destroy();
      try { file.close(); } catch { /* ignore */ }
      resolve(false);
    });
  });
}

function resolveLocalImagePath(imagePath: string, sourceDir?: string): string | null {
  // If it's already an absolute path and exists
  if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
    return imagePath;
  }

  // Try relative to sourceDir (the markdown file's directory)
  if (sourceDir) {
    const relativeToSource = path.resolve(sourceDir, imagePath);
    if (fs.existsSync(relativeToSource)) {
      return relativeToSource;
    }
  }

  // Try relative to current working directory
  const relativeToCwd = path.resolve(process.cwd(), imagePath);
  if (fs.existsSync(relativeToCwd)) {
    return relativeToCwd;
  }

  // Try relative to uploads directory
  const relativeToUploads = path.resolve(UPLOADS_DIR, imagePath);
  if (fs.existsSync(relativeToUploads)) {
    return relativeToUploads;
  }

  return null;
}

async function processMarkdownImages(
  markdown: string,
  articleId: string,
  sourceDir?: string
): Promise<{ markdown: string; bodyImages: ArticleBodyImageAsset[] }> {
  ensureStorageDirs();
  const assetDir = getArticleAssetDir(articleId);
  fs.mkdirSync(assetDir, { recursive: true });

  const images = extractMarkdownImages(markdown);
  if (images.length === 0) {
    return { markdown, bodyImages: [] };
  }

  let processedMarkdown = markdown;
  const bodyImages: ArticleBodyImageAsset[] = [];

  for (let i = 0; i < images.length; i++) {
    const { alt, url } = images[i];
    const slotId = `slot_${i + 1}`;
    const placeholderText = alt ? `此处插入${alt} ${i + 1}` : `此处插入图片 ${i + 1}`;
    const placeholder = `【${placeholderText}】`;
    const label = alt ? `${alt} ${i + 1}` : `正文图片 ${i + 1}`;
    const markerToken = `[[MD2WECHAT_IMAGE_${slotId.toUpperCase()}]]`;

    let absolutePath: string | null = null;
    let storageKey: string | null = null;

    if (isExternalImageUrl(url)) {
      // Download external image
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const targetName = `${Date.now()}-${i + 1}${ext}`;
      const targetPath = path.join(assetDir, targetName);
      const success = await downloadImageToFile(url, targetPath);
      if (success && fs.existsSync(targetPath)) {
        absolutePath = targetPath;
        storageKey = path.relative(getAppConfig().dataDir, targetPath).replace(/\\/g, "/");
      }
    } else {
      // Resolve local image path
      const localPath = resolveLocalImagePath(url, sourceDir);
      if (localPath) {
        const ext = path.extname(localPath) || ".png";
        const targetName = `${Date.now()}-${i + 1}${ext}`;
        const targetPath = path.join(assetDir, targetName);
        try {
          fs.copyFileSync(localPath, targetPath);
          absolutePath = targetPath;
          storageKey = path.relative(getAppConfig().dataDir, targetPath).replace(/\\/g, "/");
        } catch {
          absolutePath = null;
          storageKey = null;
        }
      }
    }

    if (!absolutePath) {
      // Skip images that cannot be resolved or downloaded.
      // Keep the original markdown syntax so external URLs may still render
      // and users get a meaningful clue for missing local files.
      continue;
    }

    bodyImages.push({
      id: slotId,
      placeholder,
      label,
      markerToken,
      localPath: absolutePath,
      storageKey
    });

    // Replace the markdown image syntax with a placeholder.
    // Use non-global replace so each occurrence of the same URL gets a unique slot.
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const imagePattern = new RegExp(
      `!\\[[^\\]]*\\]\\(${escapedUrl}\\)`
    );
    processedMarkdown = processedMarkdown.replace(imagePattern, placeholder);
  }

  return { markdown: processedMarkdown, bodyImages };
}

export async function extractDocxImages(docxBuffer: Buffer): Promise<Buffer[]> {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
    const buffers: Buffer[] = [];
    for (const name of mediaFiles) {
      const file = zip.file(name);
      if (file) {
        const data = await file.async("nodebuffer");
        buffers.push(data);
      }
    }
    return buffers;
  } catch {
    return [];
  }
}

function createBodyImageAsset(
  articleId: string,
  placeholder: string,
  index: number,
  persistAssets: boolean
): ArticleBodyImageAsset {
  const slotId = `slot_${index + 1}`;
  const sourcePath = resolveSeedImagePath(String(index + 1));
  const storedAsset = sourcePath && persistAssets ? persistSeedAsset(articleId, sourcePath) : null;

  return {
    id: slotId,
    placeholder,
    label: `正文图片 ${index + 1}`,
    markerToken: `[[MD2WECHAT_IMAGE_${slotId.toUpperCase()}]]`,
    localPath: storedAsset?.absolutePath ?? sourcePath ?? null,
    storageKey: storedAsset?.storageKey ?? null
  };
}

function buildDefaultMediaAssets(
  articleId: string,
  markdown: string,
  persistAssets = false,
  docxImages: Buffer[] = [],
  existingBodyImages?: ArticleBodyImageAsset[]
): ArticleMediaAssets {
  const placeholders = extractImagePlaceholders(markdown);
  const bodyImages = placeholders.map((placeholder, index) =>
    createBodyImageAsset(articleId, placeholder, index, persistAssets)
  );

  // Merge existing body images (from processed markdown images) at the beginning
  const mergedBodyImages = existingBodyImages && existingBodyImages.length > 0
    ? [...existingBodyImages, ...bodyImages]
    : bodyImages;

  const coverSourcePath = resolveSeedImagePath(String(mergedBodyImages.length + 1));
  const storedCover =
    coverSourcePath && persistAssets ? persistSeedAsset(articleId, coverSourcePath) : null;

  if (docxImages.length > 0) {
    for (let i = 0; i < docxImages.length; i++) {
      const imgBuffer = docxImages[i];
      const ext = ".jpeg";
      const targetName = `${Date.now()}-${i + 1}${ext}`;
      const absolutePath = path.join(getArticleAssetDir(articleId), targetName);
      fs.writeFileSync(absolutePath, imgBuffer);
      const storageKey = path.relative(getAppConfig().dataDir, absolutePath).replace(/\\/g, "/");
      if (mergedBodyImages[i]) {
        mergedBodyImages[i] = { ...mergedBodyImages[i], localPath: absolutePath, storageKey };
      } else {
        mergedBodyImages.push({
          id: `slot_${i + 1}`,
          placeholder: `【图片 ${i + 1}】`,
          label: `正文图片 ${i + 1}`,
          markerToken: `[[MD2WECHAT_IMAGE_SLOT_${i + 1}]]`,
          localPath: absolutePath,
          storageKey
        });
      }
    }
  }

  return {
    coverLocalPath: storedCover?.absolutePath ?? coverSourcePath ?? null,
    coverStorageKey: storedCover?.storageKey ?? null,
    bodyImages: mergedBodyImages
  };
}

function normalizeBodyImageAsset(
  articleId: string,
  defaultItem: ArticleBodyImageAsset,
  matched: Partial<ArticleBodyImageAsset> | undefined
): ArticleBodyImageAsset {
  let localPath =
    typeof matched?.localPath === "string"
      ? matched.localPath.trim() || null
      : defaultItem.localPath;
  let storageKey =
    typeof matched?.storageKey === "string"
      ? matched.storageKey.trim() || null
      : defaultItem.storageKey;

  if (localPath && !storageKey && fs.existsSync(localPath)) {
    if (localPath.startsWith(getAppConfig().dataDir)) {
      storageKey = path.relative(getAppConfig().dataDir, localPath).replace(/\\/g, "/");
    } else {
      const persisted = persistSeedAsset(articleId, localPath);
      localPath = persisted.absolutePath;
      storageKey = persisted.storageKey;
    }
  }

  return {
    id: typeof matched?.id === "string" && matched.id.trim() ? matched.id : defaultItem.id,
    placeholder: defaultItem.placeholder,
    label:
      typeof matched?.label === "string" && matched.label.trim() ? matched.label.trim() : defaultItem.label,
    markerToken:
      typeof matched?.markerToken === "string" && matched.markerToken.trim()
        ? matched.markerToken.trim()
        : defaultItem.markerToken,
    localPath,
    storageKey
  };
}

function normalizeMediaAssets(article: ArticleRecord): ArticleMediaAssets {
  const existing = article.mediaAssets;

  if (!existing) {
    return buildDefaultMediaAssets(article.id, article.rawMarkdown);
  }

  let coverLocalPath = existing.coverLocalPath ?? null;
  let coverStorageKey = existing.coverStorageKey ?? null;

  if (coverLocalPath && !coverStorageKey && fs.existsSync(coverLocalPath)) {
    if (coverLocalPath.startsWith(getAppConfig().dataDir)) {
      coverStorageKey = path.relative(getAppConfig().dataDir, coverLocalPath).replace(/\\/g, "/");
    } else {
      const persisted = persistSeedAsset(article.id, coverLocalPath);
      coverLocalPath = persisted.absolutePath;
      coverStorageKey = persisted.storageKey;
    }
  }

  const bodyImages = (existing.bodyImages ?? []).map((item, index) =>
    normalizeBodyImageAsset(article.id, {
      id: `slot_${index + 1}`,
      placeholder: item.placeholder ?? `【图片 ${index + 1}】`,
      label: item.label ?? `正文图片 ${index + 1}`,
      markerToken: `[[MD2WECHAT_IMAGE_SLOT_${index + 1}]]`,
      localPath: null,
      storageKey: null
    }, item)
  );

  return {
    coverLocalPath,
    coverStorageKey,
    bodyImages
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

export async function createArticleFromUpload(input: {
  sourceFileName: string;
  markdown: string;
  docxImages?: Buffer[];
  sourceDir?: string;
}): Promise<ArticleRecord> {
  ensureStorageDirs();

  const id = `art_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const normalizedSourceFileName = normalizeUploadedFileName(input.sourceFileName);
  const safeFileName = sanitizeFileName(normalizedSourceFileName);
  const uploadFilePath = path.join(UPLOADS_DIR, `${id}-${safeFileName}`);

  // Process markdown images: download external images, copy local images
  const { markdown: processedMarkdown, bodyImages } = await processMarkdownImages(
    input.markdown,
    id,
    input.sourceDir
  );

  fs.writeFileSync(uploadFilePath, processedMarkdown, "utf8");

  const article: ArticleRecord = {
    id,
    title: deriveTitle(processedMarkdown, normalizedSourceFileName),
    sourceFileName: normalizedSourceFileName,
    rawMarkdown: processedMarkdown,
    templateId: null,
    renderedHtml: null,
    coverImage: {
      localPath: null,
      wechatMediaId: null
    },
    metadata: {
      author: "",
      digest: "",
      wordCount: countWords(processedMarkdown),
      originalChecked: false
    },
    mediaAssets: buildDefaultMediaAssets(id, processedMarkdown, true, input.docxImages ?? [], bodyImages),
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  saveArticle(article);
  return article;
}

export async function importArticleFromLocalPath(filePath: string): Promise<ArticleRecord | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const markdown = fs.readFileSync(filePath, "utf8");
  const sourceDir = path.dirname(filePath);
  const sourceFileName = path.basename(filePath);

  return createArticleFromUpload({
    sourceFileName,
    markdown,
    sourceDir
  });
}

export function getArticleBySourceFileName(sourceFileName: string): ArticleRecord | null {
  ensureStorageDirs();

  const normalizedTarget = normalizeUploadedFileName(sourceFileName);
  const matched = fs
    .readdirSync(ARTICLES_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJsonFile(path.join(ARTICLES_DIR, fileName)))
    .find((article) => article.sourceFileName === normalizedTarget);

  return matched ?? null;
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
