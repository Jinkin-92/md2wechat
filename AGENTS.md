# MdPublisher (md2wechat)

MdPublisher 是一个本地运行的微信公众号 Markdown 自动排版与草稿发布工具。它提供了一条完整的主链路：Markdown/Word 上传与文章存储 → 模板渲染与预览工作台 → 发布台里的账号探针、素材映射与任务执行 → 基于浏览器自动化的公众号草稿写入、保存与复检。

## 技术栈

- **运行时**：Node.js >= 20
- **后端框架**：Express 4 + TypeScript 5（`tsconfig.json` 使用 `module: NodeNext`、`moduleResolution: NodeNext`、`target: ES2022`）
- **前端框架**：React 18 + React Router DOM 7 + Vite 7（`client/tsconfig.json` 使用 `module: ESNext`、`moduleResolution: Bundler`、`target: ES2020`、`jsx: react-jsx`）
- **浏览器自动化**：Puppeteer 24（用于登录态校验、二维码登录、草稿写入与保存）
- **Markdown 渲染**：`unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-stringify`
- **文档解析**：`mammoth`（Word → HTML）
- **数据校验**：`zod`
- **测试框架**：
  - 单元 / API 测试：`vitest` + `supertest`
  - E2E 测试：`@playwright/test`
- **开发工具**：`tsx`（后端开发热重载）、`concurrently`（前后端并行启动）

## 项目结构

```
.
├── client/                 # React + Vite 前端（npm workspace）
│   ├── src/
│   │   ├── pages/          # 页面组件（Landing / Upload / Preview / Workbench / Publish / Settings）
│   │   ├── components/     # 共享 UI 组件
│   │   ├── lib/            # 前端业务逻辑与 API 封装
│   │   ├── App.tsx         # 路由根组件
│   │   └── main.tsx        # 应用入口
│   ├── index.html
│   ├── vite.config.ts      # Vite 配置（含 /api、/data 代理到 3410）
│   └── package.json
├── src/
│   ├── server/             # Express 服务
│   │   ├── index.ts        # 服务入口（端口、CORS、静态目录、错误处理）
│   │   └── routes/         # 路由模块（health、articles、templates、publish、ai、metrics）
│   ├── renderer/           # Markdown → HTML 渲染与模板注入
│   │   ├── parser.ts       # remark 解析 Markdown
│   │   ├── templates.ts    # 模板定义与列表
│   │   └── injector.ts     # CSS 变量 / Token 注入与图片占位符替换
│   ├── publisher/          # 浏览器自动化发布流程
│   │   ├── account-state.ts    # 登录态探针与草稿入口探针
│   │   ├── draft-probe.ts      # 草稿箱可达性检测
│   │   ├── editor-publish.ts   # 在公众号编辑器中填入标题/摘要/正文/封面并保存
│   │   ├── login.ts            # 基于 Cookie 的登录
│   │   ├── qr-login.ts         # 二维码扫码登录
│   │   ├── selectors.ts        # WeChat 页面选择器常量
│   │   └── task-runner.ts      # 发布任务状态机与步骤执行
│   ├── storage/            # 文件系统持久化
│   │   ├── articles.ts     # 文章 CRUD、素材管理
│   │   └── publish.ts      # 发布账号、发布任务、Session Cookie 管理
│   ├── shared/             # 前后端共享类型与工具
│   │   ├── types.ts        # 核心 TypeScript 类型定义
│   │   └── session-cookies.ts
│   └── config/
│       └── app-config.ts   # 运行时配置（从环境变量读取）
├── tests/                  # Vitest 测试
│   ├── unit/               # 单元测试（parser、renderer）
│   ├── api/                # API 测试（health、articles、templates）
│   ├── draft-probe.test.ts
│   ├── login.test.ts
│   ├── session-cookies.test.ts
│   └── task-runner.test.ts
├── e2e/                    # Playwright E2E 测试
│   ├── landing.spec.ts
│   ├── settings.spec.ts
│   └── workbench.spec.ts
├── scripts/
│   └── playwright-login.ts # 独立脚本：通过 Playwright 完成微信扫码登录
├── data/                   # 运行时数据目录（gitignored 内容，保留目录结构）
│   ├── articles/           # 文章 JSON 文件
│   ├── uploads/            # 原始上传文件
│   ├── article-assets/     # 文章关联素材（封面、正文图片）
│   ├── sessions/           # Cookie Session 文件
│   ├── screenshots/        # Puppeteer / Playwright 截图
│   └── publish/            # 发布账号与任务 JSON
├── docs/                   # 项目文档
└── playwright.config.ts    # Playwright 配置（固定 Chromium 路径、webServer 复用已有 dev）
```

