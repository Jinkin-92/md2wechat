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
- `injector.ts`：将解析后的 HTML 注入模板容器，**替换两种图片占位符**为 `<figure>` 标签（`data-codex-media-slot` / `data-codex-media-marker` 标注 slot），并内联模板 CSS 变量：
  - 通用占位符 `【此处插入...】`(任意中文描述,位置不限,正则 `/【此处插入[^】]+】/g`,推荐用法)
  - 编号占位符 `<p>【图片 N】</p>` 或 `<p><em>【图片 N】</em></p>`(必须整段包裹)
  - 旧版 `[[MD2WECHAT_IMAGE_SLOT_X]]` 字符串**已被本仓库移除**,本文件历史描述错误,以代码为准。

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

- 使用 Playwright，配置文件中指定了固定的本地 Chromium 可执行路径（历史硬编码为 `C:\Users\DELL\AppData\Local\ms-playwright\chromium-1219\chrome-win64\chrome.exe`,DELL 是旧用户)。当前 Jinkin 用户的 Playwright Chromium 实际位置在 `C:\Users\Jinkin\AppData\Local\ms-playwright\chromium-1223\chrome-win64\chrome.exe`,**本机使用 E2E 前需先更新 `playwright.config.ts` 的路径**。
- `webServer` 配置为 `reuseExistingServer: true`，执行 E2E 前需确保 `npm run dev` 已在运行，或让 Playwright 自动启动。
- 覆盖页面：Landing（首页导航）、Workbench（编辑器与预览）、Settings（设置表单）。

## 安全与注意事项

- **本地工具，无身份验证**：MdPublisher 设计为在本地单机运行，API 没有用户认证层。不要在公网直接暴露后端端口。
- **Cookie 与 Session 安全**：微信登录态以明文 JSON Cookie 文件形式存储在 `data/sessions/{accountId}.cookies.json` 中。这些文件包含敏感的会话凭证，不应提交到版本控制（已在 `.gitignore` 中排除）。
- **文件上传限制**：Multer 使用内存存储，单文件大小限制为 8MB；Express JSON 请求体限制为 2MB。
- **Puppeteer 执行环境**：发布流程依赖 Puppeteer 启动 Chromium。在 Windows 环境下,确保系统中存在可用的 Chromium/Chrome 浏览器。
  - **当前实现**:`src/publisher/browser-launcher.ts` 的 `puppeteer.launch({...})` **未传 `executablePath`,也未读 `.env` 里的 `CHROME_EXECUTABLE_PATH`**,自动使用 Puppeteer 自带 Chromium 缓存 `C:\Users\Jinkin\<USER>\.cache\puppeteer\chrome\win64-*/chrome-win64\chrome.exe`(已验证该 chromium 能成功访问 mp.weixin.qq.com,2026-06-15 实测 `POST /api/publish/accounts/acct_main/refresh` 返回 `loginState="authenticated"`)。
  - 验证 Puppeteer + Chromium 是否健康: 跑一次 `POST /api/publish/accounts/<id>/refresh`,看返回的 `latestLoginProbe.loginState`。
  - `.env` 里的 `CHROME_EXECUTABLE_PATH` 已被添加但**当前无效**,要真正生效需修改 `browser-launcher.ts` 读 `process.env.CHROME_EXECUTABLE_PATH` 并传入 `executablePath`。
- **CORS**：开发模式下 CORS 源默认为 `http://localhost:5373`，生产部署前应根据实际环境调整。

## 常见问题排查

- **前端无法连接后端**：检查 Vite 代理是否生效（`vite.config.ts` 中 `/api` 代理到 `localhost:3410`）。若前端独立部署，需设置 `VITE_API_BASE_URL`。
- **素材图片 404**：确认 `DATA_DIR` 指向正确，且后端 `express.static` 已挂载 `/data`。
- **E2E 测试找不到 Chromium**：`playwright.config.ts` 中硬编码了 Windows 本地 Chromium 路径，若环境变化需更新该路径。
- **发布任务失败**：查看 `data/screenshots/` 中的 Puppeteer 截图，以及 `data/publish/tasks.json` 中的步骤详情，定位具体失败环节。
- **修改代码后功能没有变化（最常见陷阱）**：`tsx watch` 和 `vite` 在 Windows 上经常静默失效，进程还在跑但根本不加载新代码。**修改后务必验证**：检查 `backend-dev.out.log` / `client-dev.out.log` 的最后修改时间是否晚于源文件修改时间；或直接查看进程启动时间（`Get-Process -Id <PID> | Select-Object StartTime`）。一旦怀疑热重载失效，**立即 kill 进程并手动重启前后端**，不要反复修改代码试图"修复"。已为此浪费过大量时间，必须强制执行这条验证规则。

