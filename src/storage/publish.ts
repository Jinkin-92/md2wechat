import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  PublishAccount,
  PublishTask,
  PublishTaskResult,
  PublishTaskStatus,
  PublishTaskStep
} from "../shared/types.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PUBLISH_DIR = path.join(DATA_DIR, "publish");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const ACCOUNTS_FILE = path.join(PUBLISH_DIR, "accounts.json");
const TASKS_FILE = path.join(PUBLISH_DIR, "tasks.json");

const defaultAccounts: Omit<
  PublishAccount,
  "hasStoredSession" | "sessionFilePath" | "latestLoginProbe" | "latestDraftProbe"
>[] = [
  {
    id: "acct_main",
    name: "产业观察主号",
    status: "ready",
    lastValidatedAt: new Date().toISOString(),
    note: "当前默认联调账号，可直接用于后续自动化登录链路。"
  },
  {
    id: "acct_backup",
    name: "测试草稿号",
    status: "expired",
    lastValidatedAt: null,
    note: "需要重新登录验证，适合作为失效状态演示数据。"
  }
];

function getSessionFilePath(accountId: string): string {
  return path.join(SESSIONS_DIR, `${accountId}.cookies.json`);
}

function withSessionMetadata(
  account: Omit<PublishAccount, "hasStoredSession" | "sessionFilePath">
): PublishAccount {
  const sessionFilePath = getSessionFilePath(account.id);
  const hasStoredSession = fs.existsSync(sessionFilePath);

  return {
    ...account,
    hasStoredSession,
    sessionFilePath: hasStoredSession ? sessionFilePath : null,
    latestLoginProbe: account.latestLoginProbe ?? null,
    latestDraftProbe: account.latestDraftProbe ?? null
  };
}

function normalizeTaskResult(result: PublishTaskResult | null | undefined): PublishTaskResult | null {
  if (!result) {
    return null;
  }

  return {
    saveScreenshotPath: result.saveScreenshotPath ?? null,
    reopenScreenshotPath: result.reopenScreenshotPath ?? null,
    reopenUrl: result.reopenUrl ?? null,
    saveSuccessText: result.saveSuccessText ?? null,
    coverImageApplied: Boolean(result.coverImageApplied),
    coverImagePath: result.coverImagePath ?? null,
    insertedBodyImagePaths: result.insertedBodyImagePaths ?? [],
    missingBodyImagePaths: result.missingBodyImagePaths ?? [],
    reopenRichTextPreserved: Boolean(result.reopenRichTextPreserved)
  };
}

function extractDetailValue(detail: string, prefix: string): string | null {
  const index = detail.indexOf(prefix);
  if (index === -1) {
    return null;
  }

  const sliced = detail.slice(index + prefix.length);
  const endIndex = sliced.search(/[，。\n]/);
  return (endIndex === -1 ? sliced : sliced.slice(0, endIndex)).trim() || null;
}

function backfillTaskResult(task: PublishTask): PublishTaskResult | null {
  const draftSaveStep = task.steps.find((step) => step.key === "draft-save");
  if (!draftSaveStep) {
    return null;
  }

  const detail = draftSaveStep.detail;
  const saveScreenshotPath = extractDetailValue(detail, "保存截图=");
  const reopenScreenshotPath = extractDetailValue(detail, "复检截图=");
  const saveSuccessTextMatch = detail.match(/收到“([^”]+)”/);
  const coverApplied = detail.includes("封面=已应用");
  const richTextPreserved = detail.includes("复检富文本=是");
  const missingRaw = extractDetailValue(detail, "缺失素材=");
  const missingBodyImagePaths =
    missingRaw && missingRaw !== "无" ? missingRaw.split("、").map((item) => item.trim()).filter(Boolean) : [];

  if (!saveScreenshotPath && !reopenScreenshotPath && !saveSuccessTextMatch) {
    return null;
  }

  return {
    saveScreenshotPath,
    reopenScreenshotPath,
    reopenUrl: null,
    saveSuccessText: saveSuccessTextMatch?.[1] ?? null,
    coverImageApplied: coverApplied,
    coverImagePath: null,
    insertedBodyImagePaths: [],
    missingBodyImagePaths,
    reopenRichTextPreserved: richTextPreserved
  };
}

function ensurePublishStorage(): void {
  fs.mkdirSync(PUBLISH_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });

  if (!fs.existsSync(ACCOUNTS_FILE)) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(defaultAccounts, null, 2), "utf8");
  }

  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile(filePath: string, input: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(input, null, 2), "utf8");
}

function readAccounts(): PublishAccount[] {
  ensurePublishStorage();

  const stored = readJsonFile<
    Array<Omit<PublishAccount, "hasStoredSession" | "sessionFilePath">>
  >(ACCOUNTS_FILE);
  return stored.map(withSessionMetadata);
}

