/**
 * md2wechat AI 约束 Prompt
 * Anti-AI-slop 五维约束，防止 AI freestyle
 */

// ==================== 排版约束 ====================

export const TYPESET_CONSTRAINTS = `

约束：

1. **字体**: 使用 CJK-first 字体栈，Noto Sans SC 优先。中文始终使用中文字体，不得出现豆腐块（方框口）。
2. **网格**: 所有间距/行高是 8px 的倍数。如：16px、24px、32px。
3. **圆角**: 卡片/按钮使用 4-8px 圆角，禁止锐利边缘。
4. **色彩**: 对比度 >= 4.5 (WCAG AA)，禁止纯黑 #000 / 纯白 #FFF。
5. **内容**: 禁止 lorem ipsum、随机英文、数字。必须使用用户提供的数据。
6. **结构**: 保持原文的标题层级（h1/h2/h3）、列表、表格、代码块不变。
7. **图片占位符**: 【此处插入...】标记必须原样保留，不得删除或改写。

输出格式：
{
  "markdown": "排版后的完整 markdown",
  "digest": "40-80 字中文摘要"
}
`;

export const DIGEST_CONSTRAINTS = `

约束：

1. **字数**: 40-80 字中文摘要。
2. **准确**: 准确概括文章核心观点，不编造事实。
3. **可读**: 语言简洁、有吸引力，适合作为公众号推文摘要。
4. **格式**: 返回严格 JSON，仅包含 digest 字段。

输出格式：
{
  "digest": "摘要内容"
}
`;

export const COVER_PROMPT = `

约束：

1. **风格**: 扁平插画风格 (flat illustration)、简约、干净背景。
2. **色调**: 与文章主题契合的暖色调或冷色调，单一主色。
3. **构图**: 简洁有力，突出主题，避免过于复杂的场景。
4. **尺寸**: 宽高比 2.35:1 (如 940x400)，适合微信公众号封面。
`;

// ==================== 系统提示词 ====================

export const TYPESET_SYSTEM =
  "You are a Chinese WeChat article editor. Improve readability and structure, but do not fabricate facts. Keep the author's viewpoint, headings, tables, image placeholders and data unchanged.";

export const DIGEST_SYSTEM =
  "You are a Chinese WeChat article editor. Given an article title and content, write a concise and engaging Chinese digest. Do not fabricate facts.";

export const COVER_SYSTEM =
  "You are a prompt engineer for image generation. Given a Chinese article title, generate a concise English image generation prompt suitable for creating a WeChat article cover image.";

// ==================== 工具函数 ====================

type ConstraintType = "typeset" | "digest" | "cover";

export function getConstraintPrompt(type: ConstraintType): string {
  switch (type) {
    case "typeset":
      return TYPESET_CONSTRAINTS;
    case "digest":
      return DIGEST_CONSTRAINTS;
    case "cover":
      return COVER_PROMPT;
  }
}