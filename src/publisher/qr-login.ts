import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Browser, Page } from "puppeteer";

import { launchBrowser } from "./browser-launcher.js";

import { getAppConfig } from "../config/app-config.js";
import { updatePublishAccount, saveAccountSession } from "../storage/publish.js";
import type { PublishAccount, PublishLoginProbe } from "../shared/types.js";

type QrLoginSessionRecord = {
  id: string;
  accountId: string;
  browser: Browser;
  page: Page;
  screenshotPath: string;
  createdAt: string;
  updatedAt: string;
};

type QrLoginCheckResult = {
  sessionId: string;
  accountId: string;
  status: "pending" | "authenticated" | "expired";
  screenshotPath: string;
  storageKey: string;
  pageTitle: string;
  finalUrl: string;
  sessionFilePath: string | null;
};

const sessionStore = new Map<string, QrLoginSessionRecord>();
const accountSessionIndex = new Map<string, string>();

function ensureScreenshotDir(): string {
  const config = getAppConfig();
  const screenshotDir = path.join(config.dataDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  return screenshotDir;
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^\w\u4e00-\u9fa5-]/g, "_");
}

function inferLoginState(finalUrl: string, pageTitle: string): "authenticated" | "login_required" {
  if (/\/cgi-bin\//.test(finalUrl) && !pageTitle.includes("登录")) {
    return "authenticated";
  }

  return "login_required";
}

async function persistProbe(account: PublishAccount, probe: PublishLoginProbe): Promise<PublishAccount> {
  return updatePublishAccount({
    ...account,
    status: probe.loginState === "authenticated" ? "ready" : "expired",
    lastValidatedAt: new Date().toISOString(),
    latestLoginProbe: probe,
    latestDraftProbe: account.latestDraftProbe ?? null,
    note:
      probe.loginState === "authenticated"
        ? "扫码登录成功，当前账号已可进入公众号后台。"
        : "二维码会话仍未完成登录，请继续扫码或刷新二维码。"
  });
}

async function cleanupSession(sessionId: string): Promise<void> {
  const record = sessionStore.get(sessionId);
  if (!record) {
    return;
  }

  sessionStore.delete(sessionId);
  if (accountSessionIndex.get(record.accountId) === sessionId) {
    accountSessionIndex.delete(record.accountId);
  }

  await record.browser.close().catch(() => undefined);
}

export async function startWechatQrLogin(account: PublishAccount): Promise<{
  sessionId: string;
  screenshotPath: string;
  storageKey: string;
  pageTitle: string;
  finalUrl: string;
}> {
  const previousSessionId = accountSessionIndex.get(account.id);
  if (previousSessionId) {
    await cleanupSession(previousSessionId);
  }

  const config = getAppConfig();
  const screenshotDir = ensureScreenshotDir();
  const screenshotPath = path.join(
    screenshotDir,
    `${Date.now()}-${sanitizeSegment(account.name)}-wechat-qr.png`
  );
  const storageKey = path.relative(config.dataDir, screenshotPath).replace(/\\/g, "/");

  const browser = await launchBrowser();

  const page = await browser.newPage();
  await page.setViewport({
    width: 1440,
    height: 1080
  });

  await page.goto(getAppConfig().wechatBaseUrl, {
    waitUntil: "networkidle2",
    timeout: 30000
  });

  // Wait for the QR code image to be rendered before taking screenshot
  const qrElement = await page
    .waitForSelector(".login__type__container__scan__qrcode", {
      visible: true,
      timeout: 15000
    })
    .catch(() => null);

  if (qrElement) {
    const box = await qrElement.boundingBox();
    if (box) {
      // Capture the QR code with some padding to include surrounding hint text
      await page.screenshot({
        path: screenshotPath,
        clip: {
          x: Math.max(0, Math.round(box.x - 40)),
          y: Math.max(0, Math.round(box.y - 80)),
          width: Math.round(box.width + 80),
          height: Math.round(box.height + 160)
        }
      });
    } else {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
  } else {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  const sessionId = `qr_${randomUUID()}`;
  const record: QrLoginSessionRecord = {
    id: sessionId,
    accountId: account.id,
    browser,
    page,
    screenshotPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  sessionStore.set(sessionId, record);
  accountSessionIndex.set(account.id, sessionId);

  return {
    sessionId,
    screenshotPath,
    storageKey,
    pageTitle: await page.title(),
    finalUrl: page.url()
  };
}

export async function checkWechatQrLogin(account: PublishAccount, sessionId: string): Promise<QrLoginCheckResult> {
  const record = sessionStore.get(sessionId);
  if (!record || record.accountId !== account.id) {
    return {
      sessionId,
      accountId: account.id,
      status: "expired",
      screenshotPath: "",
      storageKey: "",
      pageTitle: "",
      finalUrl: "",
      sessionFilePath: null
    };
  }

  if (record.page.isClosed() || !record.browser.connected) {
    await cleanupSession(sessionId);
    return {
      sessionId,
      accountId: account.id,
      status: "expired",
      screenshotPath: record.screenshotPath,
      storageKey: path.relative(getAppConfig().dataDir, record.screenshotPath).replace(/\\/g, "/"),
      pageTitle: "",
      finalUrl: "",
      sessionFilePath: null
    };
  }

  // Refresh the screenshot; prefer precise QR element capture if available
  const qrElement = await record.page
    .$(".login__type__container__scan__qrcode")
    .catch(() => null);

  if (qrElement) {
    const box = await qrElement.boundingBox();
    if (box) {
      await record.page.screenshot({
        path: record.screenshotPath,
        clip: {
          x: Math.max(0, Math.round(box.x - 40)),
          y: Math.max(0, Math.round(box.y - 80)),
          width: Math.round(box.width + 80),
          height: Math.round(box.height + 160)
        }
      });
    } else {
      await record.page.screenshot({ path: record.screenshotPath, fullPage: true });
    }
  } else {
    await record.page.screenshot({ path: record.screenshotPath, fullPage: true });
  }
  record.updatedAt = new Date().toISOString();

  const pageTitle = await record.page.title();
  const finalUrl = record.page.url();
  const loginState = inferLoginState(finalUrl, pageTitle);

  if (loginState !== "authenticated") {
    await persistProbe(account, {
      pageTitle,
      finalUrl,
      screenshotPath: record.screenshotPath,
      loginState,
      usedStoredSession: false
    });

    return {
      sessionId,
      accountId: account.id,
      status: "pending",
      screenshotPath: record.screenshotPath,
      storageKey: path.relative(getAppConfig().dataDir, record.screenshotPath).replace(/\\/g, "/"),
      pageTitle,
      finalUrl,
      sessionFilePath: null
    };
  }

  const cookies = await record.page.cookies();
  const sessionFilePath = saveAccountSession(account.id, cookies);
  await persistProbe(account, {
    pageTitle,
    finalUrl,
    screenshotPath: record.screenshotPath,
    loginState: "authenticated",
    usedStoredSession: false
  });
  await cleanupSession(sessionId);

  return {
    sessionId,
    accountId: account.id,
    status: "authenticated",
    screenshotPath: record.screenshotPath,
    storageKey: path.relative(getAppConfig().dataDir, record.screenshotPath).replace(/\\/g, "/"),
    pageTitle,
    finalUrl,
    sessionFilePath
  };
}

export async function cancelWechatQrLogin(accountId: string, sessionId: string): Promise<boolean> {
  const record = sessionStore.get(sessionId);
  if (!record || record.accountId !== accountId) {
    return false;
  }

  await cleanupSession(sessionId);
  return true;
}
