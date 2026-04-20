import { describe, it, expect } from "vitest";
import { inferLoginState } from "../src/publisher/login.js";

describe("login", () => {
  describe("inferLoginState", () => {
    it("should return authenticated when URL has cgi-bin and title does not include login", () => {
      const result = inferLoginState(
        "https://mp.weixin.qq.com/cgi-bin/home?t=home/index",
        "公众号平台"
      );
      expect(result).toBe("authenticated");
    });

    it("should return authenticated for complex token URL", () => {
      const result = inferLoginState(
        "https://mp.weixin.qq.com/cgi-bin/appmsg?action=list&t=media/appmsg_list&lang=zh_CN&token=123456789",
        "素材管理"
      );
      expect(result).toBe("authenticated");
    });

    it("should return login_required when URL does not have cgi-bin", () => {
      const result = inferLoginState(
        "https://mp.weixin.qq.com/",
        "微信公众平台"
      );
      expect(result).toBe("login_required");
    });

    it("should return login_required when title includes login", () => {
      const result = inferLoginState(
        "https://mp.weixin.qq.com/cgi-bin/home?t=home/index",
        "登录"
      );
      expect(result).toBe("login_required");
    });

    it("should return login_required when title includes 登录", () => {
      const result = inferLoginState(
        "https://mp.weixin.qq.com/cgi-bin/home",
        "请登录"
      );
      expect(result).toBe("login_required");
    });
  });
});
