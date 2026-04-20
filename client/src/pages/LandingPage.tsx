import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getArticle,
  getArticles,
  getTemplates,
  renderArticle,
  uploadArticle
} from "../lib/api";
import { writeWorkbenchState } from "../lib/workbench";
import type { ArticleDetail, TemplateSummary } from "../types";

export function LandingPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<ArticleDetail[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("default-light");
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
        const [fetchedTemplates, fetchedArticles] = await Promise.all([
          getTemplates(),
          getArticles()
        ]);
        setTemplates(fetchedTemplates);

        if (fetchedArticles.length > 0) {
          const first = fetchedArticles[0];
          setSelectedArticleId(first.id);
          setSelectedTemplateId(first.templateId || "default-light");
          try {
            const rendered = await renderArticle(first.id, first.templateId || "default-light");
            setRenderedHtml(rendered.renderedHtml);
          } catch {
            setRenderedHtml(null);
          }
        }
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
      writeWorkbenchState({ selectedArticleId: payload.id });
      navigate(`/workbench`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  function handleWorkbench() {
    if (selectedArticleId) {
      writeWorkbenchState({ selectedArticleId, selectedTemplateId });
    }
    navigate(`/workbench`);
  }

  return (
    <div className="landing-shell">
      {/* Hero */}
      <div className="landing-hero">
        <h1 className="landing-title">
          Markdown 转公众号排版<br />一键生成精美文章
        </h1>
        <p className="landing-subtitle">
          告别繁琐的排版工作，专注于内容创作。支持多种风格模板，AI 智能排版让文章更专业。
        </p>
      </div>

      {/* Main Content */}
      <div className="landing-main">
        {/* Left: Preview */}
        <div className="landing-preview-col">
          <div className="landing-preview-card">
            {/* Template Tabs */}
            <div className="landing-template-tabs">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  className={`landing-template-tab ${tpl.id === selectedTemplateId ? "active" : ""}`}
                  onClick={() => void handleTemplateSwitch(tpl.id)}
                >
                  {tpl.name}
                </button>
              ))}
            </div>

            {/* Preview Body */}
            <div className="landing-preview-body">
              {isLoading ? (
                <div className="landing-preview-loading">
                  <div className="landing-spinner" />
                </div>
              ) : (
                <div className="landing-phone-wrap">
                  <div className="landing-phone">
                    <div className="landing-phone-screen">
                      <div className="landing-phone-content">
                        {renderedHtml ? (
                          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                        ) : (
                          <div className="landing-preview-empty">选择模板后预览</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Upload */}
        <div className="landing-upload-col">
          <div className="landing-upload-card">
            <h2 className="landing-upload-title">上传文章</h2>
            <p className="landing-upload-sub">支持多种格式，快速开始创作</p>

            <form onSubmit={handleUpload}>
              <div className="landing-drop-zone">
                <input
                  type="file"
                  accept=".md,.txt,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] ?? null);
                    setError("");
                  }}
                />
                <div className="landing-drop-icon">
                  <svg viewBox="0 0 24 24" width="28" height="28">
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
                  {selectedFile ? selectedFile.name : "拖拽文件到这里，或点击选择"}
                </div>
                <div className="landing-drop-hint">支持以下格式</div>
                <div className="landing-formats">
                  <span className="landing-format-tag">.md</span>
                  <span className="landing-format-tag">.txt</span>
                  <span className="landing-format-tag">.doc</span>
                  <span className="landing-format-tag">.docx</span>
                </div>
              </div>
              {error && <p style={{ color: "var(--red)", fontSize: "13px", marginTop: "8px" }}>{error}</p>}
              <button
                type="submit"
                className="landing-upload-btn"
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? "上传中..." : "导入文章"}
              </button>
            </form>

            {/* Features */}
            <div className="landing-features">
              <div className="landing-feature">
                <div className="landing-feature-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M4 5h16v2H4zM4 11h16v2H4zM4 17h10v2H4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
                <div className="landing-feature-name">多模板风格</div>
              </div>
              <div className="landing-feature">
                <div className="landing-feature-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <div className="landing-feature-name">AI 智能排版</div>
              </div>
              <div className="landing-feature">
                <div className="landing-feature-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <div className="landing-feature-name">一键发布</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
