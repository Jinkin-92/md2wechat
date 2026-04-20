import { Router } from "express";

import articlesRouter from "./articles.js";
import healthRouter from "./health.js";
import metricsRouter from "./metrics.js";
import publishRouter from "./publish.js";
import templatesRouter from "./templates.js";

const router = Router();

router.use("/health", healthRouter);
router.use("/articles", articlesRouter);
router.use("/templates", templatesRouter);
router.use("/publish", publishRouter);
router.use("/metrics", metricsRouter);

export default router;
