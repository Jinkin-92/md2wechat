import type { ArticleDetail } from "../types";

function escapeMarkdown(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const children = Array.from(node.childNodes).map(serializeInline).join("");
  switch (node.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return `**${children.trim()}**`;
    case "em":
    case "i":
      return `*${children.trim()}*`;
    case "code":
      return `\`${children.trim()}\``;
    case "a":
      return node.getAttribute("href") ? `[${children.trim()}](${node.getAttribute("href")})` : children;
    case "br":
      return "\n";
    default:
      return children;
  }
}

function serializeTable(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => serializeInline(cell).replace(/\|/g, "\\|").trim())
  );
  if (rows.length === 0) return "";

  const header = rows[0];
  const divider = header.map(() => "---");
  const body = rows.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function serializeBlock(node: Node, article: ArticleDetail): string {
  if (!(node instanceof HTMLElement)) {
    return serializeInline(node);
  }

  if (node.matches("[data-codex-meta], footer")) {
    return "";
  }

  const tag = node.tagName.toLowerCase();
  const text = escapeMarkdown(Array.from(node.childNodes).map(serializeInline).join(""));

  switch (tag) {
    case "h1":
      return `# ${text}`;
    case "h2":
      return `## ${text}`;
    case "h3":
      return `### ${text}`;
    case "p":
      return text;
    case "blockquote":
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join("\n");
    case "ul":
      return Array.from(node.children)
        .map((child) => `- ${escapeMarkdown(Array.from(child.childNodes).map(serializeInline).join(""))}`)
        .join("\n");
    case "ol":
      return Array.from(node.children)
        .map(
          (child, index) =>
            `${index + 1}. ${escapeMarkdown(Array.from(child.childNodes).map(serializeInline).join(""))}`
        )
        .join("\n");
    case "pre":
      return `\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\``;
    case "hr":
      return "---";
    case "table":
      return serializeTable(node as HTMLTableElement);
    case "figure": {
      const slotId = node.getAttribute("data-codex-media-slot");
      const slot = article.mediaAssets.bodyImages.find((item) => item.id === slotId);
      return slot?.placeholder ?? "";
    }
    default:
      return text;
  }
}

export function extractEditableHtml(renderedHtml: string | null): string {
  if (!renderedHtml) {
    return "";
  }

  const document = new DOMParser().parseFromString(renderedHtml, "text/html");
  const article = document.querySelector("article");
  if (!article) {
    return renderedHtml;
  }

  article.querySelector("[data-codex-meta='true']")?.remove();
  article.querySelector("footer")?.remove();
  return article.innerHTML;
}

export function serializeEditableHtmlToMarkdown(
  editableHtml: string,
  article: ArticleDetail
): string {
  const document = new DOMParser().parseFromString(`<article>${editableHtml}</article>`, "text/html");
  const root = document.querySelector("article");
  if (!root) {
    return article.rawMarkdown;
  }

  return Array.from(root.childNodes)
    .map((node) => serializeBlock(node, article))
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
