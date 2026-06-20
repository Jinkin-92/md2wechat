import fs from "node:fs";
import path from "node:path";

import cors from "cors";
import express from "express";

import { getAppConfig } from "../config/app-config.js";
import router from "./routes/index.js";

const config = getAppConfig();
const app = express();

fs.mkdirSync(config.dataDir, { recursive: true });

app.use(
  cors({
    origin: config.corsOrigin
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/data", express.static(path.resolve(config.dataDir)));
app.use("/api", router);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    return res.status(400).json({
      error: "请求体不是合法的 JSON。"
    });
  }

  console.error(error);

  return res.status(500).json({
    error: "服务内部错误。"
  });
});

app.listen(config.port, () => {
  console.log(`md2wechat api listening on http://localhost:${config.port}`);
});

// 兜底:Puppeteer / 第三方库抛 unhandledRejection 不能让整个 server 死。
// (Chrome CDP 协议错误、扫码超时、网络抖动都可能触发)
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection (caught, server kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException (caught, server kept alive):", err);
});
