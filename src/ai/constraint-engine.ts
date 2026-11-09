/**
 * md2wechat 约束引擎
 * 管理 SKILL.md 加载和 system prompt 构建
 */

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const SKILLS_DIR = path.resolve(process.cwd(), "src/skills");

// ==================== 类型定义 ====================

export interface SkillConstraints {
  font_cjk?: string;
  font_latin?: string;
  grid?: string;
  border_radius?: boolean;
  contrast_ratio?: number;
  no_lorem_ipsum?: boolean;
  real_data_only?: boolean;
}

export interface SkillSpec {
  name: string;
  description?: string;
  constraints: SkillConstraints;
  prompt: string;
}

// ==================== 工具函数 ====================

function formatConstraints(constraints: SkillConstraints): string {
  const lines: string[] = [];

  if (constraints.font_cjk) {
    lines.push(`- **字体**: CJK-first，${constraints.font_cjk} 优先`);
  }
  if (constraints.font_latin) {
    lines.push(`- **Latin 字体**: ${constraints.font_latin}`);
  }
  if (constraints.grid) {
    lines.push(`- **网格**: 所有间距是 ${constraints.grid} 的倍数`);
  }
  if (constraints.border_radius) {
    lines.push(`- **圆角**: 卡片/按钮使用 4-8px 圆角`);
  }
  if (constraints.contrast_ratio) {
    lines.push(`- **对比度**: >= ${constraints.contrast_ratio} (WCAG AA)`);
  }
  if (constraints.no_lorem_ipsum) {
    lines.push(`- **内容**: 禁止 lorem ipsum`);
  }
  if (constraints.real_data_only) {
    lines.push(`- **数据**: 必须使用用户提供的数据`);
  }

  return lines.join("\n");
}

// ==================== 核心功能 ====================

/**
 * 加载指定名称的技能
 */
export async function loadSkill(skillName: string): Promise<SkillSpec> {
  const skillsDir = SKILLS_DIR;
  const skillPath = path.join(skillsDir, skillName, "SKILL.md");

  try {
    const fileContent = await fs.readFile(skillPath, "utf-8");
    const { data, content } = matter(fileContent);

    return {
      name: data.name ?? skillName,
      description: data.description,
      constraints: {
        font_cjk: data.constraints?.font_cjk,
        font_latin: data.constraints?.font_latin,
        grid: data.constraints?.grid,
        border_radius: data.constraints?.border_radius ?? true,
        contrast_ratio: data.constraints?.contrast_ratio ?? 4.5,
        no_lorem_ipsum: data.constraints?.no_lorem_ipsum ?? true,
        real_data_only: data.constraints?.real_data_only ?? true,
      },
      prompt: content.trim(),
    };
  } catch {
    return getDefaultSkill();
  }
}

/**
 * 获取默认技能
 */
export function getDefaultSkill(): SkillSpec {
  return {
    name: "默认排版",
    description: "md2wechat 默认微信公众号排版技能",
    constraints: {
      font_cjk: "Noto Sans SC",
      font_latin: "Inter",
      grid: "8px",
      border_radius: true,
      contrast_ratio: 4.5,
      no_lorem_ipsum: true,
      real_data_only: true,
    },
    prompt: "你是一个专业的微信公众号排版助手。",
  };
}

/**
 * 构建排版任务的 system prompt
 */
export function buildTypesetSystemPrompt(skill: SkillSpec): string {
  const parts: string[] = [skill.prompt, "", "排版约束：", formatConstraints(skill.constraints)];

  return parts.filter(Boolean).join("\n");
}

/**
 * 构建摘要生成的 system prompt
 */
export function buildDigestSystemPrompt(skill: SkillSpec): string {
  return `${skill.prompt}

摘要约束：
- 40-80 字中文摘要
- 准确概括文章核心观点，不编造事实
- 语言简洁、有吸引力`;
}

/**
 * 列出所有可用技能
 */
export async function listSkills(): Promise<string[]> {
  const skillsDir = SKILLS_DIR;

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
        try {
          await fs.access(skillMdPath);
          skills.push(entry.name);
        } catch {
          // 目录中没有 SKILL.md，跳过
        }
      }
    }

    return skills.sort();
  } catch {
    return ["default"];
  }
}

// ==================== 向后兼容导出 ====================

export { formatConstraints };