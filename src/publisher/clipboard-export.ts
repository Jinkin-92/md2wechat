/**
 * md2wechat 微信公众号导出模块
 * 使用 juice 将 CSS inline，确保粘贴兼容性
 */

import juice from "juice";

export interface WechatExportOptions {
  html: string;
  css?: string;
  minify?: boolean;
}

/**
 * 为微信公众号导出 HTML
 * juice 会将外部 CSS 内联到 HTML 元素 style 属性
 */
export function exportForWechat(options: WechatExportOptions): string {
  const { html, css = "", minify = false } = options;

  // 合并 HTML 和 CSS
  let content = html;
  if (css) {
    // juice.inlineContent 需要将 CSS 放在 <style> 标签中
    content = `<style>${css}</style>${html}`;
  }

  // juice 将外部 CSS 内联到 HTML 元素 style 属性
  const inlined = juice.inlineContent(content, "", {
    removeStyleTags: true,
    preserveImportant: true,
  });

  // 添加 data-tool 标记
  const withMarker = inlined.replace(
    /<body([^>]*)?>/i,
    `<body$1 data-tool="md2wechat">`
  );

  // 可选压缩
  if (minify) {
    return minifyHtml(withMarker);
  }

  return withMarker;
}

/**
 * 复制到剪贴板（仅返回处理后的 HTML）
 */
export function processForClipboard(html: string, css: string): string {
  return exportForWechat({ html, css });
}

// ==================== 辅助函数 ====================

function minifyHtml(html: string): string {
  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

/**
 * 检测 HTML 是否适合微信粘贴
 */
export function validateForWechat(html: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // 检查是否包含外部样式表引用
  if (html.includes("<link") && html.includes('rel="stylesheet"')) {
    warnings.push("检测到外部样式表引用，粘贴后可能丢失样式。建议使用「复制 HTML」功能。");
  }

  // 检查是否有 base64 图片
  if (html.includes("data:image")) {
    warnings.push("包含 base64 图片，可能导致粘贴失败。");
  }

  // 检查是否有 JavaScript
  if (html.includes("<script")) {
    warnings.push("检测到 JavaScript，微信公众号编辑器会移除脚本。");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}