## 构建与运行命令

```bash
# 安装依赖
npm install

# 开发模式（前后端并行）
npm run dev
# 等价于同时运行：
#   npm run dev:server   -> tsx watch src/server/index.ts（端口 3410）
#   npm run dev:client   -> vite --port 5373（在 client/ 下执行）

# 仅后端开发
npm run dev:server

# 仅前端开发
npm run dev:client

# 构建（生产）
npm run build
# 等价于：
#   npm run build:server   -> tsc -p tsconfig.json（输出到 dist/）
#   npm run build:client   -> 在 client/ 下执行 tsc -b && vite build

# 启动生产服务
npm start                 # node dist/server/index.js

# 代码检查（仅前端类型检查）
npm run lint              # tsc --noEmit（client 工作区）

# 测试
npm test                  # vitest run（所有测试）
npm run test:watch        # vitest（监听模式）
npx vitest run tests/unit/ tests/api/
npx playwright test       # E2E 测试（需要 dev server 在 5373 运行）
```

### 默认端口

- 前端开发服务器：`http://localhost:5373`
- 后端 API 服务器：`http://localhost:3410`
- Vite 开发代理：`/api` 与 `/data` 自动代理到 `http://localhost:3410`

### 环境变量

参考 `.env.example`：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3410` | 后端监听端口 |
| `CORS_ORIGIN` | `http://localhost:5373` | CORS 允许的源 |
| `DATA_DIR` | `./data` | 运行时数据根目录 |
| `WECHAT_BASE_URL` | `https://mp.weixin.qq.com` | 微信公众平台地址 |
| `VITE_API_BASE_URL` | `''` | 前端直连后端时覆盖的基础 URL |

## 代码组织与模块职责

### 后端（`src/server/`）

- `index.ts`：Express 应用组装。启用 CORS、JSON 解析（limit 2mb）、`/data` 静态目录（映射到 `DATA_DIR`）、全局错误处理（SyntaxError 返回 400）。
- `routes/`：按领域拆分路由。
  - `articles`：文章列表、详情、上传（`.md` / `.txt` / `.doc` / `.docx`）、素材上传、渲染、元数据更新。
  - `templates`：模板列表查询。
  - `publish`：发布账号管理、Session 导入/清除、登录态刷新、二维码登录、发布任务创建与执行。
  - `health` / `metrics` / `ai`：健康检查、指标、AI 排版相关接口。

### 渲染器（`src/renderer/`）

- `parser.ts`：使用 `unified` + `remark-gfm` 将 Markdown 解析为 HTML。如果输入以 `<` 开头，则视为原始 HTML 直接返回。
- `templates.ts`：定义了多套视觉模板（如 `claude`、`spotify`、`nike` 等），每套模板包含完整的 CSS Token（颜色、字体、间距、圆角等）。
- `injector.ts`：将解析后的 HTML 注入模板容器，替换图片占位符（`[[MD2WECHAT_IMAGE_SLOT_X]]`）为 `<figure>` 标签，并内联模板 CSS 变量。

### 发布器（`src/publisher/`）

这是与微信公众号后台交互的核心自动化模块：

- `account-state.ts`：通过 Puppeteer 打开 `mp.weixin.qq.com`，利用本地 Cookie Session 校验登录态，并探测草稿箱入口可达性。
- `editor-publish.ts`：在公众号图文编辑器中完成以下操作：填入标题、作者、摘要、正文 HTML、插入正文图片、设置封面图、点击保存、复检富文本是否保留。
- `task-runner.ts`：发布任务的状态机。任务分为 4 个步骤：`session-check` → `draft-open` → `content-fill` → `draft-save`。每步结果持久化到 `data/publish/tasks.json`。
- `qr-login.ts`：启动二维码登录流程，轮询扫码结果，成功后保存 Cookie Session。
- `selectors.ts`：集中维护 WeChat 后台页面的 DOM 选择器常量，便于在页面改版时统一调整。

### 存储层（`src/storage/`）

所有数据以 JSON 文件形式存储在 `data/` 目录下，没有使用数据库。

- `articles.ts`：文章 CRUD、素材路径解析、图片持久化。文章对象 `ArticleRecord` 包含原始 Markdown、渲染后的 HTML、素材映射、元数据（作者、摘要、字数、原创声明）。
- `publish.ts`：发布账号（`PublishAccount`）和发布任务（`PublishTask`）的 CRUD、Session Cookie 文件读写。

