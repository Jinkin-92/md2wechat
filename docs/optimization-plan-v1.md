# MdPublisher 优化方案 v1

> 针对 5 个反馈问题制定的实施计划

---

## 1. 移除正文中的重复标题

### 问题
`injectTemplateTokens()` 在 `renderedHtml` 中注入了一个 `<section data-codex-meta>` 块，其中包含 `<h1>` 标题。发布到微信公众号时，标题又通过 `setInputValue()` 填入编辑器的标题输入框，导致标题在正文中重复出现。

### 方案
在 `buildEditorHtml()`（`src/publisher/editor-publish.ts`）中，在将 `renderedHtml` 传给 WeChat 编辑器之前，去除 `metaBlock`：

```typescript
function buildEditorHtml(article: ArticleRecord): string {
  let html = article.renderedHtml?.trim() ?? "";
  
  // Strip the preview meta block (title/author/date) from body — these are
  // set via the WeChat editor's dedicated input fields, not inline.
  html = html.replace(/<section[^>]*data-codex-meta="true"[^>]*>[\s\S]*?<\/section>/i, "");
  
  // Also strip the footer template credit line
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/i, "");
  
  // Existing placeholder replacement logic ...
}
```

**影响面**：仅修改 `editor-publish.ts`，不涉及预览渲染逻辑。工作台预览仍可正常显示标题。

---

## 2. 移除正文中的作者/日期预览元素，并修复日期静态化

### 问题
`metaBlock` 中还包含作者名和日期（`Jinkin · 2026年5月9日`）。这些元素：
- 与 WeChat 编辑器的作者输入框重复
- 日期在 `injector.ts` 渲染时生成并固化到 `renderedHtml` 中，此后不再更新

### 方案

#### 2a. 从发布正文中移除
与 #1 共用同一个 `buildEditorHtml()` 的正则清理逻辑，整个 `<section data-codex-meta="true">` 块会被移除。

#### 2b. 修复日期生成逻辑
在 `injector.ts` 中：

**当前代码**（第 357 行）：
```typescript
const todayStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
```

**问题**：`renderedHtml` 被持久化到 `data/articles/{id}.json` 后，日期就不再变化。

**可选方案**：

| 方案 | 描述 | 推荐度 |
|---|---|---|
| A. 移除日期 | 直接从 `metaBlock` 中删除日期 `<span>` | ⭐⭐⭐ 推荐 |
| B. 服务端动态注入 | API 返回 `renderedHtml` 时，用模板字符串占位符替换为当前日期 | ⭐⭐ |
| C. 前端动态渲染 | `metaBlock` 用 `<span data-dynamic-date>`，前端 JS 替换 | ⭐ |

**推荐方案 A**：微信公众号文章的日期由平台自动标注，预览中的日期对发布没有价值，反而造成静态数据过期问题。直接在 `injector.ts` 中删除日期元素：

```typescript
// injector.ts 第 358-367 行
const metaBlock = title
  ? `<section data-codex-meta="true" style="...">
       <h1 style="...">${escapeHtml(title)}</h1>
       <div style="display:flex;...">
         ${originalChecked ? '...' : ""}
         <span>${escapeHtml(author)}</span>
         ${platformName ? `...` : ""}
         <!-- 删除日期 span -->
       </div>
     </section>`
  : "";
```

---

## 3. 使用标准/通用文档英文字体

### 问题
当前模板使用了大量非系统标准字体，这些字体在绝大多数设备（包括 WeChat 内）上不存在，导致实际效果完全依赖 fallback：

| 模板 | 问题字体 |
|---|---|
| Cohere | `'Unica77'` |
| ElevenLabs | `'Waldenburg'` |
| MiniMax | `'Outfit'`, `'Poppins'` |
| Nike | `'Bebas Neue'`, `'Helvetica Now Text'`, `'Helvetica Now Display Medium'` |
| Replicate | `'ZCOOL XiaoWei'` |
| Together AI | `'Ma Shan Zheng'` |
| Ferrari | `'FerrariSans'` |
| PlayStation | `'PlayStation SST'`, `sst` |

### 方案
将所有模板的中英文字体栈统一替换为通用文档字体。保留中文字体（`Noto Sans SC`, `PingFang SC`, `Microsoft YaHei`, `Source Han Serif SC`），但英文字体部分使用标准系统字体栈。

**推荐替换规则**：

```typescript
// 正文通用字体栈
const standardFontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'PingFang SC', 'Microsoft YaHei'";

// 标题字体栈（衬线，更正式）
const standardHeadingStack = "Georgia, 'Times New Roman', 'Songti SC', 'SimSun', serif";

// 等宽字体栈（代码）
const standardMonoStack = "'SF Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, monospace";
```

**具体模板修改**：

