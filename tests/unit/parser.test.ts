import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/renderer/parser.js";

describe("Markdown Parser", () => {
  it("should parse heading into h1 HTML", async () => {
    const html = await parseMarkdown("# Hello World");
    expect(html).toContain("<h1");
  });

  it("should parse paragraph text", async () => {
    const html = await parseMarkdown("This is a paragraph.");
    expect(html).toContain("<p>");
  });

  it("should parse multiple headings", async () => {
    const html = await parseMarkdown("# H1\n## H2\n### H3");
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
  });

  it("should parse bold and italic text", async () => {
    const html = await parseMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
  });

  it("should parse inline code", async () => {
    const html = await parseMarkdown("use `console.log()`");
    expect(html).toContain("<code>");
  });

  it("should parse code block", async () => {
    const html = await parseMarkdown("```\nconst x = 1;\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });

  it("should parse blockquote", async () => {
    const html = await parseMarkdown("> This is a quote");
    expect(html).toContain("<blockquote");
  });

  it("should parse ordered and unordered lists", async () => {
    const html = await parseMarkdown("- Item 1\n- Item 2\n1. Numbered 1\n2. Numbered 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
  });

  it("should parse table (GFM)", async () => {
    const html = await parseMarkdown("| Header |\n| ------- |\n| Cell    |");
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
  });

  it("should parse links", async () => {
    const html = await parseMarkdown("[Google](https://google.com)");
    expect(html).toContain('<a href="https://google.com"');
  });

  it("should parse images", async () => {
    const html = await parseMarkdown("![alt text](https://example.com/img.png)");
    expect(html).toContain("<img");
  });

  it("should handle Chinese characters", async () => {
    const html = await parseMarkdown("# 标题\n\n这是一段中文内容。");
    expect(html).toContain("<h1");
    expect(html).toContain("标题");
    expect(html).toContain("中文内容");
  });
});
