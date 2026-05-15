import { Request, Response, Router } from "express";
import multer from "multer";

import { injectTemplateTokens } from "../../renderer/injector.js";
import { parseMarkdown } from "../../renderer/parser.js";
import {
  createArticleFromUpload,
  extractDocxImages,
  getArticleById,
  getArticleBySourceFileName,
  importArticleFromLocalPath,
  listArticles,
  saveArticleAsset,
  updateArticle
} from "../../storage/articles.js";
import mammoth from "mammoth";
import fs from "node:fs";
import path from "node:path";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

router.get("/", (_req, res) => {
  res.json({
    items: listArticles()
  });
});

router.get("/default-preview", async (_req, res) => {
  const previewFileName = "产业观察_算力交叉点_v6 (1).md";
  const existingArticle = getArticleBySourceFileName(previewFileName);

  if (existingArticle) {
    return res.json(existingArticle);
  }

  const absolutePath = path.resolve(process.cwd(), previewFileName);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      error: `默认预览文档不存在：${absolutePath}`
    });
  }

  const markdown = fs.readFileSync(absolutePath, "utf8");
  const article = await createArticleFromUpload({
    sourceFileName: previewFileName,
    markdown
  });

  return res.json(article);
});

router.get("/:articleId", (req, res) => {
  const article = getArticleById(req.params.articleId);

  if (!article) {
    return res.status(404).json({
      error: "未找到对应的文章。"
    });
  }

  return res.json(article);
});

function updateArticleMetadata(req: Request, res: Response) {
  const articleId = Array.isArray(req.params.articleId) ? req.params.articleId[0] : req.params.articleId;
  const article = getArticleById(articleId);

  if (!article) {
    return res.status(404).json({
      error: "未找到对应的文章。"
    });
  }

  const nextTitle =
    typeof req.body.title === "string" && req.body.title.trim() ? req.body.title.trim() : article.title;
  const nextAuthor =
    typeof req.body.author === "string" ? req.body.author.trim() : article.metadata.author;
  const nextDigest =
    typeof req.body.digest === "string" ? req.body.digest.trim() : article.metadata.digest;
  const incomingMediaAssets =
    req.body.mediaAssets && typeof req.body.mediaAssets === "object" ? req.body.mediaAssets : null;

  const nextMediaAssets = incomingMediaAssets
    ? {
        coverLocalPath:
          typeof incomingMediaAssets.coverLocalPath === "string"
            ? incomingMediaAssets.coverLocalPath.trim() || null
            : article.mediaAssets.coverLocalPath,
        coverStorageKey:
          typeof incomingMediaAssets.coverStorageKey === "string"
            ? incomingMediaAssets.coverStorageKey.trim() || null
            : article.mediaAssets.coverStorageKey,
        bodyImages: article.mediaAssets.bodyImages.map((slot) => {
          const matched = Array.isArray(incomingMediaAssets.bodyImages)
            ? incomingMediaAssets.bodyImages.find(
                (item: unknown) =>
                  typeof item === "object" &&
                  item !== null &&
                  "id" in item &&
                  typeof item.id === "string" &&
                  item.id === slot.id
              )
            : null;

          return {
            ...slot,
            localPath:
              matched &&
              typeof matched === "object" &&
              matched !== null &&
              "localPath" in matched &&
              typeof matched.localPath === "string"
                ? matched.localPath.trim() || null
                : slot.localPath,
            storageKey:
              matched &&
              typeof matched === "object" &&
              matched !== null &&
              "storageKey" in matched &&
              typeof matched.storageKey === "string"
                ? matched.storageKey.trim() || null
                : slot.storageKey
          };
        })
      }
    : article.mediaAssets;

  const updatedArticle = updateArticle({
    ...article,
    title: nextTitle,
    metadata: {
      ...article.metadata,
      author: nextAuthor,
      digest: nextDigest
    },
    mediaAssets: nextMediaAssets
  });

  return res.json(updatedArticle);
}

router.patch("/:articleId", updateArticleMetadata);
router.put("/:articleId", updateArticleMetadata);

router.patch("/:articleId/content", (req, res) => {
  const articleId = Array.isArray(req.params.articleId) ? req.params.articleId[0] : req.params.articleId;
  const article = getArticleById(articleId);

  if (!article) {
    return res.status(404).json({ error: "未找到对应的文章。" });
  }

  const rawMarkdown = typeof req.body.rawMarkdown === "string" ? req.body.rawMarkdown : article.rawMarkdown;

  const updatedArticle = updateArticle({ ...article, rawMarkdown });
  return res.json(updatedArticle);
});

