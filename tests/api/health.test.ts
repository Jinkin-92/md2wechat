import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

const router = express.Router();
router.get("/", (_req, res) => {
  res.json({ status: "ok", service: "md2wechat-api", timestamp: new Date().toISOString() });
});

describe("Health API", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use("/api/health", router);
  });

  describe("GET /api/health", () => {
    it("should return 200 with status ok", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("should return service name md2wechat-api", async () => {
      const res = await request(app).get("/api/health");
      expect(res.body.service).toBe("md2wechat-api");
    });

    it("should return a valid ISO timestamp", async () => {
      const res = await request(app).get("/api/health");
      expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const date = new Date(res.body.timestamp);
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });
});
