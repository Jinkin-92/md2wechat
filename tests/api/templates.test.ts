import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

import { listTemplates } from "../../src/renderer/templates.js";

const router = express.Router();
router.get("/", (_req, res) => {
  res.json({ items: listTemplates() });
});

describe("Templates API", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use("/api/templates", router);
  });

  describe("GET /api/templates", () => {
    it("should return 200 with items array", async () => {
      const res = await request(app).get("/api/templates");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("should have at least 6 built-in templates", async () => {
      const res = await request(app).get("/api/templates");
      expect(res.body.items.length).toBeGreaterThanOrEqual(6);
    });

    it("each template should have id, name, description, and tokens", async () => {
      const res = await request(app).get("/api/templates");
      for (const tpl of res.body.items) {
        expect(tpl).toHaveProperty("id");
        expect(tpl).toHaveProperty("name");
        expect(tpl).toHaveProperty("description");
        expect(tpl).toHaveProperty("tokens");
        expect(tpl.tokens).toHaveProperty("pageBackground");
        expect(tpl.tokens).toHaveProperty("headingColor");
        expect(tpl.tokens).toHaveProperty("accentColor");
      }
    });

    it("all template tokens should have valid hex color values", async () => {
      const res = await request(app).get("/api/templates");
      const hexColorRegex = /^#[0-9a-fA-F]{3,8}$/;
      for (const tpl of res.body.items) {
        expect(tpl.tokens.pageBackground).toMatch(hexColorRegex);
        expect(tpl.tokens.headingColor).toMatch(hexColorRegex);
        expect(tpl.tokens.accentColor).toMatch(hexColorRegex);
      }
    });

    it("should include default-light template", async () => {
      const res = await request(app).get("/api/templates");
      const ids = res.body.items.map((t: { id: string }) => t.id);
      expect(ids).toContain("default-light");
    });

    it("should include sunset template", async () => {
      const res = await request(app).get("/api/templates");
      const ids = res.body.items.map((t: { id: string }) => t.id);
      expect(ids).toContain("sunset");
    });
  });
});