router.post("/:articleId/assets", upload.single("file"), (req, res) => {
  const file = req.file;
  const kind = req.body.kind === "cover" ? "cover" : req.body.kind === "body" ? "body" : null;
  const slotId = typeof req.body.slotId === "string" ? req.body.slotId : null;

  if (!file) {
    return res.status(400).json({
      error: "请先选择一张图片。"
    });
  }

  if (!kind) {
    return res.status(400).json({
      error: "缺少素材类型 kind。"
    });
  }

  if (kind === "body" && !slotId) {
    return res.status(400).json({
      error: "正文图片上传缺少 slotId。"
    });
  }

  const articleId = Array.isArray(req.params.articleId) ? req.params.articleId[0] : req.params.articleId;

  const savedArticle = saveArticleAsset({
    articleId,
    kind,
    slotId,
    fileName: file.originalname,
    fileBuffer: file.buffer
  });

  if (!savedArticle) {
    return res.status(404).json({
      error: "未找到对应文章或图片槽位。"
    });
  }

  if (!savedArticle.templateId) {
    return res.status(201).json(savedArticle);
  }

  void (async () => {
    const baseHtml = await parseMarkdown(savedArticle.rawMarkdown);
    const renderedHtml = injectTemplateTokens(
      baseHtml,
      savedArticle.templateId ?? "claude",
      savedArticle.mediaAssets,
      undefined,
      {
        title: savedArticle.title,
        author: savedArticle.metadata.author,
        digest: savedArticle.metadata.digest
      }
    );
    const renderedArticle = updateArticle({
      ...savedArticle,
      renderedHtml,
      status: "rendered"
    });
    res.status(201).json(renderedArticle);
  })().catch((error: unknown) => {
    console.error(error);
    res.status(500).json({
      error: "素材已上传，但重渲染失败。"
    });
  });
});

router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: "请先选择一个文件。"
    });
  }

  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
  const supportedMdExts = [".md", ".txt"];
  const supportedDocExts = [".doc", ".docx"];

  let markdown: string;
  let docxImages: Buffer[] = [];

  if (supportedMdExts.includes(ext)) {
    markdown = file.buffer.toString("utf8");
  } else if (supportedDocExts.includes(ext)) {
    const result = await mammoth.convertToHtml({ buffer: file.buffer });
    markdown = result.value;
    if (!markdown.trim()) {
      return res.status(422).json({
        error: "Word 文档内容为空或无法读取。"
      });
    }
    docxImages = await extractDocxImages(file.buffer);
  } else {
    return res.status(400).json({
      error: "当前仅支持上传 .md、.txt、.doc、.docx 文件。"
    });
  }

  const article = await createArticleFromUpload({
    sourceFileName: file.originalname,
    markdown,
    docxImages
  });

  return res.status(201).json(article);
});

router.post("/import-local", async (req, res) => {
  const filePath = typeof req.body.filePath === "string" ? req.body.filePath.trim() : "";

  if (!filePath) {
    return res.status(400).json({ error: "缺少 filePath 参数。" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `文件不存在：${filePath}` });
  }

  const article = await importArticleFromLocalPath(filePath);
  if (!article) {
    return res.status(500).json({ error: "导入失败，无法创建文章。" });
  }

  return res.status(201).json(article);
});

router.post("/render", async (req, res) => {
  const articleId = String(req.body.articleId ?? "");
  const templateId = String(req.body.templateId ?? "default-light");
  const customOptions = req.body.customOptions;

  if (!articleId) {
    return res.status(400).json({
      error: "缺少 articleId。"
    });
  }

  const article = getArticleById(articleId);
  if (!article) {
    return res.status(404).json({
      error: "未找到对应的文章。"
    });
  }

  const baseHtml = await parseMarkdown(article.rawMarkdown);
  const renderedHtml = injectTemplateTokens(baseHtml, templateId, article.mediaAssets, customOptions, {
    title: article.title,
    author: article.metadata.author,
    digest: article.metadata.digest,
    originalChecked: article.metadata.originalChecked
  });
  const updatedArticle = updateArticle({
    ...article,
    templateId,
    renderedHtml,
    status: "rendered"
  });

  return res.json(updatedArticle);
});

export default router;
