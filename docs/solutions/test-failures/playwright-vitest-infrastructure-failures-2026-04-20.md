---
title: Playwright + Vitest Test Infrastructure Setup Failures
date: 2026-04-20
module: test-infrastructure
problem_type: test_failure
component: testing_framework
severity: high
symptoms:
  - "Playwright launch fails: Executable doesn't exist at chromium_headless_shell-XXXX"
  - "locator.check: element is not visible (CSS opacity:0 toggle input)"
  - "strict mode violation: getByRole('button') resolved to N elements"
  - "MODULE_NOT_FOUND when Vitest encounters inline require() for ESM module"
  - "6 Express API tests fail because router uses inline require() at request time"
  - "ReferenceError: beforeAll is not defined"
root_cause: wrong_api
resolution_type: test_fix
tags:
  - playwright
  - vitest
  - e2e-testing
  - chromium-path
  - esm-modules
  - hidden-inputs
  - strict-mode
  - react-typescript
  - express
---

# Playwright + Vitest Test Infrastructure Setup Failures

## Problem

Building a 73-test suite from scratch (Vitest unit/API + Playwright E2E) for a React/TypeScript/Express project hit 6 infrastructure failures that blocked all tests from running. None were logic bugs in the product — all were test tooling configuration or API misuse issues.

## Symptoms

Six distinct failure categories, each blocking test execution:

1. Playwright exits immediately — `Executable doesn't exist at chromium_headless_shell-1217`
2. Playwright `locator.check()` throws — `element is not visible` on settings toggle
3. Playwright `strict mode violation` — `getByRole('button', { name: '连接' })` resolved to 3 elements
4. Vitest `MODULE_NOT_FOUND` — inline `require()` inside test file for ESM module
5. 6 template API tests fail — Express router uses inline `require()` inside route handler
6. `ReferenceError: beforeAll is not defined` after adding lifecycle hook

## What Didn't Work

- Re-running `npx playwright install chromium` — installs a different version but the version mismatch persists
- Using `force: true` on the hidden checkbox — bypasses visibility check but does not trigger the visual toggle state change
- Using `.first()` to suppress strict mode violation — silently clicks the wrong button
- Wrapping inline `require()` in try/catch — masks the error, returns empty data, tests pass against wrong state
- Setting `globals: true` in `vitest.config.ts` for `beforeAll` — resolves the error but introduces implicit globals

## Solution

### 1. Playwright Chromium Path

The installed full Chromium (`chromium-1219`) differs from the headless shell the package expects. Explicitly set `executablePath` inside `launchOptions`:

```typescript
// playwright.config.ts
projects: [
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: {
        executablePath:
          "C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1219\\chrome-win64\\chrome.exe",
      },
    },
  },
],
```

Find your installed path: `ls "$LOCALAPPDATA/ms-playwright/"`

### 2. CSS Opacity-Hidden Toggle Interaction

Apple-style toggles set `opacity: 0` on the native `<input type="checkbox">`. Click the visible `.settings-toggle` label wrapper instead:

```typescript
// WRONG — targets the hidden input
const aiToggle = page.locator(".settings-toggle input[type='checkbox']").first();
await aiToggle.check(); // → element is not visible

// CORRECT — clicks the visible label
const aiToggleWrapper = page.locator(".settings-toggle").first();
await aiToggleWrapper.click();
```

### 3. Strict Mode Violation (Multiple Matches)

Scope the locator to the specific row before selecting the button:

```typescript
// WRONG — 3 "连接" buttons on the page
await page.getByRole("button", { name: "连接" }).click();

// CORRECT — narrow to the row first
const rows = page.locator(".settings-account-row");
const wechatRow = rows.filter({ hasText: "微信" });
await wechatRow.getByRole("button", { name: "连接" }).click();
```

### 4. Vitest ESM + inline require() in Test Files

Vitest runs in ESM context; `require()` is not defined. Use static import:

```typescript
// WRONG
const { listArticles } = require("../../src/storage/articles.js");

// CORRECT
import { listArticles, createArticleFromUpload } from "../../src/storage/articles.js";
```

### 5. Express Router Inline require() Breaking API Tests

Inline `require()` inside route handlers also fails when the router is loaded by Vitest:

```typescript
// WRONG — inline require inside route handler
router.get("/api/templates", (_req, res) => {
  const { listTemplates } = require("./templates"); // fails under Vitest
  res.json({ items: listTemplates() });
});

// CORRECT — static import at module top
import { listTemplates } from "./templates.js";

router.get("/api/templates", (_req, res) => {
  res.json({ items: listTemplates() });
});
```

### 6. Missing beforeAll Import

Vitest does not inject lifecycle globals by default. Import everything explicitly:

```typescript
// WRONG
import { describe, it, expect } from "vitest";
beforeAll(async () => { ... }); // → ReferenceError

// CORRECT
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
```

## Why This Works

- **Chromium path**: `executablePath` bypasses Playwright's internal version-based binary resolution entirely.
- **Toggle click**: Clicking the wrapper triggers the same browser event chain a real user produces; the opacity:0 input state updates correctly.
- **Scoped locator**: `.filter({ hasText: ... })` narrows the locator tree to a unique row before resolving the child button, satisfying strict mode's one-element requirement.
- **ESM require()**: `require()` is a CommonJS API unavailable in native ESM context. Static `import` is resolved by Vitest's ESM loader before test execution.
- **beforeAll import**: Vitest exports all test utilities as named exports; none are globals unless `globals: true` is set in config.

## Prevention

**Playwright setup:**
- Pin `@playwright/test` version and always run `npx playwright install chromium` at the exact same version so the headless shell binary matches.
- Add `"pretest:e2e": "npx playwright install chromium"` to `package.json` scripts.
- When writing E2E selectors for custom controls (toggles, radios), inspect DOM + CSS first; never assume the semantic element is actionable.
- Never suppress strict mode with `.first()` — scope to a container row/card with `.filter({ hasText: ... })` instead.

**Vitest/ESM setup:**
- Project is ESM-only (`"type": "module"` in package.json). Never use `require()` in source or test files.
- Add `@typescript-eslint/no-var-requires` lint rule to catch `require()` at write time.
- Start every new test file from this import template (delete unused):
  ```typescript
  import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
  ```
- Audit all Express router files for inline `require()` before wiring them into API tests.
