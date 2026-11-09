import { Router } from "express";
import { detectAgents } from "../../agents/argv.js";

const router = Router();

/**
 * GET /api/agents
 * 检测已安装的 coding-agent CLI
 */
router.get("/", (_req, res) => {
  const agents = detectAgents();
  return res.json({ agents });
});

export default router;