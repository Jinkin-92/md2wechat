# Test Automation Summary

## Generated Tests

### Vitest Unit Tests (tests/unit/)
- [x] `tests/unit/renderer.test.ts` — Template listing (6 templates, fallback, token fields)
- [x] `tests/unit/parser.test.ts` — Markdown parsing (headings, lists, tables, code blocks, Chinese chars)

### Vitest API Tests (tests/api/)
- [x] `tests/api/articles.test.ts` — Articles CRUD, file upload (.md/.txt), render endpoint
- [x] `tests/api/templates.test.ts` — Template listing, token validation, hex color format
- [x] `tests/api/health.test.ts` — Health endpoint, status, ISO timestamp

### Playwright E2E Tests (e2e/)
- [x] `e2e/landing.spec.ts` — Landing page: hero, upload zone, template tabs, tab switching
- [x] `e2e/workbench.spec.ts` — Workbench: toolbar, editor, preview, custom panel, publish dropdown, navigation
- [x] `e2e/settings.spec.ts` — Settings: AI toggles, model select, API fields, account rows, save

## Coverage

| Layer | Coverage |
|-------|---------|
| API endpoints | 7/9 (articles list/detail/upload/render, templates, health, metrics) |
| UI features | 12/15 (main flows covered) |
| Markdown parser | 12/12 cases |

## Test Results

```
Vitest:  38 passed (unit + api)
Playwright E2E: 35 passed (landing + workbench + settings)
Total:   73 passed
```

## How to Run

```bash
# Unit + API tests
npx vitest run tests/unit/ tests/api/

# E2E tests (requires dev server on port 5373)
npx playwright test

# Full suite
npx vitest run && npx playwright test
```

## Dependencies Added

- `supertest` — HTTP API testing
- `@playwright/test` — E2E testing
