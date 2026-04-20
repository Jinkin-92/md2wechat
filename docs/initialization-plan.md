# MdPublisher 初始化方案

## 1. 当前状态

- 当前仓库仅包含产品规划文档：[MdPublisher_PR_v1.docx](/d:/code/md2wechat/MdPublisher_PR_v1.docx)
- 尚未发现代码目录、包管理文件、BMad 配置目录或项目脚手架
- 通过 `bmad-init` 检查，当前项目状态为 `core_missing`
- 这意味着如果后续要使用 BMad 系列技能，需要先补齐基础配置

## 2. PR 文档关键信息提炼

项目目标是构建一个本地运行的微信公众号 Markdown 自动排版发布工具，核心链路为：

1. 上传 `.md` 文件
2. 套用模板生成微信兼容 HTML
3. 使用 Puppeteer 自动登录公众号后台并保存到草稿箱

从 PR 文档看，v1.0 的关键能力包括：

- Markdown 上传与文章存储
- 模板系统与实时预览
- Markdown 转微信兼容 HTML 的渲染引擎
- Puppeteer 登录复用、发布执行与 SSE 状态推送
- React 前端三步式界面：上传、预览、发布

## 3. 初始化目标

初始化阶段建议只完成以下四件事：

1. 建立可运行的前后端工程骨架
2. 固化目录结构、配置文件和运行约定
3. 初始化 BMad 基础配置，便于后续用规范化流程继续开发
4. 为渲染引擎、模板系统、发布链路预留明确模块边界

## 4. 推荐工程结构

结合 PR 文档，建议采用以下目录作为第一版：

```text
md2wechat/
├── client/                  # React + Vite 前端
├── src/
│   ├── server/              # Express API
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── index.ts
│   ├── renderer/            # Markdown -> WeChat HTML
│   ├── publisher/           # Puppeteer 发布链路
│   ├── storage/             # JSON 文件存储
│   ├── shared/              # 共享类型、常量、工具
│   └── config/              # selectors、app config、env loader
├── templates/               # 9 套模板资源
├── data/                    # 运行时数据
│   ├── articles/
│   ├── sessions/
│   ├── uploads/
│   └── screenshots/
├── docs/
│   └── initialization-plan.md
├── _bmad/
│   └── core/
├── _bmad-output/
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## 5. 技术初始化建议

### 5.1 语言与运行时

- Node.js: `20 LTS`
- 包管理器: `npm`
- 后端: `TypeScript + Express 4`
- 前端: `React 18 + Vite + TypeScript`
- 自动化: `Puppeteer 21`

说明：
PR 文档写的是 Node.js + Express + React + Vite，初始化时直接统一到 TypeScript，更利于后续维护选择器、接口类型和发布状态结构。

### 5.2 第一批依赖建议

后端：

- `express`
- `multer`
- `cors`
- `zod`
- `eventsource-parser` 或直接原生 `SSE` 封装
- `unified`
- `remark-parse`
- `remark-gfm`
- `remark-rehype`
- `rehype-stringify`
- `puppeteer`

前端：

- `react`
- `react-dom`
- `vite`
- `typescript`
- `axios`
- `react-router-dom`

开发依赖：

- `tsx`
- `concurrently`
- `eslint`
- `prettier`
- `@types/node`
- `@types/express`

## 6. BMad 初始化建议值

根据 `bmad-init` 当前返回结果，项目至少需要先初始化 core 配置。建议值如下：

```yaml
core:
  user_name: "DELL"
  communication_language: "Chinese"
  document_output_language: "Chinese"
  output_folder: "_bmad-output"
