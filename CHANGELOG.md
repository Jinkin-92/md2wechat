# Changelog

All notable changes to MdPublisher will be documented in this file.

## [0.1.0.0] - 2026-04-20

### Added

- **Landing page** with default article preview (产业观察_算力交叉点), 6 built-in template tabs (雾蓝简报, 夜读洞察, 清新文摘, 暖阳随笔, 极简主义, 落日暖调), drag-and-drop file upload zone (.md/.txt support)
- **Workbench** with three-panel layout: left toolbar (template picker, custom options), center Markdown editor, right phone preview frame (aspect-ratio 9:16)
- **Custom options** real-time preview: font size (15/16/18px), paragraph indent, line spacing (compact/normal/relaxed), section divider, end marker, card style (flat/elevated/glass)
- **Settings page**: AI assistant toggle with model selection and API fields (GPT-4/Claude/local), smart typesetting, learning template, WeChat/Zhihu/Jianshu account management, save confirmation
- **6 template engine** with token-based CSS injection (pageBackground, headingColor, accentColor, etc.) and full markdown rendering (headings, lists, tables, code blocks, blockquotes, GFM)
- **REST API** on port 3410: articles CRUD, file upload, render endpoint, templates listing, health check, metrics
- **73-test suite**: 38 Vitest unit + API tests, 35 Playwright E2E tests covering landing, workbench, and settings flows
- **Test infrastructure** docs covering Playwright Chromium path setup, CSS opacity toggle interaction, strict mode locators, Vitest ESM module resolution
