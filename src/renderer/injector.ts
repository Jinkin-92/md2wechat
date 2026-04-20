import type { ArticleMediaAssets } from "../shared/types.js";
import { getStoredAssetPublicUrl } from "../storage/articles.js";
import { getTemplateById } from "./templates.js";

function addStyleToTag(html: string, tagName: string, style: string): string {
  const pattern = new RegExp(`<${tagName}(\\s[^>]*)?>`, "g");

  return html.replace(pattern, (_match, attributes = "") => {
    if (String(attributes).includes("style=")) {
      return `<${tagName}${attributes}>`;
    }

    return `<${tagName}${attributes} style="${style}">`;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function injectMediaSlots(html: string, mediaAssets: ArticleMediaAssets): string {
  return mediaAssets.bodyImages.reduce((currentHtml, slot, index) => {
    const previewUrl = getStoredAssetPublicUrl(slot.storageKey);
    const figure = [
      `<figure data-codex-media-slot="${slot.id}" data-codex-media-marker="${slot.markerToken}" style="margin:24px 0;">`,
      previewUrl
        ? `<img src="${previewUrl}" alt="${escapeHtml(slot.label)}" data-codex-preview-image="true" style="display:block;width:100%;border-radius:18px;border:1px solid rgba(15,23,42,0.08);" />`
        : `<div data-codex-empty-image="true" style="display:flex;align-items:center;justify-content:center;min-height:180px;border:1px dashed rgba(15,23,42,0.24);border-radius:18px;background:rgba(148,163,184,0.08);color:#475569;font-size:14px;padding:24px;text-align:center;">请在预览页为 ${escapeHtml(slot.label)} 上传图片</div>`,
      `<figcaption style="margin-top:10px;font-size:12px;color:#64748b;text-align:center;">${escapeHtml(slot.placeholder || `图片位 ${index + 1}`)}</figcaption>`,
      "</figure>"
    ].join("");

    return currentHtml
      .split(`<p>${slot.placeholder}</p>`)
      .join(figure)
      .split(`<p><em>${slot.placeholder}</em></p>`)
      .join(figure);
  }, html);
}

export function injectTemplateTokens(
  html: string,
  templateId: string,
  mediaAssets?: ArticleMediaAssets
): string {
  const template = getTemplateById(templateId);
  const { tokens } = template;

  let styledHtml = mediaAssets ? injectMediaSlots(html, mediaAssets) : html;

  styledHtml = addStyleToTag(
    styledHtml,
    "h1",
    `margin:0 0 20px;font-size:${tokens.h1Size};line-height:1.35;color:${tokens.headingColor};font-weight:700;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "h2",
    `margin:32px 0 14px;padding-left:12px;border-left:4px solid ${tokens.accentColor};font-size:${tokens.h2Size};line-height:1.4;color:${tokens.headingColor};font-weight:700;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "h3",
    `margin:24px 0 12px;font-size:${tokens.h3Size};line-height:1.45;color:${tokens.headingColor};font-weight:700;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "p",
    `margin:0 0 16px;font-size:${tokens.fontSize};line-height:${tokens.lineHeight};color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "blockquote",
    `margin:20px 0;padding:16px 18px;border-left:4px solid ${tokens.accentColor};background:${tokens.quoteBackground};border-radius:0 14px 14px 0;color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "ul",
    `margin:0 0 16px;padding-left:22px;color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "ol",
    `margin:0 0 16px;padding-left:22px;color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "li",
    `margin:0 0 10px;font-size:${tokens.fontSize};line-height:${tokens.lineHeight};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "pre",
    `margin:18px 0;padding:16px;border-radius:16px;background:${tokens.codeBackground};overflow:auto;color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "code",
    `font-family:Consolas,'SFMono-Regular',monospace;font-size:14px;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "a",
    `color:${tokens.accentColor};text-decoration:none;border-bottom:1px solid ${tokens.accentColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "hr",
    `margin:28px 0;border:none;border-top:1px solid ${tokens.borderColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "table",
    `width:100%;margin:18px 0;border-collapse:collapse;border-spacing:0;overflow:hidden;border-radius:14px;border:1px solid ${tokens.borderColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "th",
    `padding:10px 12px;background:${tokens.quoteBackground};border:1px solid ${tokens.borderColor};text-align:left;color:${tokens.headingColor};font-size:14px;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "td",
    `padding:10px 12px;border:1px solid ${tokens.borderColor};font-size:14px;color:${tokens.textColor};vertical-align:top;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "strong",
    `color:${tokens.headingColor};font-weight:700;`
  );

  return [
    `<!-- template:${template.id} -->`,
    `<article style="background:${tokens.cardBackground};color:${tokens.textColor};font-size:${tokens.fontSize};line-height:${tokens.lineHeight};padding:28px 22px;border-radius:24px;border:1px solid ${tokens.borderColor};box-shadow:0 12px 30px rgba(15,23,42,0.08);">`,
    styledHtml,
    `<footer style="margin-top:28px;padding-top:16px;border-top:1px solid ${tokens.borderColor};font-size:12px;color:${tokens.mutedColor};">模板：${template.name}</footer>`,
    "</article>"
  ].join("\n");
}
