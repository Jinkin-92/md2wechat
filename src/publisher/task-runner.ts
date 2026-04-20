import {
  refreshAccountDraftProbe,
  refreshAccountLoginState
} from "./account-state.js";
import { publishWechatDraft } from "./editor-publish.js";
import { WECHAT_SELECTORS } from "./selectors.js";
import { getArticleById } from "../storage/articles.js";
import {
  getPublishAccountById,
  getPublishTaskById,
  updatePublishTask,
  updatePublishTaskStatus,
  updatePublishTaskStep
} from "../storage/publish.js";
import type { PublishTask } from "../shared/types.js";

const runningTasks = new Set<string>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStep(taskId: string, stepKey: string, detail: string): Promise<void> {
  updatePublishTaskStep({ taskId, stepKey, status: "running", detail });
  await delay(200);
}

async function completeStep(taskId: string, stepKey: string, detail: string): Promise<void> {
  updatePublishTaskStep({ taskId, stepKey, status: "success", detail });
  await delay(120);
}

function failTask(taskId: string, stepKey: string, detail: string): PublishTask | null {
  updatePublishTaskStep({ taskId, stepKey, status: "failed", detail });
  return updatePublishTaskStatus(taskId, "failed");
}

export function getDefaultStepDetail(stepKey: string): string {
  switch (stepKey) {
    case "session-check":
      return "等待加载本地 Session 并校验公众号登录态。";
    case "draft-open":
      return "等待进入公众号后台并定位草稿入口。";
    case "content-fill":
      return "等待写入标题、摘要、正文、正文图片和封面。";
    case "draft-save":
      return "等待保存草稿并回收复检结果。";
    default:
      return "等待执行。";
  }
}

export function extractDraftAppmsgId(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).searchParams.get("appmsgid");
  } catch {
    return null;
  }
}

