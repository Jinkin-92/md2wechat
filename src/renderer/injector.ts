import type { ArticleMediaAssets } from "../shared/types.js";
import { getStoredAssetPublicUrl } from "../storage/articles.js";
import { getTemplateById } from "./templates.js";
import type { TemplateDefinition } from "./templates.js";

function replaceBase64ImagesWithPlaceholders(html: string, mediaAssets: ArticleMediaAssets): string {
  let imageIndex = 0;
  const bodyImages = mediaAssets.bodyImages;
  const bodyImageCount = bodyImages.length;
  let result = html;
  let searchStart = 0;
  while (true) {
    const imgStart = result.toLowerCase().indexOf("<img", searchStart);
    if (imgStart === -1) break;
    const imgEnd = result.indexOf(">", imgStart);
    if (imgEnd === -1) break;
    const imgTag = result.substring(imgStart, imgEnd + 1);
    if (!imgTag.includes("data:image") || !imgTag.includes("base64")) {
      searchStart = imgStart + 4;
      continue;
    }
    if (imageIndex >= bodyImageCount) {
      searchStart = imgEnd + 1;
      continue;
    }
    const slot = bodyImages[imageIndex];
    imageIndex++;
    const previewUrl = getStoredAssetPublicUrl(slot.storageKey);
    const placeholder = slot.placeholder || slot.label || "image";
    let replacement;
    if (previewUrl) {
      replacement =
        "<figure data-codex-media-slot=\"" +
        slot.id +
        "\" data-codex-media-marker=\"" +
        slot.markerToken +
        "\" style=\"margin:24px 0;\"><img src=\"" +
        previewUrl +
        "\" alt=\"" +
        placeholder +
        "\" style=\"display:block;width:100%;border-radius:18px;border:1px solid rgba(15,23,42,0.08);\" /><figcaption style=\"margin-top:10px;font-size:12px;color:#64748b;text-align:center;\">" +
        placeholder +
        "</figcaption></figure>";
    } else {
      replacement =
        "<figure data-codex-media-slot=\"" +
        slot.id +
        "\" data-codex-media-marker=\"" +
        slot.markerToken +
        "\" style=\"margin:24px 0;\"><div data-codex-empty-image=\"true\" style=\"display:flex;align-items:center;justify-content:center;min-height:180px;border:1px dashed rgba(15,23,42,0.24);border-radius:18px;background:rgba(148,163,184,0.08);color:#475569;font-size:14px;padding:24px;text-align:center;\">Please upload image for " +
        placeholder +
        "</div><figcaption style=\"margin-top:10px;font-size:12px;color:#64748b;text-align:center;\">" +
        placeholder +
        "</figcaption></figure>";
    }
    const pBeforeMatch = result.lastIndexOf("<p", imgStart);
    let replaceStart = imgStart;
    let replaceEnd = imgEnd + 1;
    if (pBeforeMatch !== -1 && pBeforeMatch < imgStart) {
      const textBetweenPAndImg = result.substring(pBeforeMatch + 2, imgStart).trim();
      if (textBetweenPAndImg === "") {
        const pTagEnd = result.indexOf(">", pBeforeMatch);
        if (pTagEnd !== -1 && pTagEnd < imgEnd) {
          replaceStart = pBeforeMatch;
          replaceEnd = pTagEnd + 1;
        }
      }
    }
    result = result.substring(0, replaceStart) + replacement + result.substring(replaceEnd);
    searchStart = replaceStart + replacement.length;
  }
  return result;
}

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
  // First pass: match generic placeholders like <p>【图片 1】</p>
  let result = mediaAssets.bodyImages.reduce((currentHtml, slot) => {
    const previewUrl = getStoredAssetPublicUrl(slot.storageKey);
    const figure = buildFigure(slot, previewUrl);

    return currentHtml
      .split(`<p>${slot.placeholder}</p>`)
      .join(figure)
      .split(`<p><em>${slot.placeholder}</em></p>`)
      .join(figure);
  }, html);

  // Second pass: replace ALL 【此处插入...】 markers regardless of context
  // These can appear inside <p> tags, between block elements, or as standalone text
  let slotIndex = 0;
  result = result.replace(/【此处插入[^】]+】/g, () => {
    if (slotIndex >= mediaAssets.bodyImages.length) return "";
    const slot = mediaAssets.bodyImages[slotIndex];
    slotIndex++;
    const previewUrl = getStoredAssetPublicUrl(slot.storageKey);
    return buildFigure(slot, previewUrl);
  });
  // Clean up empty <p> tags left after marker replacement
  result = result.replace(/<p([^>]*)>\s*<\/p>/g, "");

  return result;
}

