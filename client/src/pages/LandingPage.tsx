import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getArticles,
  getDefaultPreviewArticle,
  getTemplates,
  renderArticle,
  uploadArticle
} from "../lib/api";
import { getTemplateCardStyle } from "../lib/template-style";
import { writeWorkbenchState } from "../lib/workbench";
import type { ArticleSummary, TemplateSummary } from "../types";

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

export function LandingPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("claude");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [fetchedTemplates, fetchedArticles, previewArticle] = await Promise.all([
          getTemplates(),
          getArticles(),
          getDefaultPreviewArticle()
        ]);
        setTemplates(fetchedTemplates);
        setArticles(
          fetchedArticles.some((item) => item.id === previewArticle.id)
            ? fetchedArticles
            : [previewArticle, ...fetchedArticles]
        );
        const nextTemplateId = "claude";
        setSelectedArticleId(previewArticle.id);
        setSelectedTemplateId(nextTemplateId);
        const rendered = await renderArticle(previewArticle.id, nextTemplateId);
        setRenderedHtml(rendered.renderedHtml);
      } catch {
        setError("加载失败");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleTemplateSwitch(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!selectedArticleId) return;

    try {
      const rendered = await renderArticle(selectedArticleId, templateId);
      setRenderedHtml(rendered.renderedHtml);
    } catch {
      setRenderedHtml(null);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setError("");
    try {
      const payload = await uploadArticle(selectedFile);
      writeWorkbenchState({ selectedArticleId: payload.id, selectedTemplateId: "claude" });
      navigate(`/workbench?articleId=${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );
  const selectedArticle = articles.find((item) => item.id === selectedArticleId) ?? null;

  return (
    <div className="landing-shell landing-shell-refined">
      <section className="landing-main landing-main-refined">
        <aside className="landing-sidebar">
          <div className="landing-brand">md2wechat</div>

          <div className="landing-template-grid">
            {templates.map((template) =>
              renderTemplateCard(template, template.id === selectedTemplateId, () => {
                void handleTemplateSwitch(template.id);
              })
            )}
          </div>
        </aside>

        <section className="landing-preview-panel">
          <div className="landing-preview-heading">
            <div className="landing-preview-title-group">
              <span className="landing-preview-label">手机预览</span>
              <h2>{selectedTemplate?.name ?? "模板预览"}</h2>
            </div>
            {selectedArticle ? (
              <button
                type="button"
                className="landing-workbench-btn"
                onClick={() => navigate(`/workbench?articleId=${selectedArticle.id}`)}
              >
                进入工作台
              </button>
            ) : null}
          </div>

          <div className="landing-preview-stage landing-preview-stage-refined">
            {isLoading ? (
              <div className="landing-preview-loading">
                <div className="landing-spinner" />
              </div>
            ) : (
              <div className="landing-preview-composition">
                <div className="landing-device-center">
                  <div className="device-frame landing-device-frame compact-device">
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
                      <div className="landing-phone-content wechat-article-scroll">
                        {renderedHtml ? (
                          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                        ) : (
                          <div className="landing-preview-empty">选择模板后预览</div>
                        )}
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
                <form onSubmit={handleUpload} className="landing-upload-panel landing-upload-panel-side">
                  <div className="landing-upload-side-header">
                    <span className="landing-preview-label">下一步</span>
                    <h3>导入 Markdown</h3>
                    <p>导入后直接进入工作台，并默认应用 Claude 模板。</p>
                  </div>
                  <label className="landing-drop-zone" htmlFor="landing-file-input">
                    <input
                      id="landing-file-input"
                      type="file"
                      accept=".md,.txt,.doc,.docx"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setError("");
                      }}
                    />
                    <div className="landing-drop-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path
                          d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                    <div className="landing-drop-text">
                      {selectedFile ? selectedFile.name : "选择文章文件"}
                    </div>
                    <div className="landing-formats">
                      <span className="landing-format-tag">.md</span>
                      <span className="landing-format-tag">.txt</span>
                    </div>
                  </label>
                  {error ? <p className="landing-error">{error}</p> : null}
                  <button
                    type="submit"
                    className="landing-upload-btn"
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? "上传中..." : "进入工作台"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
