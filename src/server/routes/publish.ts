import { Router } from "express";

import { refreshAccountLoginState } from "../../publisher/account-state.js";
import {
  cancelWechatQrLogin,
  checkWechatQrLogin,
  startWechatQrLogin
} from "../../publisher/qr-login.js";
import { runPublishTask } from "../../publisher/task-runner.js";
import { getArticleById } from "../../storage/articles.js";
import {
  clearAccountSession,
  createPublishTask,
  getPublishAccountById,
  getPublishTaskById,
  listPublishAccounts,
  listPublishTasks,
  saveAccountSession,
  updatePublishAccount
} from "../../storage/publish.js";

const router = Router();

function parseCookieHeader(cookieHeader: string): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
}> {
  return cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        throw new Error(`无效的 Cookie 片段: ${item}`);
      }

      const name = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();

      if (!name) {
        throw new Error("Cookie 名称不能为空。");
      }

      return {
        name,
        value,
        domain: "mp.weixin.qq.com",
        path: "/"
      };
    });
}

router.get("/accounts", (_req, res) => {
  res.json({
    items: listPublishAccounts()
  });
});

router.post("/accounts/:accountId/session", (req, res) => {
  const account = getPublishAccountById(req.params.accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  let cookies = req.body.cookies;
  if (typeof req.body.cookieHeader === "string" && req.body.cookieHeader.trim()) {
    try {
      cookies = parseCookieHeader(req.body.cookieHeader.trim());
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Cookie 字符串解析失败。"
      });
    }
  }

  if (!Array.isArray(cookies)) {
    return res.status(400).json({
      error: "cookies 必须是数组，或提供 cookieHeader 字符串。"
    });
  }

  const sessionFilePath = saveAccountSession(account.id, cookies);
  const updated = updatePublishAccount({
    ...account,
    status: "ready",
    note: "已导入本地 Session，等待下一次登录态校验。",
    lastValidatedAt: account.lastValidatedAt,
    latestLoginProbe: account.latestLoginProbe ?? null,
    latestDraftProbe: account.latestDraftProbe ?? null
  });

  return res.json({
    account: updated,
    sessionFilePath
  });
});

router.delete("/accounts/:accountId/session", (req, res) => {
  const account = getPublishAccountById(req.params.accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  clearAccountSession(account.id);
  const updated = updatePublishAccount({
    ...account,
    status: "expired",
    note: "已清除本地 Session，需要重新导入或扫码登录。",
    lastValidatedAt: account.lastValidatedAt,
    latestLoginProbe: null,
    latestDraftProbe: null
  });

  return res.json(updated);
});

router.post("/accounts/:accountId/refresh", async (req, res) => {
  const account = getPublishAccountById(req.params.accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  const result = await refreshAccountLoginState(account.id);

  return res.json({
    account: result.account,
    probe: result.probe
  });
});

router.post("/accounts/:accountId/qr-login/start", async (req, res) => {
  const account = getPublishAccountById(req.params.accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  const result = await startWechatQrLogin(account);
  return res.json(result);
});

router.get("/accounts/:accountId/qr-login/:sessionId", async (req, res) => {
  const account = getPublishAccountById(req.params.accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  const result = await checkWechatQrLogin(account, req.params.sessionId);
  if (result.status === "expired" && !result.screenshotPath) {
    return res.status(404).json({
      error: "二维码登录会话不存在或已失效。"
    });
  }

  return res.json(result);
});

router.delete("/accounts/:accountId/qr-login/:sessionId", async (req, res) => {
  const removed = await cancelWechatQrLogin(req.params.accountId, req.params.sessionId);
  if (!removed) {
    return res.status(404).json({
      error: "二维码登录会话不存在或已失效。"
    });
  }

  return res.json({
    ok: true
  });
});

router.get("/tasks", (req, res) => {
  const articleId = typeof req.query.articleId === "string" ? req.query.articleId : undefined;

  res.json({
    items: listPublishTasks(articleId)
  });
});

router.get("/tasks/:taskId", (req, res) => {
  const task = getPublishTaskById(req.params.taskId);

  if (!task) {
    return res.status(404).json({
      error: "未找到对应的发布任务。"
    });
  }

  return res.json(task);
});

router.post("/tasks", (req, res) => {
  const articleId = String(req.body.articleId ?? "");
  const accountId = String(req.body.accountId ?? "");

  if (!articleId) {
    return res.status(400).json({
      error: "缺少 articleId。"
    });
  }

  if (!accountId) {
    return res.status(400).json({
      error: "缺少 accountId。"
    });
  }

  const article = getArticleById(articleId);
  if (!article) {
    return res.status(404).json({
      error: "未找到对应的文章。"
    });
  }

  const account = listPublishAccounts().find((item) => item.id === accountId);
  if (!account) {
    return res.status(404).json({
      error: "未找到对应的发布账号。"
    });
  }

  const latestExistingTask =
    listPublishTasks(articleId).find(
      (item) => item.accountId === accountId && item.draftAppmsgId
    ) ?? null;

  const task = createPublishTask({
    articleId,
    accountId,
    draftAppmsgId: latestExistingTask?.draftAppmsgId ?? null
  });

  return res.status(201).json(task);
});

router.post("/tasks/:taskId/run", async (req, res) => {
  const task = getPublishTaskById(req.params.taskId);

  if (!task) {
    return res.status(404).json({
      error: "未找到对应的发布任务。"
    });
  }

  const updatedTask = await runPublishTask(task.id);
  return res.json(updatedTask);
});

export default router;
