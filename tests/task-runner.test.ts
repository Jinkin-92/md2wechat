import { describe, it, expect } from "vitest";
import {
  extractDraftAppmsgId,
  getDefaultStepDetail,
} from "../src/publisher/task-runner.js";

describe("task-runner", () => {
  describe("extractDraftAppmsgId", () => {
    it("should extract appmsgid from URL", () => {
      const result = extractDraftAppmsgId(
        "https://mp.weixin.qq.com/cgi-bin/appmsg?action=edit&appmsgid=123456"
      );
      expect(result).toBe("123456");
    });

    it("should return null when URL is null", () => {
      expect(extractDraftAppmsgId(null)).toBeNull();
    });

    it("should return null when URL has no appmsgid", () => {
      expect(
        extractDraftAppmsgId("https://mp.weixin.qq.com/cgi-bin/home")
      ).toBeNull();
    });

    it("should return null for invalid URL", () => {
      expect(extractDraftAppmsgId("not a valid url")).toBeNull();
    });

    it("should extract appmsgid from URL with multiple params", () => {
      const result = extractDraftAppmsgId(
        "https://mp.weixin.qq.com/cgi-bin/appmsg?lang=zh_CN&token=123&appmsgid=999888"
      );
      expect(result).toBe("999888");
    });
  });

  describe("getDefaultStepDetail", () => {
    it('should return correct detail for "session-check"', () => {
      expect(getDefaultStepDetail("session-check")).toBe(
        "等待加载本地 Session 并校验公众号登录态。"
      );
    });

    it('should return correct detail for "draft-open"', () => {
      expect(getDefaultStepDetail("draft-open")).toBe(
        "等待进入公众号后台并定位草稿入口。"
      );
    });

    it('should return correct detail for "content-fill"', () => {
      expect(getDefaultStepDetail("content-fill")).toBe(
        "等待写入标题、摘要、正文、正文图片和封面。"
      );
    });

    it('should return correct detail for "draft-save"', () => {
      expect(getDefaultStepDetail("draft-save")).toBe(
        "等待保存草稿并回收复检结果。"
      );
    });

    it('should return default detail for unknown step key', () => {
      expect(getDefaultStepDetail("unknown-step")).toBe("等待执行。");
    });
  });
});
