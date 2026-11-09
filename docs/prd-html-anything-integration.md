# md2wechat 资产升级 PRD

基于 [html-anything](https://github.com/nexu-io/html-anything) 仓库分析，提取高价值资产集成到 md2wechat 项目。

---

## 1. 主题设计系统

### 目标
引入设计令牌 + anti-AI-slop 约束，统一排版质量。

### 方案

**设计令牌** (`src/renderer/design-tokens.css`):

```css
:root {
  /* CJK 字体栈 */
  --font-cjk: 'Noto Sans SC', 'Source Han Sans CN', sans-serif;
  --font-cjk-serif: 'Noto Serif SC', 'Source Han Serif CN', serif;
  /* 拉丁字体 */
  --font-latin: 'Inter', 'Manrope', system-ui, sans-serif;

  /* 8px 基准网格 */
  --space-1: 8px; --space-2: 16px; --space-3: 24px; --space-4: 32px;

  /* 柔和色系 */
  --color-bg: #FAFAF8;
  --color-surface: #FFFFFF;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #666666;
  --color-accent: #4A90D9;
  --color-border: #E8E8E6;
}
```

**AI 约束 prompt** (`src/ai/constraints/prompts.ts`):

```typescript
export const TYPESET_CONSTRAINTS = `
约束：

1. **字体**: 使用 CJK-first 字体栈，Noto Sans SC 优先，中文始终使用中文字体
2. **网格**: 所有间距/行高/字号是 8px 倍数
3. **圆角**: 卡片/按钮使用 4-8px 圆角，禁止锐利边缘
4. **色彩**: 对比度 >= 4.5，禁止纯黑 #000 / 纯白 #FFF
5. **内容**: 禁止 lorem ipsum，使用用户提供的数据
6. **结构**: 保持原文的标题层级、列表、表格、代码块

输出 JSON:
{
  "markdown": "排版后的 markdown",
  "digest": "40-80字摘要"
}
`;
```

### 文件
- 新增: `src/renderer/design-tokens.css`
- 新增: `src/ai/constraints/prompts.ts`

---

## 2. coding-agent CLI 连接（增强）

### 目标
新增可选能力：直连本地 Claude/Cursor/Gemini CLI，复用已登录会话，**零 API 成本**。

### 方案

**CLI 适配器** (`src/agents/argv.ts`)：

| Agent | 检测 binary | 调用方式 |
|-------|------------|---------|
| Claude Code | `claude` | `claude -p --output-format stream-json` |
| Cursor Agent | `cursor-agent` | `cursor-agent --print --output-format stream-json` |
| Gemini CLI | `gemini` | `gemini --output-format stream-json --yolo` |
| GitHub Copilot | `copilot` | `copilot --allow-all-tools --output-format json` |
| OpenCode | `opencode-cli` | `opencode run --format json` |
| Qwen Coder | `qwen` | `qwen --yolo -` |
| Aider | `aider` | `aider --no-pretty --no-stream --yes-always` |
| OpenAI Codex | `codex` | `codex exec --json --sandbox workspace-write` |

**PATH 扫描**：检测 GUI 进程常忽略的路径
```
~/.local/bin, ~/.bun/bin, /opt/homebrew/bin, ~/.npm-global/bin
```

**API 设计**：

```typescript
// GET /api/agents
// 扫描 PATH，返回已安装的 CLI 列表
// Response: { agents: [{ id: string, name: string, installed: boolean }] }

// POST /api/convert
// Body: { agent: string, skill: string, input: string }
// Response: SSE stream of { html: string, done: boolean }
```

**前端交互**：

| 组件 | 行为 |
|------|------|
| AI 引擎选择器 | 下拉切换：MiniMax API（默认）/ Claude CLI / Cursor Agent / Gemini CLI |
| CLI 检测 | 启动时扫描 PATH，已安装的显示"已连接"，未安装的显示"未检测到" |

**与现有 AI API 的关系**：

- **增强，非替换**：用户可选择用 API 还是本地 CLI
- **流式 vs 同步**：CLI 返回 SSE 流式，前端追加到预览区；API 保持同步返回
- **CLI 检测失败**：降级到 API，不阻塞用户

### 文件
- 新增: `src/agents/argv.ts` - CLI 适配器
- 新增: `src/server/routes/agents.ts` - CLI 检测 API
- 新增: `src/server/routes/convert.ts` - SSE 流式生成 API
- 修改: `WorkbenchPage.tsx` - 添加 AI 引擎选择器

### 价值
- **零成本**：复用用户已订阅的 CLI 会话
- **会话记忆**：CLI 保留上下文，理解文章风格
- **离线可用**：本地 CLI 不依赖第三方网络

---

## 3. 公众号粘贴适配

### 目标
提供"复制 HTML"功能，用户手动粘贴到公众号编辑器时样式不丢失。

### 方案

**`juice` CSS inline** (`src/publisher/clipboard-export.ts`)：

```typescript
import juice from 'juice';

export function copyForWechat(html: string, css: string): string {
  // 1. juice 将外部 CSS 内联到 HTML 元素 style 属性
  const inlined = juice.inlineContent(html, css);

  // 2. 添加 data-tool 标记
  return inlined.replace('<body', '<body data-tool="md2wechat"');
}
```

**与自动发布的关系**：

| 方式 | 触发 | 场景 |
|------|------|------|
| 自动发布 (`editor-publish.ts`) | 点击"发布" | Puppeteer 无人值守发布到草稿箱 |
| 复制 HTML (`clipboard-export.ts`) | 点击"复制 HTML" | 用户手动 Ctrl+V 粘贴到公众号 |

两者是**互补关系**，不是替代。用户可根据场景选择。

**导出流程**：

```
用户点击"复制 HTML"
    → clipboard-export.ts 处理
    → 写入 ClipboardItem (text/html)
    → 用户 Ctrl+V 粘贴到公众号编辑器
    → 样式完整保留
```

### 文件
- 新增: `src/publisher/clipboard-export.ts`
- 修改: UI 添加"复制 HTML"按钮

---

## 4. 沙箱预览（仅导出场景）

### 目标
导出时预览最终粘贴效果，使用 iframe sandbox 隔离。

### 方案

**SandboxPreview 组件** (`client/src/components/SandboxPreview.tsx`)：

```tsx
export function SandboxPreview({ html }: { html: string }) {
  return (
    <iframe
      sandbox="allow-scripts allow-same-origin"
      srcdoc={html}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
}
```

**使用场景**：

- **编辑时预览**：保持现有 `dangerouslySetInnerHTML`（实时反馈）
- **导出预览**：使用 SandboxPreview（真实渲染效果）

**权限控制**：

| 允许 | 禁止 |
|-----|------|
| Tailwind CDN | cookie 访问 |
| Google Fonts | localStorage 访问 |
| inline scripts | 跨域请求 |
| same-origin scripts | 父页面 DOM 访问 |

### 文件
- 新增: `client/src/components/SandboxPreview.tsx`
- 修改: 导出弹窗使用 SandboxPreview

---

## 5. AI 强制约束（仅 prompt 管理）

### 目标
约束以独立文件存在，可版本化管理，可切换模板。

### 方案

**SKILL.md 格式** (`src/skills/default/SKILL.md`)：

```markdown
---
name: 微信公众号排版
constraints:
  font_cjk: Noto Sans SC
  font_latin: Inter
  grid: 8px
  border_radius: true
  contrast_ratio: 4.5
  no_lorem_ipsum: true
---

你是一个专业的微信公众号排版助手。

约束：

1. **字体**: 使用 CJK-first 字体栈，Noto Sans SC 优先
2. **网格**: 所有间距/行高/字号是 8px 倍数
3. **圆角**: 卡片/按钮使用 4-8px 圆角
4. **色彩**: 对比度 >= 4.5，禁止纯黑/纯白
5. **内容**: 禁止 lorem ipsum，使用用户提供的数据
```

**约束引擎** (`src/ai/constraint-engine.ts`)：

```typescript
import matter from 'gray-matter';
import fs from 'fs/promises';

export async function loadSkill(skillName: string): Promise<SkillSpec> {
  const file = await fs.readFile(`src/skills/${skillName}/SKILL.md`, 'utf-8');
  const { data, content } = matter(file);
  return {
    name: data.name,
    constraints: data.constraints,
    prompt: content,
  };
}

export function buildSystemPrompt(skill: SkillSpec): string {
  // 拼接 skill prompt + constraints
  return `${skill.prompt}\n\n约束：\n${formatConstraints(skill.constraints)}`;
}
```

**约束注入流程**：

```
用户选择技能 → loadSkill(skillName)
    → buildSystemPrompt(skill)
    → 注入到 AI API / CLI 的 system prompt
```

### 文件
- 新增: `src/ai/constraint-engine.ts` - prompt 管理器
- 新增: `src/skills/default/SKILL.md` - 默认排版模板
- 修改: AI API 调用处使用 buildSystemPrompt()

---

## 实施计划

### Phase 1: 基础（1-2天）
- [ ] 设计令牌 (`design-tokens.css`)
- [ ] 约束 prompt 管理 (`prompts.ts`, `SKILL.md`)

### Phase 2: CLI 集成（2-3天）
- [ ] CLI 适配器 (`argv.ts`)
- [ ] CLI 检测 API (`/api/agents`)
- [ ] SSE 流式 API (`/api/convert`)
- [ ] 前端 AI 引擎选择器

### Phase 3: 导出与预览（1-2天）
- [ ] 复制 HTML 功能 (`clipboard-export.ts`)
- [ ] 沙箱预览组件 (`SandboxPreview.tsx`)

---

## 技术依赖

```bash
npm install juice gray-matter
```

| 依赖 | 用途 |
|------|------|
| `juice@^10.0.0` | CSS inline，公众号粘贴兼容 |
| `gray-matter@^4.0.3` | SKILL.md frontmatter 解析 |

---

## 价值总结

| 能力 | 原来 | 集成后 |
|------|------|---------|
| AI 排版成本 | 依赖 API Key | 可选零成本（用本地 CLI） |
| 粘贴成功率 | 不稳定 | juice inline 保证 |
| 预览安全 | 仅编辑时生效 | 导出时沙箱隔离 |
| AI 约束 | 内嵌代码 | 独立文件，可切换 |
| 排版风格 | 固定 | 可切换 SKILL.md 模板 |