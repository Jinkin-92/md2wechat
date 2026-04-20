import type {
  ArticleDetail,
  ArticleReadiness,
  LatestPublishSummary,
  PublishAccount,
  PublishTask
} from "../types";

function sortTasksByUpdatedAt(tasks: PublishTask[]): PublishTask[] {
  return [...tasks].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function getLatestSuccessfulTask(tasks: PublishTask[]): PublishTask | null {
  return sortTasksByUpdatedAt(tasks).find((task) => task.status === "success") ?? null;
}

export function buildLatestPublishSummary(task: PublishTask | null): LatestPublishSummary | null {
  if (!task || !task.result) {
    return null;
  }

  return {
    taskId: task.id,
    draftAppmsgId: task.draftAppmsgId,
    insertedImageCount: task.result.insertedBodyImagePaths.length,
    coverApplied: task.result.coverImageApplied,
    saveScreenshotPath: task.result.saveScreenshotPath,
    reopenScreenshotPath: task.result.reopenScreenshotPath,
    reopenRichTextPreserved: task.result.reopenRichTextPreserved,
    updatedAt: task.updatedAt
  };
}

export function buildArticleReadiness(article: ArticleDetail | null, tasks: PublishTask[]): ArticleReadiness {
  const blockingIssues: string[] = [];
  const warningIssues: string[] = [];

  if (!article) {
    return {
      blockingIssues: ["请先选择一篇文章。"],
      warningIssues: [],
      completionPercent: 0,
      latestPublishSummary: null
    };
  }

  if (article.status !== "rendered") {
    blockingIssues.push("文章还没有生成最新预览。");
  }

  const hasCover = Boolean(article.mediaAssets.coverStorageKey || article.mediaAssets.coverLocalPath);
  if (!hasCover) {
    blockingIssues.push("请先上传封面素材。");
  }

  if (!article.metadata.author.trim()) {
    warningIssues.push("建议补齐作者。");
  }

  if (!article.metadata.digest.trim()) {
    warningIssues.push("建议补齐摘要。");
  }

  const bodySlots = article.mediaAssets.bodyImages;
  const configuredSlots = bodySlots.filter((item) => item.storageKey || item.localPath).length;
  if (bodySlots.length > 0 && configuredSlots < bodySlots.length) {
    warningIssues.push(`正文图片位仅配置了 ${configuredSlots}/${bodySlots.length} 个。`);
  }

  const latestSuccessfulTask = getLatestSuccessfulTask(tasks);
  if (!latestSuccessfulTask?.result?.reopenRichTextPreserved) {
    warningIssues.push("还没有最近一次发布复检结果。");
  }

  const checks = [
    Boolean(article.title.trim()),
    Boolean(article.metadata.author.trim()),
    Boolean(article.metadata.digest.trim()),
    article.status === "rendered",
    hasCover,
    bodySlots.length === 0 || configuredSlots === bodySlots.length,
    Boolean(latestSuccessfulTask?.result?.reopenRichTextPreserved)
  ];
  const completionPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    blockingIssues,
    warningIssues,
    completionPercent,
    latestPublishSummary: buildLatestPublishSummary(latestSuccessfulTask)
  };
}

export function getPublishGateState(input: {
  article: ArticleDetail | null;
  selectedAccount: PublishAccount | null;
  tasks: PublishTask[];
}) {
  const readiness = buildArticleReadiness(input.article, input.tasks);
  const blockingIssues = [...readiness.blockingIssues];
  const warningIssues = [...readiness.warningIssues];

  if (!input.selectedAccount) {
    blockingIssues.push("请先选择发布账号。");
  } else {
    if (input.selectedAccount.latestLoginProbe?.loginState !== "authenticated") {
      blockingIssues.push("当前账号尚未通过登录校验。");
    }
  }

  return {
    blockingIssues,
    warningIssues,
    readiness
  };
}