```

对应解释：

- `user_name`: 建议使用你的常用名字、团队名，或者当前机器使用者标识
- `communication_language`: 当前协作语境主要是中文，建议设为 `Chinese`
- `document_output_language`: PRD、方案、任务文档都以中文输出更一致
- `output_folder`: 保持默认 `_bmad-output` 即可，便于和代码区隔离

## 7. 分阶段初始化方案

### Phase 0：仓库基础整理

- 新建 `docs/`、`data/`、`templates/`、`src/`、`client/`
- 补齐 `.gitignore`
- 约定 `data/` 为运行时目录，不纳入版本控制
- 建立 `README.md`，写明项目目标、运行方式、当前范围

产出物：

- 基础目录树
- 仓库说明文档

### Phase 1：工程脚手架

- 初始化根 `package.json`
- 配置前后端启动命令
- 增加 `dev`、`dev:server`、`dev:client`、`build`、`lint` 脚本
- 建立 Express 服务入口和 Vite 前端入口

产出物：

- 可本地启动的空白前后端应用

### Phase 2：领域模块占位

- `src/server/routes`: 预留 `articles`、`templates`、`publish`、`sessions`
- `src/renderer`: 建立 `parser`、`injector`、`wechat-sanitizer`
- `src/publisher`: 建立 `login`、`drafter`、`uploader`、`selectors`
- `src/storage`: 建立 `articles`、`sessions`、`jobs`

产出物：

- 按 PR 文档对齐的模块边界
- 后续开发不会一开始就把逻辑堆进单文件

### Phase 3：BMad 配置初始化

- 初始化 `_bmad/core/config.yaml`
- 后续若要使用 PRD、story、architecture 等 BMad 工作流，再按模块补充 `_bmad/{module}/config.yaml`
- 输出目录统一使用 `_bmad-output/`

产出物：

- BMad 可用的最小配置

### Phase 4：MVP 实施顺序

建议开发顺序如下：

1. 文件上传与文章落盘
2. Markdown 渲染为微信兼容 HTML
3. 模板系统与预览页
4. Puppeteer 登录复用
5. 发布链路与 SSE 推流
6. 多账号与封面图增强功能

## 8. 初始化验收标准

满足以下条件即可认为“初始化完成”：

- `npm install` 可成功执行
- `npm run dev` 能同时启动前后端
- 前端能打开三页基础路由占位
- 后端存在 `/api/health` 健康检查接口
- `data/`、`templates/`、`docs/`、`src/`、`client/` 目录齐备
- `_bmad/core/config.yaml` 已建立
- `README.md` 写明运行方式与项目结构

## 9. 建议的下一步动作

如果按最稳的顺序推进，下一步建议是：

1. 先完成仓库脚手架初始化
2. 再写 `README.md` 和 `.gitignore`
3. 然后补齐 `_bmad/core/config.yaml`
4. 最后开始第一批 API 和页面占位

这会让后续的产品拆解、技术设计和实现工作都更顺手。
## 10. 标准发布动作补充

为了把“排版完成后的标准发布动作”沉淀为产品能力，发布链路补充以下约定：

1. 正文图片占位按 Markdown 中 `【此处插入...】` 的出现顺序识别。
2. 本地素材采用编号约定：正文第 1、2、3... 张图片分别匹配桌面的 `1.*`、`2.*`、`3.*`。
3. 封面优先使用文章记录里的 `coverImage.localPath`；若未显式设置，则默认读取“正文占位图数量 + 1”对应的本地素材。
4. 微信编辑器执行顺序固定为：
   先写入标题、摘要、正文
   再临时上传封面素材到正文
   通过“从正文选择 -> 选择图片 -> 编辑封面 -> 确认”完成封面设置
   删除正文中的临时封面图
   最后在各个图片占位处插入正文配图
5. 发布任务结果需要显式回收：
   封面是否已应用
   成功插入了几张正文图片
   哪些占位或本地素材未匹配
   保存后复检截图路径

这套动作不是一次性的联调脚本，而是后续“素材槽位 -> 微信图文图片/封面”的默认发布协议。下一步可以继续扩展为文章级素材面板、上传前校验和可视化映射。
## 11. 发布台素材面板约定

为了支持“同一篇草稿反复修改”这一真实工作流，发布台需要把素材映射做成文章级持久化配置，而不是只依赖桌面 `1/2/3` 命名约定。

当前约定如下：
1. 每篇文章保存独立的 `mediaAssets`，包含正文图片位数组和封面图片路径。
2. 正文图片位以 Markdown 中的 `【此处插入...】` 原文作为稳定锚点，便于后续改稿时继续命中同一位置。
3. 发布执行时优先使用发布台里保存的素材路径；若某一项为空，再回退到桌面编号素材规则。
4. 这样既保留了快速试跑能力，也让正式生产流程变成可见、可改、可复用的产品能力。