| 模板 | fontFamily | h1FontFamily |
|---|---|---|
| claude | `Georgia, 'Times New Roman', serif` → 保留 ✅ | 同上 |
| cohere | `'Unica77', system-ui, sans-serif` → `system-ui, -apple-system, sans-serif` | 同上 |
| elevenlabs | `Inter, system-ui, sans-serif` → 保留 ✅ | `'Waldenburg', Inter...` → `Inter, system-ui, sans-serif` |
| minimax | `'DM Sans', system-ui, sans-serif` → `system-ui, -apple-system, sans-serif` | `'Outfit', 'DM Sans'...` → `system-ui, -apple-system, sans-serif` |
| mistral-ai | `Arial, Helvetica, sans-serif` → 保留 ✅ | 同上 |
| ollama | `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif` → 保留 ✅ | 同上 |
| replicate | `'ZCOOL XiaoWei'...` → `'Noto Serif SC', 'Source Han Serif SC', Georgia, serif` | 同上 |
| together-ai | `'Ma Shan Zheng'...` → `'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif` | 同上 |
| spotify | `'Inter', Helvetica Neue...` → `Inter, -apple-system, sans-serif` | 同上 |
| ferrari | `'Inter', 'FerrariSans'...` → `Inter, -apple-system, sans-serif` | 同上 |
| playstation | `'Inter', 'PlayStation SST'...` → `Inter, Arial, Helvetica, sans-serif` | 同上 |
| nike | `'Inter', 'Helvetica Now Text'...` → `Inter, -apple-system, sans-serif` | `'Bebas Neue'...` → `Inter, -apple-system, sans-serif` |

**关键原则**：
- 英文优先使用 `Inter`, `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Arial`
- 中文优先使用 `Noto Sans SC`, `PingFang SC`, `Microsoft YaHei`
- 衬线风格（如 replicate）使用 `Georgia`, `Noto Serif SC`, `Source Han Serif SC`
- 删除所有品牌专属/非标准字体名称

---

## 4. 在工作台添加封面图与摘要编辑

### 问题
当前 Workbench 缺少两个关键字段：
- **封面图**：无法上传/编辑封面，发布时只能依赖自动检测（桌面文件或 body 图片 fallback）
- **摘要**：无法编辑摘要（digest），发布时只传递 `article.metadata.digest`，但用户无法在工作台修改它

### 方案

#### 4a. 数据类型扩展

```typescript
// src/shared/types.ts
export type ArticleRecord = {
  // ... existing fields ...
  mediaAssets: ArticleMediaAssets;
  // 新增/确认字段：
  metadata: {
    author: string;
    digest: string;        // 已有，需要在前端可编辑
    wordCount: number;
    originalChecked: boolean;
  };
};
```

`coverImage` 字段已存在于 `ArticleRecord` 中，需要在前端暴露编辑能力。

#### 4b. API 扩展

在 `src/server/routes/articles.ts` 中，确认 `updateArticleMetadata` 已支持 `digest` 字段（当前已支持）。新增封面图上传接口：

```typescript
// POST /api/articles/:id/cover
// Body: multipart/form-data with `cover` file
// Response: { coverStorageKey: string, coverLocalPath: string }
```

或者复用现有的素材上传接口，增加 `type=cover` 参数。

#### 4c. 前端 UI 改造

在 `WorkbenchPage.tsx` 的 meta row 下方新增两个编辑区域：

```tsx
{/* 摘要编辑 */}
<div className="workbench-meta-row">
  <textarea
    className="workbench-meta-textarea"
    placeholder="摘要（最多120字）"
    value={digestInput}
    onChange={(e) => {
      const val = e.target.value.slice(0, 120);
      setDigestInput(val);
      syncMetadata(titleInput, authorInput, val);
    }}
    rows={2}
  />
  <span className="workbench-char-count">{digestInput.length}/120</span>
</div>

{/* 封面图编辑 */}
<div className="workbench-cover-section">
  <div className="workbench-cover-preview">
    {coverPreviewUrl ? (
      <img src={coverPreviewUrl} alt="封面预览" />
    ) : (
      <div className="workbench-cover-empty">点击上传封面图（推荐 900×383）</div>
    )}
  </div>
  <input
    type="file"
    accept="image/*"
    onChange={handleCoverUpload}
    className="workbench-cover-input"
  />
  <button onClick={() => setShowCoverCropper(true)}>裁剪封面</button>
  <button onClick={() => void handleAiGenerateCover()}>AI 生成封面</button>
</div>
```

#### 4d. 图片裁剪组件

新建 `client/src/components/CoverCropper.tsx`：

```tsx
// 使用 react-cropper 或原生 canvas 裁剪
// 支持两种比例切换：
// - 2.35:1（~900×383）WeChat 主封面
// - 1:1（正方形）WeChat 分享封面

interface CoverCropperProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  defaultAspect: 2.35 | 1;
}
```

