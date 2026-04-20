import { Router } from "express";

import { listTemplates } from "../../renderer/templates.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    items: listTemplates()
  });
});

export default router;