function buildFigure(slot: ArticleMediaAssets["bodyImages"][number], previewUrl: string | null): string {
  const parts = [
    `<figure data-codex-media-slot="${slot.id}" data-codex-media-marker="${slot.markerToken}" style="margin:24px 0;">`,
    previewUrl
      ? `<img src="${previewUrl}" alt="${escapeHtml(slot.label)}" data-codex-preview-image="true" style="display:block;width:100%;border-radius:18px;border:1px solid rgba(15,23,42,0.08);" />`
      : `<div data-codex-empty-image="true" style="display:flex;align-items:center;justify-content:center;min-height:180px;border:1px dashed rgba(15,23,42,0.24);border-radius:18px;background:rgba(148,163,184,0.08);color:#475569;font-size:14px;padding:24px;text-align:center;">Please upload image for ${escapeHtml(slot.label)}</div>`,
    `<figcaption style="margin-top:10px;font-size:12px;color:#64748b;text-align:center;">${escapeHtml(slot.placeholder || "image")}</figcaption>`,
    "</figure>"
  ];
  return parts.join("");
}

function buildBlockquoteStyle(tokens: TemplateDefinition["tokens"]): string {
  const base = `margin:20px 0;padding:16px 18px;background:${tokens.quoteBackground};color:${tokens.blockquoteTextColor};`;
  switch (tokens.blockquoteStyle) {
    case "left-border":
      return `${base}border-left:4px solid ${tokens.accentColor};border-radius:0 14px 14px 0;`;
    case "background":
      return `${base}border:1px solid ${tokens.borderColor};border-left:4px solid ${tokens.accentColor};border-radius:8px;`;
    case "italic":
      return `${base}border:none;font-style:italic;`;
    case "double-border":
      return `${base}border-left:6px double ${tokens.accentColor};border-radius:0;`;
    case "none":
      return `${base}border:none;`;
    default:
      return `${base}border-left:4px solid ${tokens.accentColor};border-radius:0 14px 14px 0;`;
  }
}

function buildHrStyle(tokens: TemplateDefinition["tokens"], styleOverride?: string): string {
  switch (styleOverride ?? tokens.hrStyle) {
    case "line":
      return `margin:${tokens.sectionMargin};border:none;border-top:1px solid ${tokens.borderColor};`;
    case "dashed":
      return `margin:${tokens.sectionMargin};border:none;border-top:2px dashed ${tokens.borderColor};`;
    case "double":
      return `margin:${tokens.sectionMargin};border:none;border-top:3px double ${tokens.borderColor};`;
    case "ornament":
      return `margin:${tokens.sectionMargin};border:none;border-top:2px solid ${tokens.borderColor};text-align:center;position:relative;`;
    case "gradient":
      return `margin:${tokens.sectionMargin};border:none;height:2px;background:linear-gradient(90deg,transparent,${tokens.accentColor},transparent);`;
    case "space":
      return `margin:40px 0;border:none;height:1px;`;
    case "none":
      return `margin:${tokens.sectionMargin};border:none;`;
    default:
      return `margin:${tokens.sectionMargin};border:none;border-top:1px solid ${tokens.borderColor};`;
  }
}

function buildListStyle(tokens: TemplateDefinition["tokens"]): string {
  switch (tokens.listStyle) {
    case "disc":
      return `list-style-type:disc;`;
    case "circle":
      return `list-style-type:circle;`;
    case "square":
      return `list-style-type:square;`;
    case "none":
      return `list-style-type:none;`;
    default:
      return `list-style-type:disc;`;
  }
}

export type CustomRenderOptions = {
  fontSize?: string;
  lineHeight?: string;
  paragraphIndent?: boolean;
  paragraphMargin?: string;
  sectionDivider?: string;
  endMarker?: string;
  platformName?: string;
  originalChecked?: boolean;
};

