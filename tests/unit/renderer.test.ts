import { describe, it, expect } from "vitest";
import { listTemplates, getTemplateById } from "../../src/renderer/templates.js";

describe("Templates Renderer", () => {
  describe("listTemplates", () => {
    it("should return 12 templates", () => {
      const templates = listTemplates();
      expect(templates).toHaveLength(12);
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
    it("should return claude template for valid id", () => {
      const tpl = getTemplateById("claude");
      expect(tpl.id).toBe("claude");
      expect(tpl.name).toBe("Claude");
    });

    it("should return first template for unknown id (fallback)", () => {
      const tpl = getTemplateById("non-existent-template");
      const first = listTemplates()[0];
      expect(tpl.id).toBe(first.id);
    });

    it("should return cohere template by id", () => {
      const tpl = getTemplateById("cohere");
      expect(tpl.name).toBe("Cohere");
      expect(tpl.tokens.pageBackground).toBe("#ffffff");
    });

    it("should return mistral-ai template by id", () => {
      const tpl = getTemplateById("mistral-ai");
      expect(tpl.name).toBe("Mistral AI");
    });
  });
});
