import { describe, it, expect } from "vitest";
import { listTemplates, getTemplateById } from "../../src/renderer/templates.js";

describe("Templates Renderer", () => {
  describe("listTemplates", () => {
    it("should return 6 templates", () => {
      const templates = listTemplates();
      expect(templates).toHaveLength(6);
    });

    it("should have unique IDs for all templates", () => {
      const templates = listTemplates();
      const ids = templates.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("each template should have required token fields", () => {
      const templates = listTemplates();
      const requiredTokens = [
        "pageBackground", "cardBackground", "textColor", "headingColor",
        "accentColor", "borderColor", "quoteBackground", "codeBackground",
        "mutedColor", "fontSize", "lineHeight", "h1Size", "h2Size", "h3Size"
      ];
      for (const tpl of templates) {
        for (const token of requiredTokens) {
          expect(tpl.tokens).toHaveProperty(token);
        }
      }
    });
  });

  describe("getTemplateById", () => {
    it("should return template for valid id", () => {
      const tpl = getTemplateById("default-light");
      expect(tpl.id).toBe("default-light");
      expect(tpl.name).toBe("雾蓝简报");
    });

    it("should return first template for unknown id (fallback)", () => {
      const tpl = getTemplateById("non-existent-template");
      const first = listTemplates()[0];
      expect(tpl.id).toBe(first.id);
    });

    it("should return sunset template by id", () => {
      const tpl = getTemplateById("sunset");
      expect(tpl.name).toBe("落日暖调");
      expect(tpl.tokens.pageBackground).toBe("#fff5f5");
    });

    it("should return fresh-green template by id", () => {
      const tpl = getTemplateById("fresh-green");
      expect(tpl.name).toBe("清新文摘");
    });
  });
});
