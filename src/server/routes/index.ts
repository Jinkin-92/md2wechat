import { Router } from "express";

import agentsRouter from "./agents.js";
import aiRouter from "./ai.js";
import articlesRouter from "./articles.js";
import convertRouter from "./convert.js";
import healthRouter from "./health.js";
import metricsRouter from "./metrics.js";
import publishRouter from "./publish.js";
import templatesRouter from "./templates.js";

const router = Router();

router.use("/agents", agentsRouter);
router.use("/convert", convertRouter);
router.use("/health", healthRouter);
router.use("/ai", aiRouter);
router.use("/articles", articlesRouter);
router.use("/templates", templatesRouter);
router.use("/publish", publishRouter);
router.use("/metrics", metricsRouter);

export default router;
