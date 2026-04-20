import { Router } from "express";
import { listPublishTasks, listPublishAccounts } from "../../storage/publish.js";

const router = Router();

router.get("/summary", (_req, res) => {
  const tasks = listPublishTasks();
  const accounts = listPublishAccounts();

  const statusCounts = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
  };

  for (const task of tasks) {
    statusCounts[task.status]++;
  }

  const totalTasks = tasks.length;
  const successRate =
    totalTasks > 0 ? Math.round((statusCounts.success / totalTasks) * 100) : 0;

  const tasksByAccount: Record<string, number> = {};
  for (const account of accounts) {
    tasksByAccount[account.name] = 0;
  }
  for (const task of tasks) {
    const account = accounts.find((a) => a.id === task.accountId);
    if (account) {
      tasksByAccount[account.name]++;
    }
  }

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)
    .map((task) => ({
      id: task.id,
      articleId: task.articleId,
      status: task.status,
      updatedAt: task.updatedAt,
    }));

  res.json({
    totalTasks,
    statusCounts,
    successRate,
    tasksByAccount,
    recentTasks,
  });
});

export default router;
