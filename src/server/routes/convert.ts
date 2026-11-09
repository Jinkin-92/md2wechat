import { Router } from "express";
import { spawnAgentStream, getAgentAdapter } from "../../agents/argv.js";

const router = Router();

/**
 * GET /api/convert
 * 使用本地 CLI 流式生成 HTML (SSE)
 * Query: agent, input, system
 */
router.get("/", (req, res) => {
  const agentId = typeof req.query.agent === "string" ? req.query.agent : "";
  const input = typeof req.query.input === "string" ? req.query.input : "";
  const system = typeof req.query.system === "string" ? req.query.system : "";

  if (!agentId || !input) {
    return res.status(400).json({ error: "缺少 agent 或 input 参数" });
  }

  const adapter = getAgentAdapter(agentId);
  if (!adapter) {
    return res.status(400).json({ error: `不支持的 agent: ${agentId}` });
  }

  // 设置 SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const systemPrompt = system || "你是一个专业的微信公众号排版助手。";

  let html = "";
  let isFinished = false;

  const cleanup = spawnAgentStream(
    agentId,
    systemPrompt,
    input,
    (chunk) => {
      if (isFinished) return;

      if (chunk.done) {
        isFinished = true;
        res.write(`data: ${JSON.stringify({ done: true, html })}\n\n`);
        res.end();
        return;
      }

      if (chunk.html) {
        html += chunk.html;
        res.write(`data: ${JSON.stringify({ html })}\n\n`);
      } else if (chunk.text) {
        html += chunk.text;
        res.write(`data: ${JSON.stringify({ html })}\n\n`);
      }

      if (chunk.error) {
        res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
      }
    },
    (err) => {
      if (!isFinished) {
        isFinished = true;
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  );

  // 客户端断开连接时清理
  req.on("close", () => {
    isFinished = true;
    cleanup();
  });
});

export default router;