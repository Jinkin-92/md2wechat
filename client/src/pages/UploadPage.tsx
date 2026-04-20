import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getArticles, uploadArticle } from "../lib/api";
import { writeWorkbenchState } from "../lib/workbench";
import type { ArticleSummary } from "../types";

const statusLabel: Record<ArticleSummary["status"], string> = {
  draft: "待排版",
  rendered: "已渲染",
  uploading: "上传中",
  done: "已完成",
  error: "异常"
};

export function UploadPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadArticles() {
    setIsLoading(true);
    try {
      setArticles(await getArticles());
    } catch {
      setError("加载文章列表失败");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setError("请先选择一个文件");
      return;
    }

    setIsUploading(true);
    setError("");
    setMessage("");

    try {
      const payload = await uploadArticle(selectedFile);
      writeWorkbenchState({ selectedArticleId: payload.id });
      navigate(`/preview?articleId=${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="page-header">
      <h1>导入文章</h1>
      <p>上传 Markdown 文件，自动转成微信公众号排版</p>

      <div className="stack" style={{ marginTop: "32px", maxWidth: "560px" }}>
        <form onSubmit={handleUpload}>
          <div className="card stack">
            <label className="upload-zone">
              <input
                type="file"
                accept=".md,text/markdown"
                style={{ display: "none" }}
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null);
                  setError("");
                  setMessage("");
                }}
              />
              <div className="upload-zone-icon">📄</div>
              <div className="upload-zone-title">
                {selectedFile ? selectedFile.name : "点击或拖拽文件到这里"}
              </div>
              <div className="upload-zone-hint">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : "支持 .md 格式"}
              </div>
            </label>

            {message && <p style={{ color: "var(--success)", fontSize: "13px" }}>{message}</p>}
            {error && <p style={{ color: "var(--error)", fontSize: "13px" }}>{error}</p>}

            <div className="btn-row" style={{ marginTop: "4px" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? "导入中..." : "导入并继续"}
              </button>
            </div>
          </div>
        </form>

        {articles.length > 0 && (
          <div className="card">
            <p className="section-title">最近文章</p>
            <div className="stack compact">
              {articles.slice(0, 6).map((article) => (
                <div
                  key={article.id}
                  className="article-card"
                  onClick={() => {
                    writeWorkbenchState({ selectedArticleId: article.id });
                    navigate(`/preview?articleId=${article.id}`);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="article-card-title">{article.title}</span>
                    <span className="badge badge-gray">{statusLabel[article.status]}</span>
                  </div>
                  <div className="article-card-meta">
                    {article.sourceFileName} · {article.metadata.wordCount} 字
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