export type ArticleRenderMeta = {
  title?: string;
  author?: string;
  digest?: string;
  platformName?: string;
  originalChecked?: boolean;
};

function buildEndMarker(marker: string | undefined, tokens: TemplateDefinition["tokens"]): string {
  switch (marker) {
    case "end":
      return `<section data-codex-end-marker="true" style="margin:34px 0 8px;text-align:center;color:${tokens.mutedColor};font-size:12px;letter-spacing:0.2em;font-family:${tokens.fontFamily};">END</section>`;
    case "dot":
      return `<section data-codex-end-marker="true" style="margin:34px 0 8px;text-align:center;color:${tokens.accentColor};font-size:18px;">●</section>`;
    case "diamond":
      return `<section data-codex-end-marker="true" style="margin:34px 0 8px;text-align:center;color:${tokens.accentColor};font-size:18px;">◆</section>`;
    case "dash":
      return `<section data-codex-end-marker="true" style="margin:34px 0 8px;text-align:center;color:${tokens.mutedColor};font-size:18px;">—</section>`;
    default:
      return "";
  }
}

function applyTextCard(html: string, cardStyle: string | undefined, tokens: TemplateDefinition["tokens"]): string {
  if (!cardStyle || cardStyle === "none") {
    return html;
  }

  const styleMap: Record<string, string> = {
    flat: `background:${tokens.quoteBackground};border:1px solid ${tokens.borderColor};border-radius:16px;padding:14px 16px;`,
    elevated: `background:${tokens.cardBackground};border:1px solid ${tokens.borderColor};border-radius:18px;padding:15px 17px;box-shadow:0 10px 28px rgba(15,23,42,0.12);`,
    glass: `background:rgba(255,255,255,0.64);border:1px solid rgba(148,163,184,0.28);border-radius:18px;padding:15px 17px;box-shadow:0 12px 32px rgba(15,23,42,0.1);backdrop-filter:blur(12px);`
  };
  const cardRule = styleMap[cardStyle] ?? styleMap.flat;

  return html.replace(/<p(\s[^>]*)? style="([^"]*)"([^>]*)>/g, (_match, before = "", style = "", after = "") => {
    return `<p${before} style="${style}${cardRule}"${after}>`;
  });
}

