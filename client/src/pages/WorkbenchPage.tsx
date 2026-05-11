import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  applySmartTypesetting,
  buildArticleAssetUrl,
  cancelWechatQrLogin,
  checkWechatQrLogin,
  createPublishTask,
  getArticle,
  getArticles,
  getPublishAccounts,
  getTemplates,
  refreshPublishAccount,
  renderArticle,
  runPublishTask,
  startWechatQrLogin,
  updateArticleContent,
  updateArticleMetadata
} from "../lib/api";
import { extractEditableHtml, serializeEditableHtmlToMarkdown } from "../lib/rich-editor";
import { readAppSettings } from "../lib/settings";
import { getTemplateCardStyle } from "../lib/template-style";
import { readWorkbenchState, writeWorkbenchState } from "../lib/workbench";
import type { ArticleDetail, ArticleSummary, PublishAccount, PublishTask, TemplateSummary } from "../types";

function renderTemplateCard(
  template: TemplateSummary,
  isActive: boolean,
  onClick: () => void
) {
  const style = getTemplateCardStyle(template.id);

  return (
    <button
      key={template.id}
      type="button"
      className={`template-visual-card ${isActive ? "active" : ""}`}
      onClick={onClick}
      style={{ background: style.surface }}
    >
      <div
        className="template-visual-preview"
        style={{
          background: style.bg,
          color: style.text,
          fontFamily: style.fontFamily
        }}
      >
        <span className="template-visual-dot" style={{ background: style.accent }} />
        <strong>{template.name}</strong>
      </div>
    </button>
  );
}

