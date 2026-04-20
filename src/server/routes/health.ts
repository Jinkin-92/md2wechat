import { Router } from "express";

import type { HealthStatus } from "../../shared/types.js";

const router = Router();

router.get("/", (_req, res) => {
  const payload: HealthStatus = {
    status: "ok",
    service: "md2wechat-api",
    timestamp: new Date().toISOString()
  };

  res.json(payload);
});

export default router;
