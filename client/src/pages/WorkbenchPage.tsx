import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  applySmartTypesetting,
  buildArticleAssetUrl,
  cancelWechatQrLogin,
  checkWechatQrLogin,
  createPublishTask,
  generateCoverImage,
  generateDigest,
  getArticle,
  getArticles,
  getPublishAccounts,
  getTemplates,
  refreshPublishAccount,
  renderArticle,
  runPublishTask,
  startWechatQrLogin,
  updateArticleContent,
  updateArticleMetadata,
  uploadArticleAsset
} from "../lib/api";
import { CoverCropper } from "../components/CoverCropper";
import { BodyImageEditor } from "../components/BodyImageEditor";
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
  const [digestInput, setDigestInput] = useState("");
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
  const [isContentSaving, setIsContentSaving] = useState(false);
  const [isTypesetting, setIsTypesetting] = useState(false);
  const [coverCropperVisible, setCoverCropperVisible] = useState(false);
  const [coverCropperSrc, setCoverCropperSrc] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

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
  const [publishSuccessInfo, setPublishSuccessInfo] = useState<{
    visible: boolean;
    articleTitle: string;
    accountName: string;
    draftUrl: string | null;
  }>({ visible: false, articleTitle: "", accountName: "", draftUrl: null });

  const editorRef = useRef<HTMLDivElement | null>(null);
  const contentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 本地可编辑 HTML — BodyImageEditor 修复的核心。
   *
   * 之前设计:editor 每次 article.renderedHtml 变 → useEffect 把 DOM innerHTML 重置,
   * BodyImageEditor paste 后调 POST /assets 触发 updatedAt 变 → DOM 被覆盖 → 用户看到 figure 没出现。
   *
   * 现在设计:
   *   - editableHtml 是单一真相(source of truth),user 改 → state 变 → DOM 同步
   *   - article 是 server 的镜像(只在保存时刷新)
   *   - article 切换(load)时,editableHtml 从 article.renderedHtml 重新初始化
   *   - BodyImageEditor paste → POST /assets → 拿新 article.renderedHtml → 转 editableHtml
   *     → setEditableHtml → React 重渲染 → DOM 同步 (无需手动调 renderArticle)
   */
  const [editableHtml, setEditableHtml] = useState<string>("");
  const [isContentDirty, setIsContentDirty] = useState<boolean>(false);

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
            author: nextAuthor ?? payload.metadata.author,
            digest: article?.metadata.digest ?? payload.metadata.digest ?? ""
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
      setEditableHtml("");
      setIsContentDirty(false);
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
        setDigestInput(hydratedPayload.metadata.digest);
        setContentInput(hydratedPayload.rawMarkdown);
        setEditableHtml(extractEditableHtml(hydratedPayload.renderedHtml));
        setIsContentDirty(false);
      } catch {
        setError("加载文章失败");
      }
    }

    void load();
  }, [selectedArticleId]);

  /**
   * 同步 editor DOM ← editableHtml state (单一真相)。
   *
   * 检查 DOM 是否已是目标 HTML,只在我们确实不同步时才设 innerHTML。
   * 为什么需要这个 guard:onInput 触发时,editableHtml 刚从 DOM 读取并 setState,
   * useEffect 跑时 DOM 已经是这个 HTML,再设一遍会丢光标位置。
   */
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    if (root.innerHTML === editableHtml) return;
    root.innerHTML = editableHtml;
    // 设完 innerHTML 后浏览器会重置 selection,需要 restore
  }, [editableHtml]);

  /**
   * 编辑正文 → 只改本地 editableHtml + dirty 标记。
   * 之前 syncContent 会自动 debounce 500ms 后 PATCH /content + render,
   * 现在改成纯本地,只在用户按"保存正文"按钮时才同步到 server。
   */
  const handleEditorInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    setEditableHtml(event.currentTarget.innerHTML);
    setIsContentDirty(true);
  }, []);

  /**
   * BodyImageEditor 调用的 mutation 回调(粘贴/工具栏)。
   * 同样只改本地 state,React rerender 同步 DOM,光标位置由浏览器自动保留。
   */
  const handleEditorMutate = useCallback((nextHtml: string) => {
    setEditableHtml(nextHtml);
    setIsContentDirty(true);
  }, []);

  /**
   * BodyImageEditor 上传图片后,server 返回的 ArticleDetail 已包含新 renderedHtml,
   * 用它替换 editableHtml 并刷新 article(预览/元数据用)。
   */
  const handleArticleUploaded = useCallback((next: ArticleDetail) => {
    setArticle(next);
    setEditableHtml(extractEditableHtml(next.renderedHtml));
    setIsContentDirty(true);
  }, []);

  /**
   * "保存正文"按钮 → serializeEditableHtmlToMarkdown → PATCH /content → POST /render。
   * 渲染完成后 editableHtml 从新 article.renderedHtml 重新初始化 + 清 dirty。
   */
  const handleSaveContent = useCallback(async () => {
    if (!selectedArticleId || !article) return;
    setIsContentSaving(true);
    setMessage("");
    setError("");
    try {
      const nextMarkdown = serializeEditableHtmlToMarkdown(editableHtml, article);
      setContentInput(nextMarkdown);
      const updated = await updateArticleContent(selectedArticleId, nextMarkdown);
      // PATCH /content 不重渲染,自己触发 render
      const settings = readAppSettings();
      const reRendered = await renderArticle(selectedArticleId, article.templateId ?? "claude", {
        fontSize,
        lineHeight: { compact: "1.5", normal: "1.8", relaxed: "2.0" }[spacing],
        paragraphIndent,
        sectionDivider,
        endMarker,
        platformName: settings.platformName,
        originalChecked: settings.originalChecked
      });
      // updated 也带新 rawMarkdown;reRendered 带新 renderedHtml
      setArticle({ ...updated, ...reRendered, rawMarkdown: nextMarkdown });
      setEditableHtml(extractEditableHtml(reRendered.renderedHtml));
      setIsContentDirty(false);
      setMessage("正文已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存正文失败");
    } finally {
      setIsContentSaving(false);
    }
  }, [editableHtml, article, selectedArticleId, fontSize, spacing, paragraphIndent, sectionDivider, endMarker]);

  const syncMetadata = useCallback(
    (nextTitle: string, nextAuthor: string, nextDigest: string) => {
      if (metaTimeoutRef.current) clearTimeout(metaTimeoutRef.current);
      metaTimeoutRef.current = setTimeout(async () => {
        if (!selectedArticleId) return;
        try {
          const payload = await updateArticleMetadata(selectedArticleId, {
            title: nextTitle,
            author: nextAuthor,
            digest: nextDigest
          });
          setArticle(payload);
          await triggerRender(contentInput, nextTitle, nextAuthor);
        } catch {
          setError("元数据同步失败");
        }
      }, 400);
    },
    [contentInput, selectedArticleId, triggerRender]
  );

  async function handleSave() {
    if (!selectedArticleId) return;
    setIsSaving(true);
    setMessage("");
    try {
      const payload = await updateArticleMetadata(selectedArticleId, {
        title: titleInput,
        author: authorInput,
        digest: digestInput
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
    if (!settings.textApiKey.trim()) {
      setError("请先在设置页填写智能排版 AI 的 API Key");
      return;
    }

    setIsTypesetting(true);
    setMessage("");
    setError("");
    try {
      const payload = await applySmartTypesetting({
        articleId: selectedArticleId,
        apiUrl: settings.textApiUrl,
        apiKey: settings.textApiKey,
        model: settings.textModel
      });
      setArticle(payload);
      setTitleInput(payload.title);
      setAuthorInput(payload.metadata.author);
      setDigestInput(payload.metadata.digest);
      setContentInput(payload.rawMarkdown);
      setMessage("智能排版已完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "智能排版失败");
    } finally {
      setIsTypesetting(false);
    }
  }

  function handleCoverFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCoverCropperSrc(reader.result as string);
      setCoverCropperVisible(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function handleCoverCropped(blob: Blob) {
    if (!selectedArticleId) return;
    setCoverCropperVisible(false);
    setCoverCropperSrc(null);
    setIsUploadingCover(true);
    try {
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      const payload = await uploadArticleAsset({ articleId: selectedArticleId, kind: "cover", file });
      setArticle(payload);
      setMessage("封面上传成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "封面上传失败");
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleAiGenerateCover() {
    if (!selectedArticleId) return;
    const settings = readAppSettings();
    if (!settings.textApiKey.trim()) {
      setError("请先在设置页填写智能排版 AI 的 API Key");
      return;
    }
    if (!settings.imageApiKey.trim()) {
      setError("请先在设置页填写图像生成 AI 的 API Key");
      return;
    }
    setIsUploadingCover(true);
    setMessage("");
    setError("");
    try {
      const payload = await generateCoverImage({
        articleId: selectedArticleId,
        textApiUrl: settings.textApiUrl,
        textApiKey: settings.textApiKey,
        textModel: settings.textModel,
        imageApiUrl: settings.imageApiUrl,
        imageApiKey: settings.imageApiKey,
        imageModel: settings.imageModel
      });
      setArticle(payload);
      setMessage("AI 封面生成成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 封面生成失败");
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleAiGenerateDigest() {
    if (!selectedArticleId) return;
    const settings = readAppSettings();
    if (!settings.textApiKey.trim()) {
      setError("请先在设置页填写智能排版 AI 的 API Key");
      return;
    }
    setIsTypesetting(true);
    setMessage("");
    setError("");
    try {
      const payload = await generateDigest({
        articleId: selectedArticleId,
        apiUrl: settings.textApiUrl,
        apiKey: settings.textApiKey,
        model: settings.textModel
      });
      setArticle(payload);
      setDigestInput(payload.metadata.digest);
      setMessage("AI 摘要生成成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 摘要生成失败");
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
        setPublishSuccessInfo({
          visible: true,
          articleTitle: titleInput,
          accountName: selectedAccount.name,
          draftUrl: result.result?.reopenUrl ?? null
        });
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
                syncMetadata(event.target.value, authorInput, digestInput);
              }}
            />
            <input
              type="text"
              className="workbench-meta-input"
              placeholder="作者"
              value={authorInput}
              onChange={(event) => {
                setAuthorInput(event.target.value);
                syncMetadata(titleInput, event.target.value, digestInput);
              }}
            />
            <button className="workbench-save-btn" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>

          <div className="workbench-digest-row">
            <textarea
              className="workbench-digest-textarea"
              placeholder="摘要（最多120字，留空将自动提取正文前120字）"
              value={digestInput}
              maxLength={120}
              rows={2}
              onChange={(event) => {
                const val = event.target.value.slice(0, 120);
                setDigestInput(val);
                syncMetadata(titleInput, authorInput, val);
              }}
            />
            <div className="workbench-digest-actions">
              <button
                className="workbench-digest-ai-btn"
                onClick={() => void handleAiGenerateDigest()}
                disabled={isTypesetting}
                title="AI 根据正文生成摘要"
              >
                {isTypesetting ? "生成中..." : "AI 生成"}
              </button>
              <span className="workbench-digest-count">{digestInput.length}/120</span>
            </div>
          </div>

          <div className="workbench-cover-row">
            <div className="workbench-cover-preview">
              {coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="封面预览" className="workbench-cover-img" />
              ) : (
                <div className="workbench-cover-empty">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span>封面待上传</span>
                </div>
              )}
            </div>
            <div className="workbench-cover-actions">
              <label className="workbench-cover-btn">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleCoverFileSelect}
                />
                {isUploadingCover ? "处理中..." : "上传封面"}
              </label>
              <button
                className="workbench-cover-btn-secondary"
                onClick={() => void handleAiGenerateCover()}
                disabled={isUploadingCover}
              >
                AI 生成封面
              </button>
            </div>
          </div>

          {coverCropperVisible && coverCropperSrc && (
            <CoverCropper
              imageSrc={coverCropperSrc}
              onCrop={handleCoverCropped}
              onCancel={() => {
                setCoverCropperVisible(false);
                setCoverCropperSrc(null);
              }}
              defaultAspect={2.35}
            />
          )}

          <div
            className="workbench-editor-surface"
            style={{ background: selectedTemplateStyle.surface }}
          >
            <div className="workbench-editor-meta">
              <div className="workbench-editor-title">{titleInput || "未命名文章"}</div>
              <div className="workbench-editor-author">
                {article?.metadata.originalChecked && (
                  <span className="workbench-editor-badge">原创</span>
                )}
                <span>{authorInput || "未填写作者"}</span>
              </div>
            </div>
            <div
              ref={editorRef}
              className="workbench-rich-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
            />
          </div>

          <div className="workbench-statusbar">
            {message && <span style={{ color: "var(--green)", fontSize: "13px" }}>{message}</span>}
            {error && <span style={{ color: "var(--red)", fontSize: "13px" }}>{error}</span>}
            {!message && !error && (
              <span style={{ color: isContentDirty ? "#c96442" : "var(--text-muted)", fontSize: "13px" }}>
                {isContentDirty ? "● 正文有未保存修改" : ""}
              </span>
            )}
            <button
              className="workbench-save-content-btn"
              onClick={() => void handleSaveContent()}
              disabled={isContentSaving || !isContentDirty}
              title={isContentDirty ? "把本地编辑同步到 server 并重新渲染" : "正文已是最新"}
              style={{
                marginRight: 12,
                padding: "4px 14px",
                borderRadius: 6,
                border: 0,
                background: isContentDirty ? "#c96442" : "rgba(0,0,0,0.1)",
                color: isContentDirty ? "white" : "var(--text-muted)",
                cursor: isContentDirty ? "pointer" : "default",
                fontSize: 13,
                fontWeight: 500
              }}
            >
              {isContentSaving ? "保存中..." : "保存正文"}
            </button>
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
                        <span>
                          {article?.metadata.originalChecked && (
                            <span className="workbench-editor-badge" style={{ marginRight: 4, fontSize: 10, padding: '1px 4px' }}>原创</span>
                          )}
                          {authorInput || "Jinkin遐想"} · 阅读 {Math.max(wordCount, 11)}
                        </span>
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

      {publishModalVisible && !publishSuccessInfo.visible && (
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

      {publishSuccessInfo.visible && (
        <div className="publish-modal-overlay">
          <div className="publish-success-modal">
            <div className="publish-success-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h3>草稿保存成功</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "8px 0 0" }}>
              文章 <strong style={{ color: "var(--text-primary)" }}>《{publishSuccessInfo.articleTitle}》</strong> 已保存到
              <strong style={{ color: "var(--text-primary)" }}> {publishSuccessInfo.accountName}</strong> 的草稿箱。
            </p>
            <div className="publish-success-note">
              <p>⚠️ 请打开微信公众平台，在「草稿箱」中手动确认并发布。</p>
            </div>
            {publishSuccessInfo.draftUrl && (
              <a
                href={publishSuccessInfo.draftUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="publish-success-link"
              >
                打开草稿编辑页
              </a>
            )}
            <button
              className="publish-success-btn"
              onClick={() => {
                setPublishSuccessInfo({ visible: false, articleTitle: "", accountName: "", draftUrl: null });
                setPublishModalVisible(false);
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 正文图片编辑器:粘贴/拖拽上传 + figure 工具栏(替换/上移/下移/删除) */}
      {article && (
        <BodyImageEditor
          editorRef={editorRef}
          article={article}
          editableHtml={editableHtml}
          onEditorMutate={handleEditorMutate}
          onArticleUploaded={handleArticleUploaded}
          onMessage={setMessage}
          onError={setError}
        />
      )}
    </div>
  );
}