export async function runPublishTask(taskId: string): Promise<PublishTask> {
  if (runningTasks.has(taskId)) {
    const existingTask = getPublishTaskById(taskId);
    if (!existingTask) {
      throw new Error("未找到对应的发布任务。");
    }
    return existingTask;
  }

  const task = getPublishTaskById(taskId);
  if (!task) {
    throw new Error("未找到对应的发布任务。");
  }

  const account = getPublishAccountById(task.accountId);
  if (!account) {
    throw new Error("未找到对应的发布账号。");
  }

  const article = getArticleById(task.articleId);
  if (!article) {
    throw new Error("未找到对应的文章。");
  }

  updatePublishTask({
    ...task,
    result: null,
    status: "pending",
    steps: task.steps.map((step) => ({
      ...step,
      status: "pending",
      detail: getDefaultStepDetail(step.key)
    }))
  });

  runningTasks.add(taskId);
  updatePublishTaskStatus(taskId, "running");

  let currentStepKey = "session-check";

  try {
    currentStepKey = "session-check";
    await runStep(taskId, "session-check", `正在检查账号"${account.name}"的登录态，并尝试复用本地 Session。`);
    const { probe: loginProbe } = await refreshAccountLoginState(account.id);

    await completeStep(
      taskId,
      "session-check",
      `已打开公众号入口，页面标题为"${loginProbe.pageTitle}"，当前状态=${loginProbe.loginState}，${loginProbe.usedStoredSession ? "已加载本地 Session" : "未发现可用 Session"}，截图=${loginProbe.screenshotPath}。`
    );

    currentStepKey = "draft-open";
    await runStep(taskId, "draft-open", "正在进入公众号后台首页并定位草稿入口。");

    if (loginProbe.loginState !== "authenticated") {
      const failedTask = failTask(
        taskId,
        "draft-open",
        `当前仍处于未登录状态，未能进入后台草稿箱。入口地址=${loginProbe.finalUrl}。请先导入可用 Session 或完成扫码登录。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    const { probe: draftProbe } = await refreshAccountDraftProbe({
      accountId: account.id,
      loginProbe,
      draftAppmsgId: task.draftAppmsgId,
      articleTitle: article.title
    });

    if (!draftProbe.backendReachable) {
      const failedTask = failTask(
        taskId,
        "draft-open",
        `尝试进入后台首页失败，当前地址=${draftProbe.finalUrl}，截图=${draftProbe.screenshotPath}。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    if (!draftProbe.draftEntryDetected) {
      const failedTask = failTask(
        taskId,
        "draft-open",
        `已进入后台首页，但尚未定位到草稿入口。当前页面标题"${draftProbe.pageTitle}"，截图=${draftProbe.screenshotPath}。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    if (!draftProbe.editorReachable) {
      const failedTask = failTask(
        taskId,
        "draft-open",
        `已识别到草稿入口 ${draftProbe.matchedSelector ?? "unknown"}，但还未稳定进入编辑器。当前地址=${draftProbe.finalUrl}，截图=${draftProbe.screenshotPath}。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    await completeStep(
      taskId,
      "draft-open",
      `已进入编辑器，草稿入口选择器=${draftProbe.matchedSelector ?? WECHAT_SELECTORS.createDraftEntryCandidates[0]}，标题输入框=${draftProbe.matchedTitleSelector ?? "未命中"}，编辑器地址=${draftProbe.editorUrl ?? draftProbe.finalUrl}。`
    );

    currentStepKey = "content-fill";

    await runStep(taskId, "content-fill", "正在写入标题、摘要、正文、正文图片和封面。");

    const draftPublishResult = await publishWechatDraft({
      accountId: account.id,
      accountName: account.name,
      article,
      editorUrl: draftProbe.editorUrl ?? draftProbe.finalUrl
    });

    if (draftPublishResult.stage === "content-fill") {
      const failedTask = failTask(
        taskId,
        "content-fill",
        `${draftPublishResult.detail} 截图=${draftPublishResult.screenshotPath}。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    await completeStep(
      taskId,
      "content-fill",
      `已写入文章"${article.title}"的标题、摘要和正文，正文图片=${draftPublishResult.insertedBodyImagePaths.length} 张，封面=${draftPublishResult.coverImageApplied ? "已应用" : "未应用"}。`
    );

    currentStepKey = "draft-save";
    await runStep(taskId, "draft-save", "正在保存草稿并回收复检结果。");

    if (!draftPublishResult.saveSelector || !draftPublishResult.saveSuccessText) {
      const failedTask = failTask(
        taskId,
        "draft-save",
        `${draftPublishResult.detail} 截图=${draftPublishResult.screenshotPath}。`
      );
      if (!failedTask) {
        throw new Error("任务失败时未能写回状态。");
      }
      return failedTask;
    }

    await completeStep(
      taskId,
      "draft-save",
      `已点击 ${draftPublishResult.saveSelector} 并收到"${draftPublishResult.saveSuccessText}"，保存后复检富文本=${draftPublishResult.reopenRichTextPreserved ? "是" : "否"}。`
    );

    const completedTask = updatePublishTask({
      ...(getPublishTaskById(taskId) ?? task),
      draftAppmsgId: extractDraftAppmsgId(draftPublishResult.finalUrl),
      result: {
        saveScreenshotPath: draftPublishResult.screenshotPath,
        reopenScreenshotPath: draftPublishResult.reopenScreenshotPath,
        reopenUrl: draftPublishResult.reopenUrl,
        saveSuccessText: draftPublishResult.saveSuccessText,
        coverImageApplied: draftPublishResult.coverImageApplied,
        coverImagePath: draftPublishResult.coverImagePath,
        insertedBodyImagePaths: draftPublishResult.insertedBodyImagePaths,
        missingBodyImagePaths: draftPublishResult.missingBodyImagePaths,
        reopenRichTextPreserved: draftPublishResult.reopenRichTextPreserved
      },
      status: "success"
    });
    if (!completedTask) {
      throw new Error("任务完成后未能写回状态。");
    }

    return completedTask;
  } catch (error) {
    const message = error instanceof Error ? error.message : "发布任务执行失败。";
    const failedTask = failTask(taskId, currentStepKey, message);
    if (!failedTask) {
      throw new Error(message);
    }
    return failedTask;
  } finally {
    runningTasks.delete(taskId);
  }
}