**依赖**：`react-cropper` + `cropperjs`（~30KB gzip），或使用原生 `<canvas>` + 鼠标事件（无额外依赖）。

**推荐**：原生 Canvas 实现，避免增加依赖。核心逻辑：

1. 用户上传图片后，在 Canvas 上绘制原图
2. 显示一个可拖拽/缩放的裁剪框（固定宽高比 2.35:1 或 1:1）
3. 确认后，用 `canvas.toBlob()` 输出裁剪后的图片
4. 上传到后端 `/api/articles/:id/cover`

#### 4e. AI 生成封面

复用现有的 `applySmartTypesetting` 接口逻辑，新增：

```typescript
// client/src/lib/api.ts
export async function generateCoverImage(params: {
  articleId: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt?: string; // 用户可覆盖
}): Promise<{ storageKey: string; localPath: string }> {
  // 调用后端 /api/ai/generate-cover
  // 后端使用 Minimax 图像生成 API（若可用）
}
```

**Fallback**：如果用户没有配置 AI Key，隐藏"AI 生成"按钮，只显示手动上传。

#### 4f. 发布流程衔接

`editor-publish.ts` 中的 `buildArticleMediaPlan()` 已经会读取 `article.mediaAssets.coverStorageKey` 和 `article.coverImage.localPath`，因此只要前端正确上传并持久化封面路径，发布流程无需额外修改。

---

## 5. 发布成功后弹窗提示手动发布

### 问题
当前发布成功后，只是在工作台底部显示一条 toast 消息 `"发布成功！文章已保存到草稿箱"`，然后关闭模态框。用户可能误以为文章已经正式发布，实际上只是保存到草稿箱。

### 方案

#### 5a. 修改 `handlePublish()` 成功后的行为

```tsx
// WorkbenchPage.tsx
async function handlePublish() {
  // ... existing logic ...
  const result = await runPublishTask(task.id);
  setPublishTask(result);
  if (result.status === "success") {
    setPublishSuccessInfo({
      visible: true,
      articleTitle: titleInput,
      accountName: selectedAccount.name,
      draftUrl: result.result?.reopenUrl ?? null
    });
    // 不再自动关闭 publishModalVisible
  }
}
```

#### 5b. 新增成功弹窗组件

```tsx
{publishSuccessInfo.visible && (
  <div className="publish-success-overlay">
    <div className="publish-success-modal">
      <div className="publish-success-icon">✓</div>
      <h3>草稿保存成功</h3>
      <p>
        文章 <strong>《{publishSuccessInfo.articleTitle}》</strong> 已保存到
        <strong>{publishSuccessInfo.accountName}</strong> 的草稿箱。
      </p>
      <div className="publish-success-note">
        <p>⚠️ 请打开微信公众平台，在「草稿箱」中手动确认并发布。</p>
      </div>
      {publishSuccessInfo.draftUrl && (
        <a
          href={publishSuccessInfo.draftUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="publish-success-link"
        >
          打开草稿编辑页
        </a>
      )}
      <button
        className="publish-success-btn"
        onClick={() => {
          setPublishSuccessInfo({ visible: false });
          setPublishModalVisible(false);
        }}
      >
        知道了
      </button>
    </div>
  </div>
)}
```

#### 5c. 样式

```css
.publish-success-modal {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  max-width: 420px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.publish-success-icon {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  font-size: 28px;
  line-height: 56px;
  margin: 0 auto 16px;
}
.publish-success-note {
  background: #fffbeb;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 12px;
  margin: 16px 0;
  color: #92400e;
  font-size: 14px;
}
```

#### 5d. 后端数据支持

`PublishTaskResult` 中已有 `reopenUrl` 字段（`editor-publish.ts` 第 860 行），前端可以直接使用。需要确保 `task-runner.ts` 将该字段传递给前端。

---

## 实施优先级

| 优先级 | 需求 | 预估工时 | 文件范围 |
|---|---|---|---|
| P0 | #1 移除正文重复标题 | 15 min | `editor-publish.ts` |
| P0 | #2 移除作者/日期 + 修复日期 | 30 min | `injector.ts`, `editor-publish.ts` |
| P1 | #5 发布成功弹窗 | 30 min | `WorkbenchPage.tsx`, `styles.css` |
| P1 | #3 标准英文字体 | 45 min | `templates.ts` |
| P2 | #4 封面图与摘要编辑 | 3-4 h | `WorkbenchPage.tsx`, `articles.ts` (API), `types.ts`, 新增 `CoverCropper.tsx` |

---

## 依赖项

- **#4 图片裁剪**：
  - 方案 A（推荐）：原生 Canvas，零依赖
  - 方案 B：`npm install react-cropper cropperjs`（若需要更丰富的裁剪交互）
- **#4 AI 生成封面**：复用现有 Minimax API 配置，无需新增依赖
- **其他需求**：无新增依赖
