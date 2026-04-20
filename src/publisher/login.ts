import path from "node:path";

import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";

import { getAppConfig } from "../config/app-config.js";
import { readStoredCookies, saveCookies } from "../shared/session-cookies.js";
import type { PublishAccount, PublishLoginProbe } from "../shared/types.js";

function ensureScreenshotDir(): string {
  const config = getAppConfig();
  const screenshotDir = path.join(config.dataDir, "screenshots");
  return screenshotDir;
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^\w\u4e00-\u9fa5-]/g, "_");
}

export function inferLoginState(finalUrl: string, pageTitle: string): "authenticated" | "login_required" {
  if (/\/cgi-bin\//.test(finalUrl) && !pageTitle.includes("登录")) {
    return "authenticated";
  }

  return "login_required";
}

function verifyBrowserClosed(browser: Browser): void {
  // No-op placeholder for browser cleanup verification.
  // Actual verification added in editor-publish.ts with process checks.
}

export async function ensureWechatLogin(account: PublishAccount): Promise<PublishLoginProbe> {
  const config = getAppConfig();
  const screenshotDir = ensureScreenshotDir();

  const storedCookies = readStoredCookies(account.id);
  const browser = await puppeteer.launch({
    headless: true
  });

  let browserCrashed = false;

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1440,
      height: 1080
    });

    if (storedCookies.length > 0) {
      await page.setCookie(...storedCookies);
    }

    await page.goto(config.wechatBaseUrl, {
      waitUntil: "networkidle2",
      timeout: 30000
    });

    const pageTitle = await page.title();
    const finalUrl = page.url();
    const loginState = inferLoginState(finalUrl, pageTitle);

    // Only save cookies after auth state is confirmed.
    // This prevents stale session files from login-wall pages.
    if (loginState === "authenticated") {
      const latestCookies = await page.cookies();
      if (latestCookies.length > 0) {
        saveCookies(account.id, latestCookies);
      }
    }

    const screenshotPath = path.join(
      screenshotDir,
      `${Date.now()}-${sanitizeSegment(account.name)}-wechat-entry.png`
    );
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    return {
      pageTitle,
      finalUrl,
      screenshotPath,
      loginState,
      usedStoredSession: storedCookies.length > 0
    };
  } catch (error) {
    browserCrashed = true;
    throw error;
  } finally {
    if (!browserCrashed) {
      verifyBrowserClosed(browser);
    }
    await browser.close().catch(() => undefined);
  }
}