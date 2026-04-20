import fs from "node:fs";
import path from "node:path";

import puppeteer from "puppeteer";
import type { Page } from "puppeteer";

import { getAppConfig } from "../config/app-config.js";
import { readStoredCookies, saveCookies } from "../shared/session-cookies.js";
import { WECHAT_SELECTORS } from "./selectors.js";
import type { PublishAccount, PublishDraftProbe } from "../shared/types.js";

function ensureScreenshotDir(): string {
  const config = getAppConfig();
  const screenshotDir = path.join(config.dataDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  return screenshotDir;
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^\w\u4e00-\u9fa5-]/g, "_");
}

function getDraftProbeUrl(account: PublishAccount): string {
  const latestUrl = account.latestLoginProbe?.finalUrl ?? "";
  if (/\/cgi-bin\//.test(latestUrl) && /token=/.test(latestUrl)) {
    return latestUrl;
  }

  return "https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN";
}

export function resolveWechatHref(currentUrl: string, href: string): string {
  const resolved = new URL(href, currentUrl);
  const current = new URL(currentUrl);

  if (current.searchParams.has("token") && !resolved.searchParams.has("token")) {
    resolved.searchParams.set("token", current.searchParams.get("token")!);
  }

  if (current.searchParams.has("lang") && !resolved.searchParams.has("lang")) {
    resolved.searchParams.set("lang", current.searchParams.get("lang")!);
  }

  return resolved.toString();
}

export function buildDraftEditUrl(currentUrl: string, appmsgId: string): string {
  const current = new URL(currentUrl);
  const token = current.searchParams.get("token");
  const lang = current.searchParams.get("lang") ?? "zh_CN";

  if (!token) {
    throw new Error("Current URL does not contain token.");
  }

  const reopened = new URL("https://mp.weixin.qq.com/cgi-bin/appmsg");
  reopened.searchParams.set("t", "media/appmsg_edit");
  reopened.searchParams.set("action", "edit");
  reopened.searchParams.set("type", "77");
  reopened.searchParams.set("appmsgid", appmsgId);
  reopened.searchParams.set("token", token);
  reopened.searchParams.set("lang", lang);
  return reopened.toString();
}

async function gotoHrefIfPresent(page: Page, selector: string): Promise<void> {
  const currentUrl = page.url();
  const href = await page
    .$eval(selector, (node) => (node instanceof HTMLAnchorElement ? node.href : ""))
    .catch(() => "");

  if (href && href !== currentUrl) {
    await page.goto(resolveWechatHref(currentUrl, href), {
      waitUntil: "networkidle2",
      timeout: 15000
    });
    return;
  }

  await Promise.allSettled([
    page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout: 10000
    }),
    page.click(selector)
  ]);
}

async function findFirstSelector(page: Page, candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const element = await page.$(candidate);
    if (element) {
      return candidate;
    }
  }

  return null;
}

async function clickDraftEntryAndDetectEditor(
  page: Page,
  selector: string,
  articleTitle?: string | null
): Promise<{
  editorReachable: boolean;
  editorUrl: string | null;
  matchedTitleSelector: string | null;
}> {
  const beforeUrl = page.url();

  await gotoHrefIfPresent(page, selector);
  await page
    .waitForNetworkIdle({
      idleTime: 800,
      timeout: 10000
    })
    .catch(() => undefined);

  if (articleTitle) {
    const reusedByTitle = await openExistingDraftByTitle(page, articleTitle);
    if (reusedByTitle.editorReachable) {
      return reusedByTitle;
    }
  }

  const writeNewSelector = await findFirstSelector(page, WECHAT_SELECTORS.writeNewArticleCandidates);
  if (writeNewSelector) {
    await gotoHrefIfPresent(page, writeNewSelector);
    await page
      .waitForNetworkIdle({
        idleTime: 800,
        timeout: 10000
      })
      .catch(() => undefined);
  }

  const matchedTitleSelector = await findFirstSelector(page, WECHAT_SELECTORS.titleInputCandidates);
  const editorUrl = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText ?? "");
  const editorReachable =
    editorUrl !== beforeUrl &&
    (/appmsg/i.test(editorUrl) || Boolean(matchedTitleSelector)) &&
    !bodyText.includes("请重新登录");

  return {
    editorReachable,
    editorUrl: editorReachable ? editorUrl : null,
    matchedTitleSelector
  };
}

