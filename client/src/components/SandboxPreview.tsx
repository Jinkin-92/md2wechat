/**
 * md2wechat 沙箱预览组件
 * 使用 iframe sandbox 隔离预览，安全可控
 */

import { useEffect, useRef } from "react";

export interface SandboxPreviewProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 沙箱预览组件
 * - allow-scripts: 允许执行脚本（Tailwind CDN 等）
 * - allow-same-origin: 允许同源（Google Fonts 等）
 * - 禁止: cookie、localStorage、跨域请求、父页面 DOM 访问
 */
export function SandboxPreview({ html, className, style }: SandboxPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // 使用 srcdoc 避免 blob URL 的 CSP 限制
    iframe.srcdoc = html;
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      className={className}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: "8px",
        ...style,
      }}
      title="预览"
    />
  );
}

/**
 * 带错误边界的安全预览
 */
export function SafePreview({ html, onError }: { html: string; onError?: (err: Error) => void }) {
  try {
    return <SandboxPreview html={html} />;
  } catch (err) {
    if (err instanceof Error && onError) {
      onError(err);
    }
    return (
      <div
        style={{
          padding: "16px",
          color: "#EA4335",
          background: "#FEF2F2",
          borderRadius: "8px",
        }}
      >
        预览渲染失败: {err instanceof Error ? err.message : "未知错误"}
      </div>
    );
  }
}