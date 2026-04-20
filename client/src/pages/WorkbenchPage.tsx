import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  getArticle,
  getArticles,
  getTemplates,
  renderArticle,
  updateArticleMetadata
} from "../lib/api";
import { readWorkbenchState, writeWorkbenchState } from "../lib/workbench";
import type { ArticleDetail, ArticleSummary, TemplateSummary } from "../types";

export function WorkbenchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workbenchState = useMemo(() => readWorkbenchState(), []);
  const articleId = searchParams.get("articleId");

  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState(
    articleId ?? workbenchState.selectedArticleId
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    workbenchState.selectedTemplateId || "default-light"
  );
  const [titleInput, setTitleInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [leftPanel, setLeftPanel] = useState<"templates" | "custom">("templates");
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  // Custom options state
  const [fontSize, setFontSize] = useState("16px");
  const [paragraphIndent, setParagraphIndent] = useState(false);
  const [spacing, setSpacing] = useState<"compact" | "normal" | "relaxed">("normal");
  const [sectionDivider, setSectionDivider] = useState("line");
  const [endMarker, setEndMarker] = useState("none");
  const [textCard, setTextCard] = useState("none");

  useEffect(() => {
    writeWorkbenchState({ selectedArticleId, selectedTemplateId });
  }, [selectedArticleId, selectedTemplateId]);

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
        // use empty list
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
    navigate(`/workbench?articleId=${selectedArticleId}`, { replace: true });

    async function load() {
      try {
        const payload = await getArticle(selectedArticleId);
        setArticle(payload);
        setSelectedTemplateId(payload.templateId ?? (workbenchState.selectedTemplateId || "default-light"));
        setTitleInput(payload.title);
        setAuthorInput(payload.metadata.author);
        setContentInput(payload.rawMarkdown);
      } catch {
        setError("加载文章失败");
      }
    }
    void load();
  }, [selectedArticleId]);

  async function handleRender() {
    if (!selectedArticleId) return;
    setIsRendering(true);
    setMessage("");
    try {
      const payload = await renderArticle(selectedArticleId, selectedTemplateId);
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
        digest: ""
      });
      setArticle(payload);
      setMessage("已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopyHtml() {
    if (!article?.renderedHtml) return;
    void navigator.clipboard.writeText(article.renderedHtml).then(() => {
      setMessage("已复制到剪贴板");
    });
  }

  async function handleTemplateSwitch(templateId: string) {
    setSelectedTemplateId(templateId);
    setExpandedTemplate(null);
    if (!selectedArticleId) return;
    setIsRendering(true);
    setMessage("");
    try {
      const payload = await renderArticle(selectedArticleId, templateId);
      setArticle(payload);
      setMessage("模板已切换");
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setIsRendering(false);
    }
  }

  const wordCount = contentInput.replace(/\s/g, "").length;
  const readTime = Math.max(1, Math.ceil(wordCount / 300));

  // Compute inline styles from custom options for real-time preview
  const lineHeightMap = { compact: "1.5", normal: "1.8", relaxed: "2.0" };
  const previewStyle: React.CSSProperties = {
    fontSize,
    lineHeight: lineHeightMap[spacing],
    textIndent: paragraphIndent ? "2em" : "0",
  };

  return (
    <div className="workbench">
      {/* Top Menu Bar */}
      <header className="workbench-topbar">
        <div className="workbench-topbar-left">
          <button className="workbench-icon-btn" onClick={() => navigate("/")} title="首页">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
          <button className="workbench-icon-btn" onClick={() => navigate("/settings")} title="设置">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
          <button
            className="workbench-icon-btn"
            onClick={() => {
              setSelectedArticleId("");
              setArticle(null);
              navigate("/");
            }}
            title="重新上传"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </div>

        <div className="workbench-topbar-center">
          <button className="workbench-topbar-btn" onClick={() => {
              try {
                const config = JSON.parse(localStorage.getItem("mdpublisher_settings") ?? "{}");
                if (!config.aiEnabled || !config.apiKey) {
                  setMessage("请先在设置页配置 AI 功能");
                  return;
                }
              } catch { /* ignore */ }
              alert("智能排版功能即将上线，请关注更新。");
            }}>
            <svg viewBox="0 0 24 24" width="15" height="15">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            智能排版
          </button>
          <div className="workbench-publish-wrap">
            <button
              className="workbench-topbar-btn-primary"
              onClick={() => setShowPublishMenu(!showPublishMenu)}
            >
              发布到草稿箱
              <svg viewBox="0 0 24 24" width="12" height="12">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
            {showPublishMenu && (
              <div className="workbench-publish-dropdown">
                <div className="workbench-publish-option" onClick={() => { setShowPublishMenu(false); navigate(`/publish?articleId=${selectedArticleId}`); }}>微信公众号</div>
                <div className="workbench-publish-option" onClick={() => { setShowPublishMenu(false); navigate(`/publish?articleId=${selectedArticleId}`); }}>知乎专栏</div>
                <div className="workbench-publish-option" onClick={() => { setShowPublishMenu(false); navigate(`/publish?articleId=${selectedArticleId}`); }}>简书</div>
                <div className="workbench-publish-option" onClick={() => { setShowPublishMenu(false); navigate(`/publish?articleId=${selectedArticleId}`); }}>自定义平台</div>
              </div>
            )}
          </div>
          <button className="workbench-topbar-btn" onClick={handleCopyHtml}>一键复制</button>
        </div>

        <div className="workbench-topbar-right">
          <button className="workbench-icon-btn" title="更多">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>
      </header>

      <div className="workbench-body">
        {/* Left Toolbar */}
        <aside className="workbench-left">
          {/* Panel Switcher */}
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
            <div className="workbench-templates">
              {templates.map((tpl) => (
                <div key={tpl.id}>
                  <div
                    className={`workbench-template-item ${tpl.id === selectedTemplateId ? "active" : ""}`}
                    onClick={() => void handleTemplateSwitch(tpl.id)}
                  >
                    <div
                      className="workbench-template-swatch"
                      style={{ background: tpl.id === "insight-dark" ? "#1c232b" : tpl.id === "minimal-gray" ? "#f5f5f5" : undefined }}
                    />
                    <span className="workbench-template-name">{tpl.name}</span>
                    <button
                      className="workbench-template-expand"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" style={{ color: "var(--text-muted)", transform: expandedTemplate === tpl.id ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </button>
                  </div>
                  {expandedTemplate === tpl.id && (
                    <div className="workbench-template-details">
                      <div className="workbench-template-detail-row">
                        <span className="detail-label">描述</span>
                        <span className="detail-value">{tpl.description}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="workbench-custom">
              {/* Font Size */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">字号</div>
                <div className="workbench-chip-row">
                  {["15px", "16px", "18px"].map((s) => (
                    <button
                      key={s}
                      className={`workbench-chip ${fontSize === s ? "active" : ""}`}
                      onClick={() => setFontSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paragraph Indent */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">首行缩进</div>
                <div className="workbench-chip-row">
                  <button
                    className={`workbench-chip ${paragraphIndent ? "active" : ""}`}
                    onClick={() => setParagraphIndent(!paragraphIndent)}
                  >
                    开启
                  </button>
                  <button
                    className={`workbench-chip ${!paragraphIndent ? "active" : ""}`}
                    onClick={() => setParagraphIndent(false)}
                  >
                    关闭
                  </button>
                </div>
              </div>

              {/* Spacing */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">段落间距</div>
                <div className="workbench-chip-row">
                  {(["compact", "normal", "relaxed"] as const).map((s) => (
                    <button
                      key={s}
                      className={`workbench-chip ${spacing === s ? "active" : ""}`}
                      onClick={() => setSpacing(s)}
                    >
                      {s === "compact" ? "紧凑" : s === "normal" ? "适中" : "呼吸"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Divider */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">章节分隔符</div>
                <div className="workbench-chip-row">
                  {["line", "none", "dashed", "double", "ornament"].map((s) => (
                    <button
                      key={s}
                      className={`workbench-chip ${sectionDivider === s ? "active" : ""}`}
                      onClick={() => setSectionDivider(s)}
                    >
                      {s === "line" ? "直线" : s === "none" ? "无" : s === "dashed" ? "虚线" : s === "double" ? "双线" : "花纹"}
                    </button>
                  ))}
                </div>
              </div>

              {/* End Marker */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">结尾标识符</div>
                <div className="workbench-chip-row">
                  {["none", "end", "dot", "diamond", "dash"].map((s) => (
                    <button
                      key={s}
                      className={`workbench-chip ${endMarker === s ? "active" : ""}`}
                      onClick={() => setEndMarker(s)}
                    >
                      {s === "none" ? "无" : s === "end" ? "End" : s === "dot" ? "●" : s === "diamond" ? "◆" : "—"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Card */}
              <div className="workbench-custom-section">
                <div className="workbench-custom-label">文字卡片</div>
                <div className="workbench-chip-row">
                  {["none", "flat", "elevated", "glass"].map((s) => (
                    <button
                      key={s}
                      className={`workbench-chip ${textCard === s ? "active" : ""}`}
                      onClick={() => setTextCard(s)}
                    >
                      {s === "none" ? "无" : s === "flat" ? "扁平" : s === "elevated" ? "悬浮" : "玻璃"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Center Editor */}
        <main className="workbench-center">
          {/* Article Selector */}
          <div className="workbench-article-bar">
            <select
              className="workbench-article-select"
              value={selectedArticleId}
              onChange={(e) => setSelectedArticleId(e.target.value)}
            >
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <button className="workbench-render-btn" onClick={() => void handleRender()} disabled={isRendering}>
              {isRendering ? "生成中..." : "生成预览"}
            </button>
          </div>

          {/* Metadata Row */}
          <div className="workbench-meta-row">
            <input
              type="text"
              className="workbench-meta-input"
              placeholder="标题"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
            />
            <input
              type="text"
              className="workbench-meta-input"
              placeholder="作者"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
            />
            <button className="workbench-save-btn" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>

          {/* Markdown Editor */}
          <div className="workbench-editor">
            <textarea
              className="workbench-editor-textarea"
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder="在这里编辑 Markdown..."
            />
          </div>

          {/* Status Bar */}
          <div className="workbench-statusbar">
            {message && <span style={{ color: "var(--green)", fontSize: "13px" }}>{message}</span>}
            {error && <span style={{ color: "var(--red)", fontSize: "13px" }}>{error}</span>}
            {!message && !error && <span />}
            <div className="workbench-word-count">
              {wordCount} 字 · {readTime} 分钟阅读
            </div>
          </div>
        </main>

        {/* Right Preview */}
        <aside className="workbench-right">
          {/* Undo/Redo */}
          <div className="workbench-preview-topbar">
            <div className="workbench-preview-tabs">
              <button
                className={`workbench-preview-tab ${!showHtml ? "active" : ""}`}
                onClick={() => setShowHtml(false)}
              >
                排版预览
              </button>
              <button
                className={`workbench-preview-tab ${showHtml ? "active" : ""}`}
                onClick={() => setShowHtml(true)}
              >
                HTML
              </button>
            </div>
          </div>

          {/* Phone Frame */}
          {article?.renderedHtml && !showHtml ? (
            <div className="workbench-phone-frame">
              <div className="workbench-phone-screen">
                <div className="workbench-phone-content" style={previewStyle}>
                  <div dangerouslySetInnerHTML={{ __html: article.renderedHtml }} />
                </div>
              </div>
            </div>
          ) : article?.renderedHtml && showHtml ? (
            <pre className="workbench-html-source">{article.renderedHtml}</pre>
          ) : (
            <div className="workbench-preview-empty">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <p>选择模板后点击"生成预览"</p>
            </div>
          )}

          {/* Stats */}
          <div className="workbench-preview-stats">
            <span>{wordCount} 字</span>
            <span>·</span>
            <span>{readTime} 分钟阅读</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
