import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import { getAppConfig } from "../src/config/app-config.js";
import type { PublishLoginProbe } from "../src/shared/types.js";
import {
  getPublishAccountById,
  getAccountSessionFilePath,
  saveAccountSession,
  updatePublishAccount
} from "../src/storage/publish.js";

function sanitizeSegment(input: string): string {
  return input.replace(/[^\w\u4e00-\u9fa5-]/g, "_");
}

function ensureScreenshotDir(): string {
  const config = getAppConfig();
  const screenshotDir = path.join(config.dataDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  return screenshotDir;
}

function inferLoginState(input: {
  finalUrl: string;
  pageTitle: string;
  bodyText: string;
}): "authenticated" | "login_required" {
  if (
    /\/cgi-bin\//.test(input.finalUrl) &&
    !input.pageTitle.includes("登录") &&
    !/请重新登录/.test(input.bodyText)
  ) {
    return "authenticated";
  }

  return "login_required";
}

async function readBodyText(page: { evaluate: <T>(fn: () => T) => Promise<T> }): Promise<string> {
  return page.evaluate(() => document.body?.innerText ?? "");
}

async function main(): Promise<void> {
  const accountId = process.argv[2] ?? "acct_main";
  const account = getPublishAccountById(accountId);
  if (!account) {
    throw new Error(`未找到发布账号: ${accountId}`);
  }

  const screenshotDir = ensureScreenshotDir();
  const screenshotPath = path.join(
    screenshotDir,
    `${Date.now()}-${sanitizeSegment(account.name)}-playwright-login.png`
  );
  const storageStatePath = path.join(
    path.dirname(getAccountSessionFilePath(account.id)),
    `${account.id}.storage-state.json`
  );

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome"
  });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1080
    }
  });
  const page = await context.newPage();

  console.log(`[playwright-login] 打开公众号登录页，账号=${account.name}`);
  console.log("[playwright-login] 请在浏览器里扫码并完成手机确认。");

  await page.goto(getAppConfig().wechatBaseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    const finalUrl = page.url();
    const bodyText = await readBodyText(page);
    const loginState = inferLoginState({
      finalUrl,
      pageTitle,
      bodyText
    });

    if (loginState !== "authenticated") {
      console.log(`[playwright-login] 等待扫码确认中: ${pageTitle} | ${finalUrl}`);
      continue;
    }

    const cookies = await context.cookies();
    const probe: PublishLoginProbe = {
      pageTitle,
      finalUrl,
      screenshotPath,
      loginState: "authenticated",
      usedStoredSession: false
    };

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    await context.storageState({
      path: storageStatePath
    });
    saveAccountSession(account.id, cookies);
    updatePublishAccount({
      ...account,
      status: "ready",
      lastValidatedAt: new Date().toISOString(),
      note: "Playwright 扫码登录成功，当前账号可直接进入公众号后台。",
      latestLoginProbe: probe,
      latestDraftProbe: account.latestDraftProbe ?? null
    });

    console.log(`[playwright-login] 登录成功，cookies 已写入 ${getAccountSessionFilePath(account.id)}`);
    console.log(`[playwright-login] storageState 已写入 ${storageStatePath}`);
    console.log(`[playwright-login] 登录截图已写入 ${screenshotPath}`);

    await browser.close();
    return;
  }

  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
  await browser.close();
  throw new Error(`10 分钟内未完成登录，最后截图: ${screenshotPath}`);
}

main().catch((error) => {
  console.error("[playwright-login] 失败:", error instanceof Error ? error.message : error);
  process.exit(1);
});
