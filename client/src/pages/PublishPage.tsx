import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  buildDataFileUrl,
  buildStoredAssetUrl,
  clearPublishSession,
  createPublishTask,
  getArticle,
  getPublishAccounts,
  getPublishTasks,
  importPublishSession,
  refreshPublishAccount,
  runPublishTask,
  updateArticleMetadata
} from "../lib/api";
import { buildArticleReadiness, getLatestSuccessfulTask, getPublishGateState } from "../lib/article-readiness";
import { readWorkbenchState } from "../lib/workbench";
import type { ArticleDetail, PublishAccount, PublishTask, PublishTaskStatus } from "../types";

const statusLabel: Record<PublishTaskStatus, string> = {
  pending: "待执行",
  running: "执行中",
  success: "已完成",
  failed: "失败"
};

const accountStatusLabel: Record<PublishAccount["status"], string> = {
  ready: "可用",
  expired: "需重登",
  offline: "离线"
};

export function PublishPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workbenchState = readWorkbenchState();
  const articleId = searchParams.get("articleId") ?? workbenchState.selectedArticleId;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [accounts, setAccounts] = useState<PublishAccount[]>([]);
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(articleId));
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState("");
  const [sessionInput, setSessionInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredTasks = useMemo(
    () => tasks.filter((t) => !articleId || t.articleId === articleId),
    [articleId, tasks]
  );

  const latestTask = useMemo(() => getLatestSuccessfulTask(filteredTasks), [filteredTasks]);
  const selectedTask = useMemo(
    () =>
      selectedTaskId
        ? filteredTasks.find((t) => t.id === selectedTaskId) ?? null
        : latestTask ?? filteredTasks[0] ?? null,
    [filteredTasks, latestTask, selectedTaskId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const readiness = useMemo(() => buildArticleReadiness(article, filteredTasks), [article, filteredTasks]);
  const gateState = useMemo(
    () => getPublishGateState({ article, selectedAccount, tasks: filteredTasks }),
    [article, selectedAccount, filteredTasks]
  );

  const bodyReadyCount =
    article?.mediaAssets.bodyImages.filter((item) => item.storageKey || item.localPath).length ?? 0;
  const coverPreviewUrl = buildStoredAssetUrl(article?.mediaAssets.coverStorageKey ?? null);
  const saveScreenshotUrl = buildDataFileUrl(selectedTask?.result?.saveScreenshotPath ?? null);
  const reopenScreenshotUrl = buildDataFileUrl(selectedTask?.result?.reopenScreenshotPath ?? null);

  async function loadAccounts() {
    const next = await getPublishAccounts();
    setAccounts(next);
    if (!selectedAccountId && next.length > 0) {
      const def = next.find((a) => a.status === "ready") ?? next[0];
      setSelectedAccountId(def?.id ?? "");
    }
  }

  async function loadTasks() {
    const next = await getPublishTasks(articleId || undefined);
    setTasks(next);
    if (!selectedTaskId) {
      setSelectedTaskId(getLatestSuccessfulTask(next)?.id ?? next[0]?.id ?? "");
    }
  }

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      await Promise.all([loadAccounts(), loadTasks()]);
      if (articleId) {
        const art = await getArticle(articleId);
        setArticle(art);
      }
      setIsLoading(false);
    }
    void load();
  }, [articleId]);

  useEffect(() => {
    if (tasks.some((t) => t.status === "running")) {
      const timer = window.setInterval(() => {
        void loadTasks();
        void loadAccounts();
      }, 1500);
      return () => window.clearInterval(timer);
    }
  }, [tasks]);

  async function handleCreateTask() {
    if (!articleId) return;
    if (gateState.blockingIssues.length > 0) {
      setError(gateState.blockingIssues.join("；"));
      return;
    }
    setIsCreating(true);
    setError("");
    try {
      const task = await createPublishTask({ articleId, accountId: selectedAccountId });
      setTasks((prev) => [task, ...prev]);
      setSelectedTaskId(task.id);
      setMessage("任务已创建");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRunTask(taskId: string) {
    setRunningTaskId(taskId);
    try {
      await runPublishTask(taskId);
      await loadTasks();
      await loadAccounts();
      setMessage("任务执行完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setRunningTaskId("");
    }
  }

  async function handleImportSession() {
    if (!selectedAccountId || !sessionInput.trim()) return;
    setIsRefreshing(true);
    try {
      const payload = sessionInput.trim().startsWith("[")
        ? { cookies: JSON.parse(sessionInput) as unknown[] }
        : { cookieHeader: sessionInput };
      await importPublishSession({ accountId: selectedAccountId, ...payload });
      await loadAccounts();
      setMessage("Session 已导入");
      setSessionInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleRefreshAccount() {
    if (!selectedAccountId) return;
    setIsRefreshing(true);
    try {
      await refreshPublishAccount(selectedAccountId);
      await loadAccounts();
      setMessage("账号已校验");
    } catch (err) {
      setError(err instanceof Error ? err.message : "校验失败");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleClearSession() {
    if (!selectedAccountId) return;
    try {
      await clearPublishSession(selectedAccountId);
      await loadAccounts();
      setMessage("Session 已清除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "清除失败");
    }
  }

  if (!articleId) {
    return (
      <div className="page-header">
        <h1>发布验收</h1>
        <p>请先从文章工作台选择一篇文章</p>
        <button className="btn btn-primary" onClick={() => navigate("/preview")} style={{ marginTop: "20px" }}>
          前往文章工作台
        </button>
      </div>
    );
  }

  return (
    <div className="grid-publish">
      {/* Left: Config */}
      <div className="stack">
        {/* Article Summary */}
        <div className="card">
          <h2>{article?.title ?? "文章"}</h2>
          <div className="metric-row" style={{ marginTop: "10px" }}>
            <span className="metric">{article?.metadata.author || "未填作者"}</span>
            <span className="metric">{article?.metadata.wordCount ?? 0} 字</span>
            <span className="badge badge-blue">{readiness.completionPercent}% 完成</span>
          </div>

          <div className="checklist" style={{ marginTop: "16px" }}>
            <div className="check-item">
              <span className="check-dot" />
              <span>标题 {article?.title ? "已填写" : "未填写"}</span>
            </div>
            <div className="check-item">
              <span className="check-dot" style={{ background: article?.mediaAssets.coverStorageKey || article?.mediaAssets.coverLocalPath ? "var(--success)" : "var(--text-muted)" }} />
              <span>封面 {article?.mediaAssets.coverStorageKey || article?.mediaAssets.coverLocalPath ? "已配置" : "未配置"}</span>
            </div>
            <div className="check-item">
              <span className="check-dot" style={{ background: bodyReadyCount === article?.mediaAssets.bodyImages.length ? "var(--success)" : "var(--text-muted)" }} />
              <span>正文图片 {bodyReadyCount}/{article?.mediaAssets.bodyImages.length ?? 0}</span>
            </div>
          </div>

          {coverPreviewUrl && (
            <img
              src={coverPreviewUrl}
              alt="封面"
              style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "10px", marginTop: "14px" }}
            />
          )}

          <button
            className="btn btn-secondary"
            style={{ marginTop: "14px", width: "100%" }}
            onClick={() => navigate(`/preview?articleId=${articleId}`)}
          >
            编辑文章
          </button>
        </div>

        {/* Account */}
        <div className="card">
          <p className="section-title">发布账号</p>
          <div className="stack">
            <select
              className="field"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">选择账号</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {accountStatusLabel[acc.status]}
                </option>
              ))}
            </select>

            {selectedAccount && (
              <div className="stack compact">
                <div className="flex items-center gap-2">
                  <span className={`badge ${selectedAccount.status === "ready" ? "badge-green" : "badge-red"}`}>
                    {accountStatusLabel[selectedAccount.status]}
                  </span>
                  <span className="text-muted" style={{ fontSize: "12px" }}>
                    {selectedAccount.hasStoredSession ? "已存 Session" : "无 Session"}
                  </span>
                </div>

                <div className="btn-row compact">
                  <button className="btn btn-secondary" onClick={handleRefreshAccount} disabled={isRefreshing}>
                    {isRefreshing ? "校验中..." : "校验账号"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleClearSession}>
                    清除
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label className="field-label">导入 Session</label>
              <textarea
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                rows={3}
                placeholder="粘贴 cookies JSON 或 cookie 字符串"
              />
            </div>
            <button className="btn btn-secondary" onClick={handleImportSession} disabled={isRefreshing || !sessionInput.trim()}>
              {isRefreshing ? "导入中..." : "导入 Session"}
            </button>
          </div>
        </div>

        {/* Publish Action */}
        <div className="card">
          {gateState.blockingIssues.length > 0 ? (
            <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "12px" }}>
              {gateState.blockingIssues.join("；")}
            </p>
          ) : null}
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => void handleCreateTask()}
            disabled={isCreating || gateState.blockingIssues.length > 0}
          >
            {isCreating ? "创建中..." : "创建发布任务"}
          </button>
        </div>

        {message && <p style={{ color: "var(--success)", fontSize: "13px" }}>{message}</p>}
        {error && <p style={{ color: "var(--error)", fontSize: "13px" }}>{error}</p>}
      </div>

      {/* Right: Task Panel */}
      <div className="stack">
        <div className="card">
          <p className="section-title">发布任务</p>
          {filteredTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 0" }}>
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="empty-state-title">暂无任务</div>
              <div className="empty-state-desc">创建任务后会在此处显示</div>
            </div>
          ) : (
            <div className="stack compact">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`task-card ${selectedTask?.id === task.id ? "active" : ""}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="task-card-header">
                    <div className="task-card-index">
                      {statusLabel[task.status].charAt(0)}
                    </div>
                    <div>
                      <div className="task-card-title">{statusLabel[task.status]}</div>
                      <div className="task-card-time">
                        {new Date(task.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: "14px" }}>
              <h3>任务详情</h3>
              <button
                className="btn btn-primary"
                onClick={() => void handleRunTask(selectedTask.id)}
                disabled={runningTaskId === selectedTask.id || selectedTask.status === "running"}
              >
                {runningTaskId === selectedTask.id || selectedTask.status === "running"
                  ? "执行中..."
                  : "启动任务"}
              </button>
            </div>

            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-item-label">草稿 ID</span>
                <span className="diag-item-value" style={{ fontSize: "12px" }}>
                  {selectedTask.draftAppmsgId ?? "—"}
                </span>
              </div>
              <div className="diag-item">
                <span className="diag-item-label">正文插图</span>
                <span className="diag-item-value">
                  {selectedTask.result?.insertedBodyImagePaths.length ?? 0} 张
                </span>
              </div>
              <div className="diag-item">
                <span className="diag-item-label">封面</span>
                <span className="diag-item-value">
                  {selectedTask.result?.coverImageApplied ? "已应用" : "未应用"}
                </span>
              </div>
              <div className="diag-item">
                <span className="diag-item-label">保存提示</span>
                <span className="diag-item-value">
                  {selectedTask.result?.saveSuccessText ?? "—"}
                </span>
              </div>
              <div className="diag-item wide">
                <span className="diag-item-label">缺失素材</span>
                <span className="diag-item-value">
                  {selectedTask.result?.missingBodyImagePaths.length
                    ? selectedTask.result.missingBodyImagePaths.join("、")
                    : "无"}
                </span>
              </div>
            </div>

            <div className="steps" style={{ marginTop: "14px" }}>
              {selectedTask.steps.map((step) => (
                <div key={step.key} className="step">
                  <div className={`step-indicator ${step.status === "success" ? "pill-success" : step.status === "running" ? "pill-running" : step.status === "failed" ? "pill-failed" : "pill-pending"}`}>
                    {step.status === "success" ? "✓" : step.status === "failed" ? "✗" : step.status === "running" ? "..." : "—"}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{step.label}</div>
                    <div className="step-desc">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {(saveScreenshotUrl || reopenScreenshotUrl) && (
              <div className="diag-grid" style={{ marginTop: "14px" }}>
                {saveScreenshotUrl && (
                  <div className="diag-item wide">
                    <span className="diag-item-label">保存截图</span>
                    <img
                      src={saveScreenshotUrl}
                      alt="保存"
                      style={{ width: "100%", borderRadius: "8px", marginTop: "6px" }}
                    />
                  </div>
                )}
                {reopenScreenshotUrl && (
                  <div className="diag-item wide">
                    <span className="diag-item-label">复检截图</span>
                    <img
                      src={reopenScreenshotUrl}
                      alt="复检"
                      style={{ width: "100%", borderRadius: "8px", marginTop: "6px" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