**重要约定**：素材使用 `storageKey`（相对于 `DATA_DIR` 的 Unix 风格路径）和 `localPath`（绝对路径）双字段管理。API 对外暴露的素材 URL 格式为 `/data/{storageKey}`。

## 开发规范

### 模块导入

- 后端代码中使用 `node:` 前缀引入 Node.js 内置模块（如 `node:fs`、`node:path`）。
- 由于后端 `tsconfig.json` 使用 `NodeNext` 模块解析，TypeScript 源文件中的 `import` 必须带 `.js` 扩展名（如 `import { foo } from "./bar.js"`）。
- 前端代码使用常规 ES Module 导入，不带扩展名。

### 类型约定

- 共享类型定义在 `src/shared/types.ts` 中，前后端均可引用。
- 前端在 `client/src/types.ts` 中有自己的类型补充（如 `ArticleDetail` 等）。
- 运行时数据校验使用 `zod`（部分路由模块中）。

### 字符串与文案

- 项目面向中文用户，所有用户可见的文案、API 错误信息、日志输出均使用中文。
- 代码注释也以中文为主。

### 路径处理

- 所有涉及文件路径的逻辑都使用 `path` 模块，确保在 Windows 上正确运行。
- `storageKey` 在持久化前会将反斜杠替换为正斜杠（`replace(/\\\\/g, "/")`）。

## 测试策略

### 单元测试（`tests/unit/`）

- `parser.test.ts`：测试 Markdown 解析（标题、列表、表格、代码块、中文等）。
- `renderer.test.ts`：测试模板列表与 Token 字段。

### API 测试（`tests/api/`）

- 使用 `supertest` + 独立的 `express.Router()` 实例进行测试，**不启动真实服务器**。
- 覆盖 `health`、`articles`、`templates` 等路由。

### E2E 测试（`e2e/`）

- 使用 Playwright，配置文件中指定了固定的本地 Chromium 可执行路径（`C:\Users\DELL\AppData\Local\ms-playwright\chromium-1219\chrome-win64\chrome.exe`）。
- `webServer` 配置为 `reuseExistingServer: true`，执行 E2E 前需确保 `npm run dev` 已在运行，或让 Playwright 自动启动。
- 覆盖页面：Landing（首页导航）、Workbench（编辑器与预览）、Settings（设置表单）。

## 安全与注意事项

- **本地工具，无身份验证**：MdPublisher 设计为在本地单机运行，API 没有用户认证层。不要在公网直接暴露后端端口。
- **Cookie 与 Session 安全**：微信登录态以明文 JSON Cookie 文件形式存储在 `data/sessions/{accountId}.cookies.json` 中。这些文件包含敏感的会话凭证，不应提交到版本控制（已在 `.gitignore` 中排除）。
- **文件上传限制**：Multer 使用内存存储，单文件大小限制为 8MB；Express JSON 请求体限制为 2MB。
- **Puppeteer 执行环境**：发布流程依赖 Puppeteer 启动 Chromium。在 Windows 环境下，确保系统中存在可用的 Chromium/Chrome 浏览器。
- **CORS**：开发模式下 CORS 源默认为 `http://localhost:5373`，生产部署前应根据实际环境调整。

## 常见问题排查

- **前端无法连接后端**：检查 Vite 代理是否生效（`vite.config.ts` 中 `/api` 代理到 `localhost:3410`）。若前端独立部署，需设置 `VITE_API_BASE_URL`。
- **素材图片 404**：确认 `DATA_DIR` 指向正确，且后端 `express.static` 已挂载 `/data`。
- **E2E 测试找不到 Chromium**：`playwright.config.ts` 中硬编码了 Windows 本地 Chromium 路径，若环境变化需更新该路径。
- **发布任务失败**：查看 `data/screenshots/` 中的 Puppeteer 截图，以及 `data/publish/tasks.json` 中的步骤详情，定位具体失败环节。
- **修改代码后功能没有变化（最常见陷阱）**：`tsx watch` 和 `vite` 在 Windows 上经常静默失效，进程还在跑但根本不加载新代码。**修改后务必验证**：检查 `backend-dev.out.log` / `client-dev.out.log` 的最后修改时间是否晚于源文件修改时间；或直接查看进程启动时间（`Get-Process -Id <PID> | Select-Object StartTime`）。一旦怀疑热重载失效，**立即 kill 进程并手动重启前后端**，不要反复修改代码试图"修复"。已为此浪费过大量时间，必须强制执行这条验证规则。
