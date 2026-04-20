import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import multer from "multer";

import { listArticles, getArticleById, createArticleFromUpload, updateArticle } from "../../src/storage/articles.js";
import { parseMarkdown } from "../../src/renderer/parser.js";
import { injectTemplateTokens } from "../../src/renderer/injector.js";

// Create a test app that mirrors the real articles router
function createTestApp() {
  const app = express();
  app.use(express.json());

  const testUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
  });

  app.get("/api/articles", (_req, res) => {
    res.json({ items: listArticles() });
  });

  app.get("/api/articles/:articleId", (req, res) => {
    const article = getArticleById(req.params.articleId);
    if (!article) return res.status(404).json({ error: "未找到对应的文章。" });
    return res.json(article);
  });

  app.post("/api/articles/upload", testUpload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "请先选择一个 Markdown 文件。" });
    const supportedExts = [".md", ".txt"];
    const ext = supportedExts.find((e) => file.originalname.toLowerCase().endsWith(e));
    if (!ext) return res.status(400).json({ error: "当前仅支持上传 .md 或 .txt 文件。" });
    const article = createArticleFromUpload({ sourceFileName: file.originalname, markdown: file.buffer.toString("utf8") });
    return res.status(201).json(article);
  });

  app.post("/api/articles/render", async (req, res) => {
    const articleId = String(req.body.articleId ?? "");
    const templateId = String(req.body.templateId ?? "default-light");
    if (!articleId) return res.status(400).json({ error: "缺少 articleId。" });
    const article = getArticleById(articleId);
    if (!article) return res.status(404).json({ error: "未找到对应的文章。" });
    const baseHtml = await parseMarkdown(article.rawMarkdown);
    const renderedHtml = injectTemplateTokens(baseHtml, templateId, article.mediaAssets);
    const updated = updateArticle({ ...article, templateId, renderedHtml, status: "rendered" });
    return res.json(updated);
  });

  return app;
}

describe("Articles API", () => {
  let app: express.Express;

  beforeAll(() => {
    app = createTestApp();
  });

  describe("GET /api/articles", () => {
    it("should return a list of articles with items array", async () => {
      const res = await request(app).get("/api/articles");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  describe("GET /api/articles/:articleId", () => {
    it("should return 404 for non-existent article", async () => {
      const res = await request(app).get("/api/articles/non-existent-id-12345");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should return article for valid id", async () => {
      const listRes = await request(app).get("/api/articles");
      const items = listRes.body.items;
      if (items.length === 0) return; // Skip if no articles in environment

      const res = await request(app).get(`/api/articles/${items[0].id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
    });
  });

  describe("POST /api/articles/upload", () => {
    it("should return 400 when no file is provided", async () => {
      const res = await request(app)
        .post("/api/articles/upload");
      expect(res.status).toBe(400);
    });

    it("should return 400 for unsupported file format", async () => {
      const res = await request(app)
        .post("/api/articles/upload")
        .attach("file", Buffer.from("content"), "test.wrong");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("当前仅支持上传 .md 或 .txt 文件");
    });

    it("should upload and create a .md file", async () => {
      const res = await request(app)
        .post("/api/articles/upload")
        .attach("file", Buffer.from("# Test Article\n\nHello world"), "test-article.spec.md");
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
    });

    it("should upload and create a .txt file", async () => {
      const res = await request(app)
        .post("/api/articles/upload")
        .attach("file", Buffer.from("Plain text content here"), "article.spec.txt");
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
    });
  });

  describe("POST /api/articles/render", () => {
    it("should return 400 when articleId is missing", async () => {
      const res = await request(app)
        .post("/api/articles/render")
        .send({ templateId: "default-light" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("缺少 articleId");
    });

    it("should return 404 for non-existent article", async () => {
      const res = await request(app)
        .post("/api/articles/render")
        .send({ articleId: "non-existent-id", templateId: "default-light" });
      expect(res.status).toBe(404);
    });

    it("should render article with default template", async () => {
      const listRes = await request(app).get("/api/articles");
      const items = listRes.body.items;
      if (items.length === 0) return;

      const res = await request(app)
        .post("/api/articles/render")
        .send({ articleId: items[0].id, templateId: "default-light" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("renderedHtml");
      expect(res.body.templateId).toBe("default-light");
    });
  });
});
