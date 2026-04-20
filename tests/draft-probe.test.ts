import { describe, it, expect } from "vitest";
import {
  resolveWechatHref,
  buildDraftEditUrl,
} from "../src/publisher/draft-probe.js";

describe("draft-probe", () => {
  describe("resolveWechatHref", () => {
    it("should resolve relative href to absolute URL", () => {
      const result = resolveWechatHref(
        "https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=123&lang=zh_CN",
        "/cgi-bin/appmsg?t=media/appmsg_edit"
      );
      expect(result).toContain("token=123");
      expect(result).toContain("lang=zh_CN");
    });

    it("should preserve existing token from current URL", () => {
      const result = resolveWechatHref(
        "https://mp.weixin.qq.com/cgi-bin/home?token=456&lang=zh_CN",
        "/cgi-bin/appmsg"
      );
      expect(result).toContain("token=456");
    });

    it("should not override existing token in href", () => {
      const result = resolveWechatHref(
        "https://mp.weixin.qq.com/cgi-bin/home?token=123",
        "/cgi-bin/appmsg?token=456"
      );
      expect(result).toContain("token=456");
    });

    it("should preserve lang from current URL if not in href", () => {
      const result = resolveWechatHref(
        "https://mp.weixin.qq.com/cgi-bin/home?lang=en_US",
        "/cgi-bin/appmsg"
      );
      expect(result).toContain("lang=en_US");
    });

    it("should handle absolute href without changes", () => {
      const absHref = "https://mp.weixin.qq.com/cgi-bin/appmsg?token=789&lang=zh_CN";
      const result = resolveWechatHref(
        "https://mp.weixin.qq.com/cgi-bin/home",
        absHref
      );
      expect(result).toBe(absHref);
    });
  });

  describe("buildDraftEditUrl", () => {
    it("should build correct edit URL with appmsgId", () => {
      const result = buildDraftEditUrl(
        "https://mp.weixin.qq.com/cgi-bin/home?token=123&lang=zh_CN",
        "987654321"
      );
      expect(result).toContain("appmsgid=987654321");
      expect(result).toContain("token=123");
      expect(result).toContain("lang=zh_CN");
      expect(result).toContain("action=edit");
      expect(result).toContain("type=77");
    });

    it("should throw when current URL has no token", () => {
      expect(() =>
        buildDraftEditUrl("https://mp.weixin.qq.com/home", "123")
      ).toThrow("Current URL does not contain token");
    });
  });
});