function saveAccounts(accounts: PublishAccount[]): void {
  const normalized = accounts.map(
    ({ hasStoredSession, sessionFilePath, latestLoginProbe, latestDraftProbe, ...rest }) => ({
      ...rest,
      latestLoginProbe: latestLoginProbe ?? null,
      latestDraftProbe: latestDraftProbe ?? null
    })
  );
  writeJsonFile(ACCOUNTS_FILE, normalized);
}

function readTasks(): PublishTask[] {
  ensurePublishStorage();
  return readJsonFile<PublishTask[]>(TASKS_FILE).map((task) => ({
    ...task,
    draftAppmsgId: task.draftAppmsgId ?? null,
    result: normalizeTaskResult(task.result) ?? backfillTaskResult(task)
  }));
}

function saveTasks(tasks: PublishTask[]): void {
  writeJsonFile(TASKS_FILE, tasks);
}

function updateTaskInList(tasks: PublishTask[], nextTask: PublishTask): PublishTask[] {
  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

export function getAccountSessionFilePath(accountId: string): string {
  ensurePublishStorage();
  return getSessionFilePath(accountId);
}

export function saveAccountSession(accountId: string, cookies: unknown[]): string {
  ensurePublishStorage();
  const sessionFilePath = getSessionFilePath(accountId);
  writeJsonFile(sessionFilePath, cookies);
  return sessionFilePath;
}

export function clearAccountSession(accountId: string): void {
  ensurePublishStorage();
  const sessionFilePath = getSessionFilePath(accountId);
  if (fs.existsSync(sessionFilePath)) {
    fs.unlinkSync(sessionFilePath);
  }
}

export function listPublishAccounts(): PublishAccount[] {
  return readAccounts();
}

export function getPublishAccountById(accountId: string): PublishAccount | null {
  return readAccounts().find((account) => account.id === accountId) ?? null;
}

export function updatePublishAccount(account: PublishAccount): PublishAccount {
  const accounts = readAccounts();
  const nextAccount = withSessionMetadata({
    id: account.id,
    name: account.name,
    status: account.status,
    lastValidatedAt: account.lastValidatedAt,
    note: account.note,
    latestLoginProbe: account.latestLoginProbe ?? null,
    latestDraftProbe: account.latestDraftProbe ?? null
  });

  saveAccounts(accounts.map((item) => (item.id === account.id ? nextAccount : item)));
  return nextAccount;
}

export function listPublishTasks(articleId?: string): PublishTask[] {
  const tasks = readTasks().sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (!articleId) {
    return tasks;
  }

  return tasks.filter((task) => task.articleId === articleId);
}

export function getPublishTaskById(taskId: string): PublishTask | null {
  return readTasks().find((task) => task.id === taskId) ?? null;
}

export function createPublishTask(input: {
  articleId: string;
  accountId: string;
  draftAppmsgId?: string | null;
}): PublishTask {
  const tasks = readTasks();
  const now = new Date().toISOString();

  const task: PublishTask = {
    id: `task_${Date.now()}_${randomUUID().slice(0, 8)}`,
    articleId: input.articleId,
    accountId: input.accountId,
    draftAppmsgId: input.draftAppmsgId ?? null,
    result: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        key: "session-check",
        label: "检查账号登录态",
        status: "pending",
        detail: "等待加载本地 Session 并校验公众号入口。"
      },
      {
        key: "draft-open",
        label: "进入公众号草稿",
        status: "pending",
        detail: "等待进入后台并定位草稿入口。"
      },
      {
        key: "content-fill",
        label: "写入内容与素材",
        status: "pending",
        detail: "等待写入标题、摘要、正文、正文图片和封面。"
      },
      {
        key: "draft-save",
        label: "保存并复检草稿",
        status: "pending",
        detail: "等待保存草稿并回收复检结果。"
      }
    ]
  };

  tasks.unshift(task);
  saveTasks(tasks);
  return task;
}

export function updatePublishTask(task: PublishTask): PublishTask {
  const tasks = readTasks();
  const nextTask: PublishTask = {
    ...task,
    result: normalizeTaskResult(task.result),
    updatedAt: new Date().toISOString()
  };

  saveTasks(updateTaskInList(tasks, nextTask));
  return nextTask;
}

export function updatePublishTaskStatus(taskId: string, status: PublishTaskStatus): PublishTask | null {
  const task = getPublishTaskById(taskId);
  if (!task) {
    return null;
  }

  return updatePublishTask({
    ...task,
    status
  });
}

export function updatePublishTaskStep(input: {
  taskId: string;
  stepKey: string;
  status: PublishTaskStatus;
  detail: string;
}): PublishTask | null {
  const task = getPublishTaskById(input.taskId);
  if (!task) {
    return null;
  }

  const nextSteps: PublishTaskStep[] = task.steps.map((step) =>
    step.key === input.stepKey
      ? {
          ...step,
          status: input.status,
          detail: input.detail
        }
      : step
  );

  return updatePublishTask({
    ...task,
    steps: nextSteps
  });
}