export function WorkbenchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workbenchState = useMemo(() => readWorkbenchState(), []);
  const articleId = searchParams.get("articleId");

  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState(articleId ?? workbenchState.selectedArticleId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(workbenchState.selectedTemplateId || "claude");
  const [titleInput, setTitleInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [previewMode, setPreviewMode] = useState<"article" | "feed" | "html">("article");
  const [leftPanel, setLeftPanel] = useState<"templates" | "custom">("templates");
  const [fontSize, setFontSize] = useState("16px");
  const [paragraphIndent, setParagraphIndent] = useState(false);
  const [spacing, setSpacing] = useState<"compact" | "normal" | "relaxed">("normal");
  const [sectionDivider, setSectionDivider] = useState("line");
  const [endMarker, setEndMarker] = useState("none");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isTypesetting, setIsTypesetting] = useState(false);

  // Publish states
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [publishAccounts, setPublishAccounts] = useState<PublishAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<PublishAccount | null>(null);
  const [qrLoginSession, setQrLoginSession] = useState<{ sessionId: string; storageKey: string } | null>(null);
  const [qrLoginStatus, setQrLoginStatus] = useState<"idle" | "loading" | "pending" | "authenticated" | "expired">("idle");
  const [qrCheckError, setQrCheckError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishTask, setPublishTask] = useState<PublishTask | null>(null);
  const [publishError, setPublishError] = useState("");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    writeWorkbenchState({ selectedArticleId, selectedTemplateId });
  }, [selectedArticleId, selectedTemplateId]);

  useEffect(() => {
    async function loadListData() {
      try {
        const [nextArticles, nextTemplates] = await Promise.all([getArticles(), getTemplates()]);
        setArticles(nextArticles);
        setTemplates(nextTemplates);
        if (!selectedArticleId && nextArticles.length > 0) {
          setSelectedArticleId(nextArticles[0].id);
        }
      } catch {
        setError("加载文章列表失败");
      }
    }

    void loadListData();
  }, []);

  const triggerRender = useCallback(
    async (
      nextMarkdown?: string,
      nextTitle?: string,
      nextAuthor?: string,
      optionOverrides?: Partial<{
        fontSize: string;
        spacing: "compact" | "normal" | "relaxed";
        paragraphIndent: boolean;
        paragraphMargin: string;
        sectionDivider: string;
        endMarker: string;
        templateId: string;
      }>
    ) => {
      if (!selectedArticleId) return;

      setIsRendering(true);
      setMessage("");
      try {
        const lineHeightMap = { compact: "1.5", normal: "1.8", relaxed: "2.0" };
        const paragraphMarginMap = { compact: "0 0 10px", normal: "0 0 16px", relaxed: "0 0 24px" };
        const nextSpacing = optionOverrides?.spacing ?? spacing;
        const settings = readAppSettings();
        const payload = await renderArticle(selectedArticleId, optionOverrides?.templateId ?? selectedTemplateId, {
          fontSize: optionOverrides?.fontSize ?? fontSize,
          lineHeight: lineHeightMap[nextSpacing],
          paragraphIndent: optionOverrides?.paragraphIndent ?? paragraphIndent,
          paragraphMargin: optionOverrides?.paragraphMargin ?? paragraphMarginMap[nextSpacing],
          sectionDivider: optionOverrides?.sectionDivider ?? sectionDivider,
          endMarker: optionOverrides?.endMarker ?? endMarker,
          platformName: settings.platformName,
          originalChecked: settings.originalChecked
        });

        const mergedPayload = {
          ...payload,
          rawMarkdown: nextMarkdown ?? payload.rawMarkdown,
          title: nextTitle ?? payload.title,
          metadata: {
            ...payload.metadata,
            author: nextAuthor ?? payload.metadata.author
          }
        };
        setArticle(mergedPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "渲染失败");
      } finally {
        setIsRendering(false);
      }
    },
    [selectedArticleId, selectedTemplateId, fontSize, spacing, paragraphIndent, sectionDivider, endMarker]
  );

  useEffect(() => {
    if (!selectedArticleId) {
      setArticle(null);
      return;
    }

    navigate(`/workbench?articleId=${selectedArticleId}`, { replace: true });

    async function load() {
      try {
        const payload = await getArticle(selectedArticleId);
        const nextTemplateId = payload.templateId ?? "claude";
        const hydratedPayload =
          payload.renderedHtml && payload.templateId
            ? payload
            : await renderArticle(selectedArticleId, nextTemplateId, {
                fontSize: "16px",
                lineHeight: "1.8",
                paragraphIndent: false,
                paragraphMargin: "0 0 16px",
                sectionDivider: "line",
                endMarker: "none",
                platformName: readAppSettings().platformName,
                originalChecked: readAppSettings().originalChecked
              });
        setArticle(hydratedPayload);
        setSelectedTemplateId(nextTemplateId);
        setTitleInput(hydratedPayload.title);
        setAuthorInput(hydratedPayload.metadata.author);
        setContentInput(hydratedPayload.rawMarkdown);
      } catch {
        setError("加载文章失败");
      }
    }

    void load();
  }, [selectedArticleId]);

  useEffect(() => {
    if (!article) return;
    const nextEditorHtml = extractEditableHtml(article.renderedHtml);
    if (editorRef.current && editorRef.current.innerHTML !== nextEditorHtml) {
      editorRef.current.innerHTML = nextEditorHtml;
    }
  }, [article?.renderedHtml, article?.updatedAt]);

  const syncContent = useCallback(
    (nextEditorMarkup: string) => {
      if (!selectedArticleId || !article) return;
      const nextMarkdown = serializeEditableHtmlToMarkdown(nextEditorMarkup, article);
      setContentInput(nextMarkdown);
      if (contentTimeoutRef.current) clearTimeout(contentTimeoutRef.current);
      contentTimeoutRef.current = setTimeout(async () => {
        try {
          await updateArticleContent(selectedArticleId, nextMarkdown);
          await triggerRender(nextMarkdown, titleInput, authorInput);
        } catch {
          setError("正文同步失败");
        }
      }, 500);
    },
    [article, authorInput, selectedArticleId, titleInput, triggerRender]
  );

  const syncMetadata = useCallback(
    (nextTitle: string, nextAuthor: string) => {
      if (metaTimeoutRef.current) clearTimeout(metaTimeoutRef.current);
      metaTimeoutRef.current = setTimeout(async () => {
        if (!selectedArticleId) return;
        try {
          const payload = await updateArticleMetadata(selectedArticleId, {
            title: nextTitle,
            author: nextAuthor,
            digest: article?.metadata.digest ?? ""
          });
          setArticle(payload);
          await triggerRender(contentInput, nextTitle, nextAuthor);
        } catch {
          setError("元数据同步失败");
        }
      }, 400);
    },
    [article?.metadata.digest, contentInput, selectedArticleId, triggerRender]
  );

  async function handleSave() {
    if (!selectedArticleId) return;
    setIsSaving(true);
    setMessage("");
    try {
      const payload = await updateArticleMetadata(selectedArticleId, {
        title: titleInput,
        author: authorInput,
        digest: article?.metadata.digest ?? ""
      });
      setArticle(payload);
      await triggerRender(contentInput, titleInput, authorInput);
      setMessage("已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTemplateSwitch(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!selectedArticleId) return;
    setIsRendering(true);
    try {
      const settings = readAppSettings();
      const payload = await renderArticle(selectedArticleId, templateId, {
        fontSize,
        lineHeight: { compact: "1.5", normal: "1.8", relaxed: "2.0" }[spacing],
        paragraphIndent,
        sectionDivider,
        endMarker,
        platformName: settings.platformName,
        originalChecked: settings.originalChecked
      });
      setArticle(payload);
      setMessage("模板已切换");
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setIsRendering(false);
    }
  }

  async function handleSmartTypeset() {
    if (!selectedArticleId) return;

    const settings = readAppSettings();
    if (!settings.apiKey.trim()) {
      setError("请先在设置页填写 Minimax API Key");
      return;
    }

    setIsTypesetting(true);
    setMessage("");
    setError("");
    try {
      const payload = await applySmartTypesetting({
        articleId: selectedArticleId,
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        model: settings.model
      });
      setArticle(payload);
      setTitleInput(payload.title);
      setAuthorInput(payload.metadata.author);
      setContentInput(payload.rawMarkdown);
      setMessage("智能排版已完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "智能排版失败");
    } finally {
      setIsTypesetting(false);
    }
  }

  function handleCopyHtml() {
    if (!article?.renderedHtml) return;
    void navigator.clipboard.writeText(article.renderedHtml).then(() => {
      setMessage("已复制到剪贴板");
    });
  }

  async function handleOpenPublishModal() {
    setPublishModalVisible(true);
    setQrLoginStatus("idle");
    setQrLoginSession(null);
    setQrCheckError("");
    setPublishError("");
    setPublishTask(null);
    try {
      const accounts = await getPublishAccounts();
      setPublishAccounts(accounts);
      if (accounts.length > 0) {
        const readyAccount = accounts.find((a) => a.status === "ready") ?? accounts[0];
        setSelectedAccount(readyAccount);
        if (readyAccount.status === "ready" && readyAccount.hasStoredSession) {
          // 验证存储的会话是否仍然有效
          setQrLoginStatus("loading");
          try {
            const { probe } = await refreshPublishAccount(readyAccount.id);
            if (probe.loginState === "authenticated") {
              setQrLoginStatus("authenticated");
            } else {
              // 会话已失效，引导重新扫码
              setQrLoginStatus("idle");
              setQrCheckError("登录已过期，请重新扫码登录");
            }
          } catch {
            setQrLoginStatus("idle");
            setQrCheckError("登录状态验证失败，请重新扫码");
          }
        } else {
          setQrLoginStatus("idle");
        }
      } else {
        setSelectedAccount(null);
      }
    } catch {
      setQrCheckError("加载发布账号失败");
    }
  }

  function handleClosePublishModal() {
    setPublishModalVisible(false);
    if (qrLoginSession && selectedAccount) {
      void cancelWechatQrLogin(selectedAccount.id, qrLoginSession.sessionId).catch(() => {});
    }
    setQrLoginSession(null);
    setQrLoginStatus("idle");
  }

  async function handleStartQrLogin() {
    if (!selectedAccount) return;
    setQrLoginStatus("loading");
    setQrCheckError("");
    try {
      const result = await startWechatQrLogin(selectedAccount.id);
      setQrLoginSession({ sessionId: result.sessionId, storageKey: result.storageKey });
      setQrLoginStatus("pending");
      void checkQrLoginLoop(result.sessionId, selectedAccount.id);
    } catch (err) {
      setQrLoginStatus("idle");
      setQrCheckError(err instanceof Error ? err.message : "启动二维码登录失败");
    }
  }

  async function checkQrLoginLoop(sessionId: string, accountId: string) {
    try {
      const result = await checkWechatQrLogin(accountId, sessionId);
      if (result.status === "authenticated") {
        setQrLoginStatus("authenticated");
        const accounts = await getPublishAccounts();
        setPublishAccounts(accounts);
        const updated = accounts.find((a) => a.id === accountId);
        if (updated) setSelectedAccount(updated);
        return;
      } else if (result.status === "expired") {
        setQrLoginStatus("expired");
        setQrCheckError("二维码已过期，请重新获取");
        return;
      }
      setQrLoginStatus("pending");
      setTimeout(() => void checkQrLoginLoop(sessionId, accountId), 2000);
    } catch (err) {
      setQrCheckError(err instanceof Error ? err.message : "检查登录状态失败");
    }
  }

  async function handlePublish() {
    if (!selectedAccount || !selectedArticleId) return;
    setIsPublishing(true);
    setPublishError("");
    try {
      const task = await createPublishTask({ articleId: selectedArticleId, accountId: selectedAccount.id });
      setPublishTask(task);
      const result = await runPublishTask(task.id);
      setPublishTask(result);
      if (result.status === "success") {
        setMessage("发布成功！文章已保存到草稿箱");
        setPublishModalVisible(false);
      } else if (result.status === "failed") {
        const failedStep = result.steps.find((s) => s.status === "failed");
        setPublishError(failedStep?.detail ?? "发布失败");
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "发布失败");
    } finally {
      setIsPublishing(false);
    }
  }

  function buildScreenshotUrl(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const dataMarkerIndex = normalizedPath.toLowerCase().indexOf("/data/");
    if (dataMarkerIndex === -1) return filePath;
    const relativePath = normalizedPath.slice(dataMarkerIndex + "/data/".length);
    return `/data/${relativePath.split("/").map((s) => encodeURIComponent(s)).join("/")}`;
  }

  const wordCount = contentInput.replace(/\s/g, "").length;
  const readTime = Math.max(1, Math.ceil(wordCount / 320));
  const coverPreviewUrl = buildArticleAssetUrl({
    storageKey: article?.mediaAssets.coverStorageKey ?? null,
    localPath: article?.mediaAssets.coverLocalPath ?? article?.coverImage.localPath ?? null
  });
  const digestPreview =
    article?.metadata.digest.trim() ||
    contentInput
      .replace(/^#+\s+/gm, "")
      .split(/\n{2,}/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .find(Boolean)
      ?.slice(0, 84) ||
    "暂无摘要";
  const selectedTemplateStyle = getTemplateCardStyle(selectedTemplateId);

  return (
    <div className="workbench workbench-refined">
      <header className="workbench-topbar">
        <div className="workbench-topbar-left">
          <button className="workbench-icon-btn" onClick={() => navigate("/")} title="首页">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
          <button
            className="workbench-icon-btn"
            onClick={() => navigate("/settings", { state: { from: `${location.pathname}${location.search}` } })}
            title="设置"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </div>

        <div className="workbench-topbar-center">
          <button className="workbench-topbar-btn" onClick={() => void handleSmartTypeset()} disabled={isTypesetting}>
            <svg viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            {isTypesetting ? "智能排版中..." : "智能排版"}
          </button>
          <button className="workbench-topbar-btn" onClick={handleCopyHtml}>复制 HTML</button>
          <button className="workbench-topbar-btn-primary" onClick={() => void handleOpenPublishModal()}>
            <svg viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            发布
          </button>
        </div>

        <div className="workbench-topbar-right">
          <span className="workbench-topbar-article">{articles.find((item) => item.id === selectedArticleId)?.title || "未选择文章"}</span>
        </div>
      </header>

      <div className="workbench-body workbench-body-refined">
        <aside className="workbench-left">
          <div className="workbench-panel-tabs">
            <button
              className={`workbench-panel-tab ${leftPanel === "templates" ? "active" : ""}`}
              onClick={() => setLeftPanel("templates")}
            >
              风格模板
            </button>
            <button
              className={`workbench-panel-tab ${leftPanel === "custom" ? "active" : ""}`}
              onClick={() => setLeftPanel("custom")}
            >
              自定义
            </button>
          </div>

          {leftPanel === "templates" ? (
            <div className="workbench-template-grid">
              {templates.map((template) =>
                renderTemplateCard(template, template.id === selectedTemplateId, () => {
                  void handleTemplateSwitch(template.id);
                })
              )}
            </div>
          ) : (
            <div className="workbench-custom">
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">字号</div>
                <div className="workbench-chip-row">
                  {["15px", "16px", "18px"].map((size) => (
                    <button
                      key={size}
                      className={`workbench-chip ${fontSize === size ? "active" : ""}`}
                      onClick={() => {
                        setFontSize(size);
                        void triggerRender(contentInput, titleInput, authorInput, { fontSize: size });
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="workbench-custom-section">
                <div className="workbench-custom-label">首行缩进</div>
                <div className="workbench-chip-row">
                  <button
                    className={`workbench-chip ${paragraphIndent ? "active" : ""}`}
                    onClick={() => {
                      setParagraphIndent(true);
                      void triggerRender(contentInput, titleInput, authorInput, { paragraphIndent: true });
                    }}
                  >
                    开启
                  </button>
                  <button
                    className={`workbench-chip ${!paragraphIndent ? "active" : ""}`}
                    onClick={() => {
                      setParagraphIndent(false);
                      void triggerRender(contentInput, titleInput, authorInput, { paragraphIndent: false });
                    }}
                  >
                    关闭
                  </button>
                </div>
              </div>

              <div className="workbench-custom-section">
                <div className="workbench-custom-label">段落间距</div>
                <div className="workbench-chip-row">
                  {(["compact", "normal", "relaxed"] as const).map((value) => (
                    <button
                      key={value}
                      className={`workbench-chip ${spacing === value ? "active" : ""}`}
                      onClick={() => {
                        setSpacing(value);
                        void triggerRender(contentInput, titleInput, authorInput, { spacing: value });
                      }}
                    >
                      {value === "compact" ? "紧凑" : value === "normal" ? "适中" : "呼吸"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="workbench-custom-section">
                <div className="workbench-custom-label">章节分隔符</div>
                <div className="workbench-chip-row">
                  {["line", "none", "dashed", "double", "ornament"].map((value) => (
                    <button
                      key={value}
                      className={`workbench-chip ${sectionDivider === value ? "active" : ""}`}
                      onClick={() => {
                        setSectionDivider(value);
                        void triggerRender(contentInput, titleInput, authorInput, { sectionDivider: value });
                      }}
                    >
                      {value === "line" ? "直线" : value === "none" ? "无" : value === "dashed" ? "虚线" : value === "double" ? "双线" : "花纹"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="workbench-custom-section">
                <div className="workbench-custom-label">结尾标识符</div>
                <div className="workbench-chip-row">
                  {["none", "end", "dot", "diamond", "dash"].map((value) => (
                    <button
                      key={value}
                      className={`workbench-chip ${endMarker === value ? "active" : ""}`}
                      onClick={() => {
                        setEndMarker(value);
                        void triggerRender(contentInput, titleInput, authorInput, { endMarker: value });
                      }}
                    >
                      {value === "none" ? "无" : value === "end" ? "End" : value === "dot" ? "●" : value === "diamond" ? "◆" : "—"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="workbench-center workbench-center-refined">
          <div className="workbench-meta-row">
            <input
              type="text"
              className="workbench-meta-input"
              placeholder="标题"
              value={titleInput}
              onChange={(event) => {
                setTitleInput(event.target.value);
                syncMetadata(event.target.value, authorInput);
              }}
            />
            <input
              type="text"
              className="workbench-meta-input"
              placeholder="作者"
              value={authorInput}
              onChange={(event) => {
                setAuthorInput(event.target.value);
                syncMetadata(titleInput, event.target.value);
              }}
            />
            <button className="workbench-save-btn" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>

          <div
            className="workbench-editor-surface"
            style={{ background: selectedTemplateStyle.surface }}
          >
            <div className="workbench-editor-meta">
              <div className="workbench-editor-title">{titleInput || "未命名文章"}</div>
              <div className="workbench-editor-author">
                <span className="workbench-editor-badge">原创</span>
                <span>{authorInput || "未填写作者"}</span>
              </div>
            </div>
            <div
              ref={editorRef}
              className="workbench-rich-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => {
                const nextHtml = event.currentTarget.innerHTML;
                syncContent(nextHtml);
              }}
            />
          </div>

          <div className="workbench-statusbar">
            {message && <span style={{ color: "var(--green)", fontSize: "13px" }}>{message}</span>}
            {error && <span style={{ color: "var(--red)", fontSize: "13px" }}>{error}</span>}
            {!message && !error && <span />}
            <div className="workbench-word-count">
              {isRendering ? "渲染中..." : `${wordCount} 字 · ${readTime} 分钟阅读`}
            </div>
          </div>
        </main>

        <aside className="workbench-right">
          <div className="workbench-preview-topbar">
            <div className="workbench-preview-tabs">
              <button
                className={`workbench-preview-tab ${previewMode === "article" ? "active" : ""}`}
                onClick={() => setPreviewMode("article")}
              >
                正文
              </button>
              <button
                className={`workbench-preview-tab ${previewMode === "feed" ? "active" : ""}`}
                onClick={() => setPreviewMode("feed")}
              >
                公众号目录
              </button>
              <button
                className={`workbench-preview-tab ${previewMode === "html" ? "active" : ""}`}
                onClick={() => setPreviewMode("html")}
              >
                HTML
              </button>
            </div>
          </div>

          {article?.renderedHtml && previewMode === "article" ? (
            <div className="workbench-phone-frame">
              <div className="device-frame workbench-device-frame compact-device">
                <div className="device-hardware">
                  <span className="device-island" />
                  <span className="device-camera" />
                </div>
                <div className="device-screen">
                  <div className="wechat-statusbar">
                    <span>5:10</span>
                    <span>VPN 5G 60</span>
                  </div>
                  <div className="wechat-nav-bar">
                    <span className="wechat-nav-back">‹</span>
                    <span className="wechat-nav-more">•••</span>
                  </div>
                  <div className="workbench-phone-content wechat-article-scroll">
                    <div dangerouslySetInnerHTML={{ __html: article.renderedHtml }} />
                  </div>
                  <div className="wechat-bottom-actions">
                    <span>Jinkin遐想</span>
                    <span>♡ 0</span>
                    <span>↗ 0</span>
                    <span>□ 0</span>
                  </div>
                </div>
                <div className="device-side device-side-left" />
                <div className="device-side device-side-right" />
              </div>
            </div>
          ) : article?.renderedHtml && previewMode === "feed" ? (
            <div className="workbench-phone-frame">
              <div className="device-frame workbench-device-frame compact-device">
                <div className="device-hardware">
                  <span className="device-island" />
                  <span className="device-camera" />
                </div>
                <div className="device-screen">
                  <div className="wechat-statusbar">
                    <span>4月2日</span>
                    <span>目录</span>
                  </div>
                  <div className="workbench-feed-content">
                    <article className="workbench-feed-card">
                      <div className="workbench-feed-cover">
                        {coverPreviewUrl ? (
                          <img src={coverPreviewUrl} alt={titleInput || "封面"} />
                        ) : (
                          <div className="workbench-feed-cover-empty">封面待上传</div>
                        )}
                      </div>
                      <div className="workbench-feed-card-body">
                        <h3>{titleInput || "未命名文章"}</h3>
                        <p>{digestPreview}</p>
                        <span>{authorInput || "Jinkin遐想"} · 阅读 {Math.max(wordCount, 11)}</span>
                      </div>
                    </article>
                  </div>
                </div>
                <div className="device-side device-side-left" />
                <div className="device-side device-side-right" />
              </div>
            </div>
          ) : article?.renderedHtml && previewMode === "html" ? (
            <pre className="workbench-html-source">{article.renderedHtml}</pre>
          ) : (
            <div className="workbench-preview-empty">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <p>上传文章后会在这里实时显示排版结果</p>
            </div>
          )}
        </aside>
      </div>

      {publishModalVisible && (
        <div className="publish-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClosePublishModal(); }}>
          <div className="publish-modal">
            <div className="publish-modal-header">
              <h2>发布到公众号</h2>
              <button className="publish-modal-close" onClick={handleClosePublishModal}>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
            </div>

            <div className="publish-modal-body">
              {publishAccounts.length === 0 ? (
                <div className="publish-no-account">
                  <p>暂无可用的发布账号</p>
                  <span>请在设置页面添加公众号发布账号</span>
                </div>
              ) : (
                <>
                  <div className="publish-account-select">
                    <label>选择账号</label>
                    <select
                      value={selectedAccount?.id ?? ""}
                      onChange={async (e) => {
                        const acc = publishAccounts.find((a) => a.id === e.target.value);
                        setSelectedAccount(acc ?? null);
                        setQrCheckError("");
                        if (acc?.status === "ready" && acc.hasStoredSession) {
                          setQrLoginStatus("loading");
                          try {
                            const { probe } = await refreshPublishAccount(acc.id);
                            if (probe.loginState === "authenticated") {
                              setQrLoginStatus("authenticated");
                            } else {
                              setQrLoginStatus("idle");
                              setQrCheckError("登录已过期，请重新扫码登录");
                            }
                          } catch {
                            setQrLoginStatus("idle");
                            setQrCheckError("登录状态验证失败，请重新扫码");
                          }
                        } else {
                          setQrLoginStatus("idle");
                        }
                      }}
                    >
                      {publishAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.status === "ready" ? "已登录" : acc.status === "expired" ? "已过期" : "未登录"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedAccount && qrLoginStatus !== "authenticated" && (
                    <div className="publish-qr-section">
                      {qrLoginStatus === "idle" && (
                        <button className="publish-action-btn" onClick={() => void handleStartQrLogin()}>
                          获取登录二维码
                        </button>
                      )}
                      {qrLoginStatus === "loading" && (
                        <div className="publish-qr-loading">正在获取二维码...</div>
                      )}
                      {qrLoginStatus === "pending" && qrLoginSession && (
                        <div className="publish-qr-display">
                          <img
                            src={`/data/${qrLoginSession.storageKey.split("/").map((s) => encodeURIComponent(s)).join("/")}`}
                            alt="登录二维码"
                            className="publish-qr-image"
                          />
                          <p className="publish-qr-hint">请使用微信扫码登录</p>
                          <button
                            className="publish-action-btn-secondary"
                            onClick={() => void handleStartQrLogin()}
                          >
                            刷新二维码
                          </button>
                        </div>
                      )}
                      {qrLoginStatus === "expired" && (
                        <div className="publish-qr-expired">
                          <p>二维码已过期</p>
                          <button className="publish-action-btn" onClick={() => void handleStartQrLogin()}>
                            重新获取二维码
                          </button>
                        </div>
                      )}
                      {qrCheckError && <div className="publish-error">{qrCheckError}</div>}
                    </div>
                  )}

                  {selectedAccount && qrLoginStatus === "authenticated" && (
                    <div className="publish-ready">
                      <div className="publish-ready-status">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                        <span>账号已登录，可以发布文章</span>
                      </div>
                      {publishTask && (
                        <div className="publish-task-status">
                          <p>发布状态：{publishTask.status === "running" ? "发布中..." : publishTask.status}</p>
                          {publishTask.steps.map((step) => (
                            <div key={step.key} className={`publish-step ${step.status}`}>
                              <span>{step.label}</span>
                              <span>{step.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {publishError && <div className="publish-error">{publishError}</div>}
                      <button
                        className="publish-action-btn-primary"
                        onClick={() => void handlePublish()}
                        disabled={isPublishing}
                      >
                        {isPublishing ? "发布中..." : "发布到草稿箱"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
