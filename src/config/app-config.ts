import path from "node:path";

import type { AppConfig } from "../shared/types.js";

export function getAppConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3410),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5373",
    dataDir: path.resolve(process.cwd(), process.env.DATA_DIR ?? "./data"),
    wechatBaseUrl: process.env.WECHAT_BASE_URL ?? "https://mp.weixin.qq.com"
  };
}