export function injectTemplateTokens(
  html: string,
  templateId: string,
  mediaAssets?: ArticleMediaAssets,
  customOptions?: CustomRenderOptions,
  meta?: ArticleRenderMeta
): string {
  const template = getTemplateById(templateId);
  const { tokens } = template;

  const effectiveFontSize = customOptions?.fontSize ?? tokens.fontSize;
  const effectiveLineHeight = customOptions?.lineHeight ?? tokens.lineHeight;
  const effectiveParagraphMargin = customOptions?.paragraphMargin ?? tokens.paragraphMargin;

  let styledHtml = mediaAssets ? replaceBase64ImagesWithPlaceholders(html, mediaAssets) : html;
  styledHtml = mediaAssets ? injectMediaSlots(styledHtml, mediaAssets) : styledHtml;

  styledHtml = addStyleToTag(
    styledHtml,
    "h1",
    `margin:0 0 ${tokens.h1MarginBottom};font-size:${tokens.h1Size};line-height:1.3;color:${tokens.headingColor};font-weight:700;font-family:${tokens.h1FontFamily};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "h2",
    `margin:${tokens.h2MarginTop} 0 ${tokens.h2MarginBottom};padding-left:12px;border-left:4px solid ${tokens.accentColor};font-size:${tokens.h2Size};line-height:1.4;color:${tokens.headingColor};font-weight:700;font-family:${tokens.h2FontFamily};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "h3",
    `margin:${tokens.h3MarginTop} 0 ${tokens.h3MarginBottom};font-size:${tokens.h3Size};line-height:1.4;color:${tokens.headingColor};font-weight:600;font-family:${tokens.h3FontFamily};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "p",
    `margin:${effectiveParagraphMargin};font-size:${effectiveFontSize};line-height:${effectiveLineHeight};color:${tokens.textColor};font-family:${tokens.fontFamily};${customOptions?.paragraphIndent ? "text-indent:2em;" : ""}`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "blockquote",
    buildBlockquoteStyle(tokens)
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "ul",
    `margin:${tokens.paragraphMargin};padding-left:22px;${buildListStyle(tokens)}color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "ol",
    `margin:${tokens.paragraphMargin};padding-left:22px;color:${tokens.textColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "li",
    `margin:0 0 10px;font-size:${tokens.fontSize};line-height:${tokens.lineHeight};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "pre",
    `margin:18px 0;padding:16px;border-radius:${tokens.codeBorderRadius};background:${tokens.codeBackground};overflow:auto;color:${tokens.codeTextColor};font-family:${tokens.fontFamilyMono};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "code",
    `font-family:${tokens.fontFamilyMono};font-size:14px;color:${tokens.codeTextColor};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "a",
    `color:${tokens.accentColor};text-decoration:none;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "hr",
    buildHrStyle(tokens, customOptions?.sectionDivider)
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "table",
    `width:100%;margin:18px 0;border-collapse:collapse;border-spacing:0;table-layout:auto;display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:14px;border:1px solid ${tokens.borderColor};background:${tokens.cardBackground};`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "th",
    `padding:10px 12px;background:${tokens.quoteBackground};border:1px solid ${tokens.borderColor};text-align:left;color:${tokens.tableHeaderTextColor ?? tokens.headingColor};font-size:14px;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "td",
    `padding:10px 12px;border:1px solid ${tokens.borderColor};font-size:14px;color:${tokens.textColor};vertical-align:top;min-width:92px;word-break:break-word;`
  );
  styledHtml = addStyleToTag(
    styledHtml,
    "strong",
    `color:${tokens.headingColor};font-weight:700;`
  );

  // Fix: blockquote internal elements should use blockquoteTextColor instead of textColor
  styledHtml = styledHtml.replace(
    /<blockquote([^>]*)>([\s\S]*?)<\/blockquote>/g,
    (_match, attrs, content) => {
      // Replace color in nested elements within blockquote
      const textColorRe = new RegExp(`color:${tokens.textColor}`, 'g');
      const blockquoteTextColor = tokens.blockquoteTextColor;
      const fixedContent = content
        .replace(textColorRe, `color:${blockquoteTextColor}`);
      return `<blockquote${attrs}>${fixedContent}</blockquote>`;
    }
  );

  const author = meta?.author?.trim() || "Jinkin";
  const platformName = (customOptions?.platformName ?? meta?.platformName)?.trim() || "";
  const originalChecked = customOptions?.originalChecked ?? meta?.originalChecked ?? false;
  const title = meta?.title?.trim() || "";
  const metaBlock = title
      ? `<section data-codex-meta="true" style="margin:0 0 28px;padding-bottom:18px;border-bottom:4px solid ${tokens.headingColor};font-family:${tokens.fontFamily};">
<h1 style="margin:0 0 18px;font-size:30px;line-height:1.25;color:${tokens.headingColor};font-weight:500;font-family:${tokens.h1FontFamily};">${escapeHtml(title)}</h1>
<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;line-height:1.6;color:${tokens.mutedColor};">
${originalChecked ? '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;background:#f2f2f2;color:#8a8a8a;">原创</span>' : ""}
<span>${escapeHtml(author)}</span>
${platformName ? `<span style="color:#576174;">${escapeHtml(platformName)}</span>` : ""}
</div>
</section>`
      : "";

  return [
    `<!-- template:${template.id} -->`,
    `<article style="background:${tokens.cardBackground};color:${tokens.textColor};font-size:${tokens.fontSize};line-height:${tokens.lineHeight};padding:28px 22px;border-radius:${tokens.cardRadius};border:1px solid ${tokens.borderColor};box-shadow:${tokens.cardShadow};font-family:${tokens.fontFamily};">`,
    metaBlock,
    styledHtml,
    buildEndMarker(customOptions?.endMarker, tokens),
    `<footer style="margin-top:28px;padding-top:16px;border-top:1px solid ${tokens.borderColor};font-size:12px;color:${tokens.mutedColor};font-family:${tokens.fontFamily};">Template: ${template.name}</footer>`,
    "</article>"
  ].join("\n");
}