async function openExistingDraftByTitle(
  page: Page,
  articleTitle: string
): Promise<{
  editorReachable: boolean;
  editorUrl: string | null;
  matchedTitleSelector: string | null;
}> {
  const clicked = await page.evaluate((title) => {
    const normalizedTitle = title.trim();
    const cards = [...document.querySelectorAll(".publish_card_container, .weui-desktop-card")];
    for (const card of cards) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }
      const text = card.innerText?.replace(/\s+/g, " ").trim() ?? "";
      if (!text || (!text.includes(normalizedTitle) && normalizedTitle !== text)) {
        continue;
      }

      const titleLink =
        card.querySelector(".weui-desktop-publish__cover__title") ??
        card.querySelector("a");
      if (titleLink instanceof HTMLElement) {
        titleLink.click();
        return true;
      }

      card.click();
      return true;
    }
    return false;
  }, articleTitle);

  if (!clicked) {
    return {
      editorReachable: false,
      editorUrl: null,
      matchedTitleSelector: null
    };
  }

  await page
    .waitForNetworkIdle({
      idleTime: 800,
      timeout: 10000
    })
    .catch(() => undefined);

  const matchedTitleSelector = await findFirstSelector(page, WECHAT_SELECTORS.titleInputCandidates);
  const bodyText = await page.evaluate(() => document.body.innerText ?? "");
  const editorReachable =
    Boolean(matchedTitleSelector) &&
    /appmsg/i.test(page.url()) &&
    !bodyText.includes("请重新登录");

  return {
    editorReachable,
    editorUrl: editorReachable ? page.url() : null,
    matchedTitleSelector
  };
}

async function openExistingDraftIfPossible(
  page: Page,
  appmsgId: string
): Promise<{
  editorReachable: boolean;
  editorUrl: string | null;
  matchedTitleSelector: string | null;
}> {
  await page.goto(buildDraftEditUrl(page.url(), appmsgId), {
    waitUntil: "networkidle2",
    timeout: 30000
  });

  const matchedTitleSelector = await findFirstSelector(page, WECHAT_SELECTORS.titleInputCandidates);
  const bodyText = await page.evaluate(() => document.body.innerText ?? "");
  const editorReachable =
    Boolean(matchedTitleSelector) &&
    /appmsg/i.test(page.url()) &&
    !bodyText.includes("请重新登录");

  return {
    editorReachable,
    editorUrl: editorReachable ? page.url() : null,
    matchedTitleSelector
  };
}

export async function probeWechatDraftEntry(
  account: PublishAccount,
  options?: {
    draftAppmsgId?: string | null;
    articleTitle?: string | null;
  }
): Promise<PublishDraftProbe> {
  const screenshotDir = ensureScreenshotDir();
  const screenshotPath = path.join(
    screenshotDir,
    `${Date.now()}-${sanitizeSegment(account.name)}-wechat-home.png`
  );
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

    await page.goto(getDraftProbeUrl(account), {
      waitUntil: "networkidle2",
      timeout: 30000
    });

    // Determine backend reachability before saving cookies.
    const pageTitle = await page.title();
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText ?? "");
    const backendReachable =
      /\/cgi-bin\//.test(finalUrl) &&
      !pageTitle.includes("登录") &&
      !pageTitle.includes("公众号平台") &&
      !bodyText.includes("请重新登录");

    // Only save cookies after confirming backend is reachable.
    // This prevents stale session files from login-wall pages.
    if (backendReachable) {
      const latestCookies = await page.cookies();
      if (latestCookies.length > 0) {
        saveCookies(account.id, latestCookies);
      }
    }

    let editorReachable = false;
    let editorUrl: string | null = null;
    let matchedTitleSelector: string | null = null;
    let matchedSelector: string | null = null;

    if (options?.draftAppmsgId) {
      const reusedEditor = await openExistingDraftIfPossible(page, options.draftAppmsgId).catch(
        () => null
      );
      if (reusedEditor) {
        editorReachable = reusedEditor.editorReachable;
        editorUrl = reusedEditor.editorUrl;
        matchedTitleSelector = reusedEditor.matchedTitleSelector;
        matchedSelector = `existing-draft:${options.draftAppmsgId}`;
      }
    }

    if (!editorReachable) {
      matchedSelector = await findFirstSelector(page, WECHAT_SELECTORS.createDraftEntryCandidates);
    }

    if (!editorReachable && matchedSelector) {
      const editorResult = await clickDraftEntryAndDetectEditor(
        page,
        matchedSelector,
        options?.articleTitle
      );
      editorReachable = editorResult.editorReachable;
      editorUrl = editorResult.editorUrl;
      matchedTitleSelector = editorResult.matchedTitleSelector;
    }

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    return {
      pageTitle,
      finalUrl,
      screenshotPath,
      backendReachable,
      usedStoredSession: storedCookies.length > 0,
      draftEntryDetected: Boolean(matchedSelector),
      matchedSelector,
      editorReachable,
      editorUrl,
      matchedTitleSelector
    };
  } catch (error) {
    browserCrashed = true;
    throw error;
  } finally {
    if (!browserCrashed) {
      // Verify browser process cleanup
      await browser.close().catch(() => undefined);
    }
  }
}