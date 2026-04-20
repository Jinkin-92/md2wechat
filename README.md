# MdPublisher

本地运行的微信公众号 Markdown 自动排版与草稿发布工具。

## 当前能力

当前仓库已经具备一条可以实际联调的主链路，包括：

- Markdown 上传与文章存储
- 模板渲染与预览工作台
- 发布台里的账号探针、素材映射与任务执行
- 基于浏览器自动化的公众号草稿写入、保存与复检

## 快速开始

```bash
npm install
npm run dev
```

默认端口：

- 前端：`http://localhost:5373`
- 后端：`http://localhost:3410`

如果你要在非代理环境下访问接口，可以在前端运行前设置：

```bash
VITE_API_BASE_URL=http://localhost:3410
```

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm start
```

## 目录结构

```text
.
├─ client/              # React + Vite 前端
├─ src/
│  ├─ server/           # Express 服务
│  ├─ renderer/         # Markdown -> HTML 渲染
│  ├─ publisher/        # 浏览器自动化发布流程
│  ├─ storage/          # 文件存储
│  ├─ shared/           # 共享类型
│  └─ config/           # 运行配置
├─ templates/           # 模板资源
├─ data/                # 运行时数据
├─ docs/                # 项目文档
└─ _bmad/               # BMad 配置
```

## 当前推进重点

1. 继续把上传、预览、发布三段工作台做扎实。
2. 收口剩余乱码文案与界面粗糙点。
3. 提升任务结果可视化、失败诊断和复检体验。
4. 继续完善真实公众号草稿编辑与回改能力。