## 公众号世界杯推文 workflow 经验沉淀 (WC2026)

> 该项目用 md2wechat 跑过完整的 2026 世界杯"对战球队介绍"推文流水线,以下是该流水线反复会用到的硬约束/环境怪癖,后续运营其他赛事(亚洲杯、欧冠、欧洲杯等)同样适用。

### match_id 命名规则

- 格式:`{队A缩写}_{队B缩写}_{开球日期YYYYMMDD}`
- 例:`arg_alg_20260617`(阿根廷 vs 阿尔及利亚,6/17 开球)
- **关键**:用**开球日期**,不是 URL 里的页面发布日期(原页常写 `2026/02/11` 是 SEO 假日期,真实开球在 `06-17`)
- 缩写优先用 FIFA 官方 3 字母(ARgentina→arg, ALGeria→alg),小写
- 落地路径:`D:\code\中绿康桥公众号\.wc2026-work\output\{match_id}.md`(Windows 实际路径,**不要去碰 /tmp**)

### 文章字数与"AI 补充"约定

- 中文字数 **800-1200** 是 PRD 硬约束(中文,不算空格、不算 Markdown 符号)
- 字数统计要用 PowerShell:`$content.ToCharArray() | Where-Object { $_ -match '[\u4e00-\u9fff]' } | Measure-Object`(`$content.Length` 会包含 ASCII/标点,虚高 2-3 倍)
- **AI 补充字段**必须集中放在 Markdown 文件**末尾**(在"数据来源"行之后)的 `## AI 补充说明` 段,逐条列出,以便 T3 写完成通知和人工核查
- 与原页"有据可查"字段不一致的 AI 推断,必须**显式标 ⚠️**,例如"阿尔及利亚第 5 次世界杯" vs 原页"4 次"

### 抓取 + 图片下载约定

- `wc-2026.com` 这种站无反爬,直接 `curl.exe -sS -L` 一次就 200
- 下载走代理 `-x http://127.0.0.1:7897`(本机代理端口,有时关着,失败时先 `curl -x ... https://www.google.com` 验代理活没活)
- User-Agent 加 `Mozilla/5.0` 防 403
- 必须过滤的图:
  - **博彩 logo**:`fun88-*.webp` / `m88.webp` / `manbet.webp` / `kaiyun.webp` / `betway.webp` — **绝对不入文**(违反公众号审核)
  - **国旗图**:所有 class 含 `wc-team-flag` / `wc-venue-flag` / `wc-standings-flag` / `wc-poll-flag` / `wc-poll-result-flag` 的 PNG,装饰用,丢弃
- 入文图片下载到:`.wc2026-work\downloads\{match_id}\img_{1..N}.webp`(用 .webp 保留原格式,不要二次转码,PRD 禁止二次编辑)
- 同时写 `downloads-manifest.json`,字段:slot / original_url / alt / local_path / filename / size_bytes / http_status / success / intended_use

### 已知"文档错代码对"的坑(本项目特有)

- ✅ AGENTS.md 第 154 行已修正:旧文档说图片占位符是 `[[MD2WECHAT_IMAGE_SLOT_X]]`,**代码里根本不存在**;`injector.ts` 实际只识别 `【此处插入...】`(任意中文描述)和 `<p>【图片 N】</p>`(整段包裹)两种。后续 task 不要被旧文档误导
- ✅ `acct_main.hasStoredSession=false` 字段**不可信**(cookie 校验器代码 bug);以 `latestLoginProbe.loginState="authenticated"` 为准
- ✅ `CHROME_EXECUTABLE_PATH` 已写入 `.env` 但**当前不被代码消费**(`browser-launcher.ts` 没读);Puppeteer 自动用自带 chromium,已验证可用,不要再尝试改代码让 .env 生效

### 多 agent 流水线的 T2/T3 衔接(plan 工作流经验)

- **T2(本棒)只产出 Markdown + 已下载图片 + manifest**,不碰 md2wechat API
- T3 直接读:`.wc2026-work\output\{match_id}.md` + `.wc2026-work\downloads\{match_id}\img_*.webp`
- 占位符顺序 = `mediaAssets.bodyImages[].slotId` 上传顺序,T2 在 Markdown 里**已经按文章段落顺序排好占位符**,T3 不要重排
- T2 在末尾"AI 补充说明"列出的字段,T3 写入"完成通知"时**原样粘贴**到 `⚠️ AI 补充内容(需核查)` 行
- 完整流水线报告见 `.wc2026-work\recon\REPORT.md`(已记录所有 API 端点 + 浏览器路径 + 硬约束清单)
