import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  FALLBACK_TEMPLATES,
  buildStoredAssetUrl,
  getArticle,
  getArticles,
  getPublishTasks,
  getTemplates,
  renderArticle,
  updateArticleMetadata,
  uploadArticleAsset
} from "../lib/api";
import { buildArticleReadiness } from "../lib/article-readiness";
import { readWorkbenchState, writeWorkbenchState } from "../lib/workbench";
import type { ArticleDetail, ArticleSummary, PublishTask, TemplateSummary } from "../types";

const statusLabel: Record<ArticleSummary["status"], string> = {
  draft: "待排版",
  rendered: "已渲染",
  uploading: "上传中",
  done: "已完成",
  error: "异常"
};

export function PreviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workbenchState = useMemo(() => readWorkbenchState(), []);
  const articleId = searchParams.get("articleId");

  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>(FALLBACK_TEMPLATES);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState(
    articleId ?? workbenchState.selectedArticleId
  );
  const [templateId, setTemplateId] = useState(workbenchState.selectedTemplateId || "default-light");
  const [titleInput, setTitleInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [digestInput, setDigestInput] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingSlotId, setUploadingSlotId] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeTemplate = templates.find((t) => t.id === templateId) ?? FALLBACK_TEMPLATES[0];
  const readiness = useMemo(() => buildArticleReadiness(article, tasks), [article, tasks]);
  const configuredBodyCount =
    article?.mediaAssets.bodyImages.filter((item) => item.storageKey || item.localPath).length ?? 0;
  const coverPreviewUrl = buildStoredAssetUrl(article?.mediaAssets.coverStorageKey ?? null);

  useEffect(() => {
    setSelectedArticleId(articleId ?? workbenchState.selectedArticleId);
  }, [articleId, workbenchState.selectedArticleId]);

  useEffect(() => {
    writeWorkbenchState({
      selectedArticleId,
      selectedTemplateId: templateId
    });
  }, [selectedArticleId, templateId]);

  useEffect(() => {
    async function loadListData() {
      setIsLoadingList(true);
      try {
        const [nextArticles, nextTemplates] = await Promise.all([getArticles(), getTemplates()]);
        setArticles(nextArticles);
        setTemplates(nextTemplates);
        if (!selectedArticleId && nextArticles.length > 0) {
          setSelectedArticleId(nextArticles[0].id);
        }
      } catch {
        setTemplates(FALLBACK_TEMPLATES);
      } finally {
        setIsLoadingList(false);
      }
    }
    void loadListData();
  }, []);

  useEffect(() => {
    if (!selectedArticleId) {
      setArticle(null);
      return;
    }
    navigate(`/preview?articleId=${selectedArticleId}`, { replace: true });

    async function load() {
      try {
        const [payload, nextTasks] = await Promise.all([
          getArticle(selectedArticleId),
          getPublishTasks(selectedArticleId)
        ]);
        setArticle(payload);
        setTasks(nextTasks);
        setTemplateId(payload.templateId ?? (workbenchState.selectedTemplateId || "default-light"));
        setTitleInput(payload.title);
        setAuthorInput(payload.metadata.author);
        setDigestInput(payload.metadata.digest);
      } catch {
        setError("加载文章失败");
      }
    }
    void load();
  }, [selectedArticleId, workbenchState.selectedTemplateId]);

  async function handleRender() {
    if (!selectedArticleId) return;
    setIsRendering(true);
    setMessage("");
    try {
      const payload = await renderArticle(selectedArticleId, templateId);
      setArticle(payload);
      setMessage("预览已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "渲染失败");
    } finally {
      setIsRendering(false);
    }
  }

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
      setMessage("已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUploadCover(file: File | null) {
    if (!file || !selectedArticleId) return;
    setUploadingCover(true);
    try {
      const payload = await uploadArticleAsset({ articleId: selectedArticleId, kind: "cover", file });
      const next = payload.templateId
        ? await renderArticle(selectedArticleId, payload.templateId)
        : payload;
      setArticle(next);
      setMessage("封面上传成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingCover(false);
      coverInputRef.current && (coverInputRef.current.value = "");
    }
  }

  async function handleUploadBodyImage(slotId: string, file: File | null) {
    if (!file || !selectedArticleId) return;
    setUploadingSlotId(slotId);
    try {
      const payload = await uploadArticleAsset({
        articleId: selectedArticleId,
        kind: "body",
        slotId,
        file
      });
      const next = payload.templateId
        ? await renderArticle(selectedArticleId, payload.templateId)
        : payload;
      setArticle(next);
      setMessage("图片上传成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingSlotId("");
      const input = bodyInputRefs.current[slotId];
      if (input) input.value = "";
    }
  }

  return (
    <div className="grid-sidebar">
      {/* Left: Config Panel */}
      <div className="stack">
        {/* Article Selector */}
        <div className="card">
          <p className="section-title">选择文章</p>
          <div className="stack compact">
            {articles.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className={`article-card ${item.id === selectedArticleId ? "active" : ""}`}
                onClick={() => setSelectedArticleId(item.id)}
              >
                <span className="article-card-title">{item.title}</span>
                <div className="article-card-meta">
                  <span className="badge badge-gray" style={{ marginRight: "6px" }}>
                    {statusLabel[item.status]}
                  </span>
                  {item.metadata.wordCount} 字
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata */}
        {article && (
          <div className="card">
            <p className="section-title">文章信息</p>
            <div className="stack">
              <div className="field">
                <label className="field-label">标题</label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">作者</label>
                <input
                  type="text"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">摘要</label>
                <textarea
                  value={digestInput}
                  onChange={(e) => setDigestInput(e.target.value)}
                  rows={3}
                />
              </div>
              <button className="btn btn-secondary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        )}

        {/* Template Picker */}
        {article && (
          <div className="card">
            <p className="section-title">选择模板</p>
            <div className="stack compact">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`template-card ${tpl.id === templateId ? "active" : ""}`}
                  onClick={() => setTemplateId(tpl.id)}
                >
                  <span className="template-card-name">{tpl.name}</span>
                  <span className="template-card-desc">{tpl.description}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: "14px", width: "100%" }}
              onClick={handleRender}
              disabled={isRendering}
            >
              {isRendering ? "生成中..." : "生成预览"}
            </button>
          </div>
        )}

        {/* Media Assets */}
        {article && (
          <div className="card">
            <p className="section-title">素材</p>
            <div className="stack">
              {/* Cover */}
              <div className="image-card">
                <div className="image-card-label">封面图片</div>
                <div className="image-card-preview">
                  {coverPreviewUrl ? (
                    <img src={coverPreviewUrl} alt="封面" />
                  ) : (
                    <span className="image-card-empty">未上传</span>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => void handleUploadCover(e.target.files?.[0] ?? null)}
                />
                <span
                  className="image-card-action"
                  onClick={() => coverInputRef.current?.click()}
                >
                  {uploadingCover ? "上传中..." : "上传封面"}
                </span>
              </div>

              <div className="divider" />

              {/* Body Images */}
              <div className="image-card-label">正文图片 ({configuredBodyCount}/{article.mediaAssets.bodyImages.length})</div>
              {article.mediaAssets.bodyImages.map((slot) => {
                const previewUrl = buildStoredAssetUrl(slot.storageKey);
                return (
                  <div key={slot.id} className="image-card">
                    <div className="image-card-preview" style={{ aspectRatio: "4/3" }}>
                      {previewUrl ? (
                        <img src={previewUrl} alt={slot.label} />
                      ) : (
                        <span className="image-card-empty">未上传</span>
                      )}
                    </div>
                    <input
                      ref={(node) => { bodyInputRefs.current[slot.id] = node; }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) =>
                        void handleUploadBodyImage(slot.id, e.target.files?.[0] ?? null)
                      }
                    />
                    <div className="flex items-center justify-between">
                      <span className="image-card-label">{slot.label}</span>
                      <span
                        className="image-card-action"
                        onClick={() => bodyInputRefs.current[slot.id]?.click()}
                      >
                        {uploadingSlotId === slot.id ? "上传中..." : "上传"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {message && <p style={{ color: "var(--success)", fontSize: "13px" }}>{message}</p>}
        {error && <p style={{ color: "var(--error)", fontSize: "13px" }}>{error}</p>}

        {/* Footer */}
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/publish?articleId=${selectedArticleId}`)}
          >
            去发布 →
          </button>
        </div>
      </div>

      {/* Right: Preview Panel */}
      <div className="card">
        <div className="toolbar-row">
          <h2>{article?.title ?? "预览"}</h2>
          <div className="tabs">
            <button
              className={`tab ${!showHtml ? "active" : ""}`}
              onClick={() => setShowHtml(false)}
            >
              排版预览
            </button>
            <button
              className={`tab ${showHtml ? "active" : ""}`}
              onClick={() => setShowHtml(true)}
            >
              HTML
            </button>
          </div>
        </div>

        {article?.renderedHtml && !showHtml ? (
          <div
            className="phone-frame"
            style={{ marginTop: "16px" }}
          >
            <div className="phone-screen">
              <div className="phone-content">
                <div dangerouslySetInnerHTML={{ __html: article.renderedHtml }} />
              </div>
            </div>
          </div>
        ) : article?.renderedHtml && showHtml ? (
          <pre className="html-source" style={{ marginTop: "16px", maxHeight: "600px" }}>
            {article.renderedHtml}
          </pre>
        ) : (
          <div className="empty-state" style={{ marginTop: "40px" }}>
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="empty-state-title">暂无预览</div>
            <div className="empty-state-desc">
              选择文章、配置模板后点击"生成预览"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
