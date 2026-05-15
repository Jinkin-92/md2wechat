import fs from "node:fs";
import path from "node:path";

import type { Browser, Page } from "puppeteer";

import { launchBrowser } from "./browser-launcher.js";

import { getAppConfig } from "../config/app-config.js";
import type { ArticleRecord } from "../shared/types.js";
import { getStoredAssetAbsolutePath } from "../storage/articles.js";
import { readStoredCookies, saveCookies } from "../shared/session-cookies.js";
import { WECHAT_SELECTORS } from "./selectors.js";

type DraftPublishStage = "content-fill" | "draft-save";

type BodyImageSlot = {
  id: string;
  label: string;
  markerToken: string;
  filePath: string;
};

type ArticleMediaPlan = {
  coverImagePath: string | null;
  bodySlots: BodyImageSlot[];
  missingBodyImagePaths: string[];
};

export type DraftPublishResult = {
  stage: DraftPublishStage;
  titleSelector: string | null;
  authorSelector: string | null;
  digestSelector: string | null;
  bodySelector: string | null;
  saveSelector: string | null;
  screenshotPath: string;
  finalUrl: string;
  saveSuccessText: string | null;
  reopenScreenshotPath: string | null;
  reopenUrl: string | null;
  reopenRichTextPreserved: boolean;
  coverImageApplied: boolean;
  insertedBodyImagePaths: string[];
  missingBodyImagePaths: string[];
  coverImagePath: string | null;
  detail: string;
};

function ensureScreenshotDir(): string {
  const config = getAppConfig();
  const screenshotDir = path.join(config.dataDir, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  return screenshotDir;
}

function sanitizeSegment(input: string): string {
  return input.replace(/[^\w\u4e00-\u9fa5-]/g, "_");
}

function stripPreviewMetaFromBody(html: string): string {
  // Remove the preview meta block (title/author/date) — these are set via
  // WeChat editor's dedicated input fields, not inline in the body.
  let cleaned = html.replace(/<section[^>]*data-codex-meta="true"[^>]*>[\s\S]*?<\/section>/gi, "");
  // Remove the template footer credit line
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  return cleaned;
}

function buildEditorHtml(article: ArticleRecord): string {
  if (article.renderedHtml?.trim()) {
    let cleanedHtml = stripPreviewMetaFromBody(article.renderedHtml.trim());
    return article.mediaAssets.bodyImages.reduce((currentHtml, slot) => {
      const figurePattern = new RegExp(
        `<figure[^>]*data-codex-media-slot="${slot.id}"[^>]*>[\\s\\S]*?<\\/figure>`,
        "g"
      );
      return currentHtml.replace(
        figurePattern,
        `<p data-codex-slot-marker="${slot.id}">${slot.markerToken}</p>`
      );
    }, cleanedHtml);
  }

  return article.rawMarkdown
    .split(/\r?\n\r?\n/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => `<p>${segment.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function isRichTextStructurePreserved(html: string): boolean {
  return /<h1|<h2|<blockquote|<table|style=|border-left:/i.test(html);
}

function buildDraftEditUrl(pageUrl: string): string | null {
  const current = new URL(pageUrl);
  const appmsgId = current.searchParams.get("appmsgid");
  const token = current.searchParams.get("token");
  const lang = current.searchParams.get("lang") ?? "zh_CN";

  if (!appmsgId || !token) {
    return null;
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

function fileExists(filePath: string | null | undefined): filePath is string {
  return Boolean(filePath && fs.existsSync(filePath));
}

function resolveDesktopImagePath(basename: string): string | null {
  const desktopDir = path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Desktop");
  const candidates = [".png", ".jpg", ".jpeg", ".webp", ".gif"].map((extension) =>
    path.join(desktopDir, `${basename}${extension}`)
  );

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function buildArticleMediaPlan(article: ArticleRecord): ArticleMediaPlan {
  const bodySlots: BodyImageSlot[] = [];
  const missingBodyImagePaths: string[] = [];

  article.mediaAssets.bodyImages.forEach((slot, index) => {
    const storedPath = fileExists(getStoredAssetAbsolutePath(slot.storageKey))
      ? getStoredAssetAbsolutePath(slot.storageKey)
      : null;
    const filePath =
      storedPath ??
      (fileExists(slot.localPath) ? slot.localPath : null) ??
      resolveDesktopImagePath(String(index + 1));
    if (!filePath) {
      missingBodyImagePaths.push(slot.label || slot.placeholder);
      return;
    }

    bodySlots.push({
      id: slot.id,
      label: slot.label,
      markerToken: slot.markerToken,
      filePath,
    });
  });

  const configuredCoverPath = fileExists(getStoredAssetAbsolutePath(article.mediaAssets.coverStorageKey))
    ? getStoredAssetAbsolutePath(article.mediaAssets.coverStorageKey)
    : fileExists(article.mediaAssets.coverLocalPath)
      ? article.mediaAssets.coverLocalPath
    : null;
  const explicitCoverPath = fileExists(article.coverImage.localPath) ? article.coverImage.localPath : null;
  const fallbackCoverPath = resolveDesktopImagePath(String(article.mediaAssets.bodyImages.length + 1));

  return {
    coverImagePath: configuredCoverPath ?? explicitCoverPath ?? fallbackCoverPath,
    bodySlots,
    missingBodyImagePaths
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFirstSelector(page: Page, candidates: readonly string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const visible = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)];
      // Return the first element that has a non-zero bounding rect
      return els.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ? sel : null;
    }, candidate);
    if (visible) return candidate;
  }
  // Fallback to first found element even if not visibly rendered
  for (const candidate of candidates) {
    const element = await page.$(candidate);
    if (element) return candidate;
  }
  return null;
}

async function setInputValue(page: Page, selector: string, value: string): Promise<void> {
  // Wait for element to be visible (non-zero bounding rect)
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
    { timeout: 20000 },
    selector
  ).catch(() => null);

  // Verify we're reading the right element - check rect and text
  const allMatches = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el, i) => {
      const rect = el.getBoundingClientRect();
      const isInput = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
      return {
        index: i,
        tagName: (el as HTMLElement).tagName,
        id: (el as HTMLElement).id,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        value: isInput ? (el as HTMLInputElement).value.substring(0, 30) : (el as HTMLElement).innerText.substring(0, 30)
      };
    });
  }, selector);
  console.error("[setInputValue] ALL matching elements:", JSON.stringify(allMatches));
  console.error("[setInputValue] input value length:", value.length, "first 50 chars:", value.substring(0, 50));

  await sleep(300);

  // Check if target is contenteditable (e.g. WeChat's ProseMirror title editor)
  const isContentEditable = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el instanceof HTMLElement && el.getAttribute("contenteditable") === "true";
  }, selector);

  if (isContentEditable) {
    // For ProseMirror / contenteditable editors, set innerText directly and dispatch events.
    // This is more reliable than keyboard typing because the hidden form field
    // is synchronised by the editor's internal state management.
    await page.evaluate((sel, text) => {
      const node = document.querySelector(sel);
      if (!(node instanceof HTMLElement)) {
        throw new Error("Target is not an HTMLElement.");
      }
      node.focus();
      node.innerText = text;
      node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.blur();
    }, selector, value);
    return;
  }

  // Use keyboard typing to ensure React synthetic event system properly captures input
  await page.focus(selector);
  await sleep(100);

  // Select all existing content first
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await sleep(100);

  // Type character by character to trigger React input events properly
  await page.keyboard.type(value, { delay: 5 });
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement) {
      el.blur();
    }
  }, selector);
}

async function fillBodyHtml(page: Page, selector: string, html: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.$eval(
    selector,
    (node, nextHtml) => {
      if (!(node instanceof HTMLElement)) {
        throw new Error("Editor node is not an HTMLElement.");
      }
      node.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      let inserted = false;
      try {
        inserted =
          document.execCommand("selectAll", false) &&
          document.execCommand("insertHTML", false, nextHtml);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        node.innerHTML = nextHtml;
      }
      node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      node.blur();
    },
    html
  );
}

async function pasteBodyHtml(page: Page, selector: string, html: string, plainText: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });

  // First, use execCommand insertHTML which bypasses React event system
  // but properly writes to the ProseMirror DOM
  const success = await page.evaluate((sel, htmlContent) => {
    const node = document.querySelector(sel);
    if (!(node instanceof HTMLElement)) {
      return { ok: false, error: "not an HTMLElement" };
    }
    node.focus();

    // Select all content
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Try insertHTML first (works for many editors)
    let inserted = false;
    try {
      document.execCommand("selectAll", false);
      inserted = document.execCommand("insertHTML", false, htmlContent);
    } catch (e) {
      // Fallback
    }

    if (!inserted) {
      // Direct innerHTML set as fallback
      node.innerHTML = htmlContent;
    }

    // Dispatch proper input events
    node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    node.blur();
    return { ok: true, innerHTMLLen: node.innerHTML.length };
  }, selector, html);

  console.error("[pasteBodyHtml] result:", JSON.stringify(success));
  if (!success.ok) {
    throw new Error("Failed to paste body HTML: " + success.error);
  }

  // Verify content was actually written
  const afterLen = await page.$eval(selector, (node) =>
    node instanceof HTMLElement ? node.innerHTML.length : 0
  );
  console.error("[pasteBodyHtml] innerHTML length after paste:", afterLen);
}

async function resetBodyContent(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.$eval(selector, (node) => {
    if (!(node instanceof HTMLElement)) {
      throw new Error("Editor node is not an HTMLElement.");
    }
    node.innerHTML = "<p><span leaf=''><br class='ProseMirror-trailingBreak'></span></p>";
    node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContent" }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function moveCaretToEditorEnd(page: Page, selector: string): Promise<void> {
  await page.$eval(selector, (node) => {
    if (!(node instanceof HTMLElement)) {
      throw new Error("Editor node is not an HTMLElement.");
    }
    node.focus();
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function moveUploadedImageToAnchor(
  page: Page,
  editorSelector: string,
  imageIdentifier: string | null,
  markerToken: string
): Promise<boolean> {
  return page.$eval(
    editorSelector,
    (node, payload) => {
      if (!(node instanceof HTMLElement)) {
        throw new Error("Editor node is not an HTMLElement.");
      }

      const normalizeText = (value: string) => value.replace(/[\s\u00a0]+/g, "");
      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const placeholderPattern = new RegExp(
        escapeRegExp(payload.markerToken).replace(/\\ /g, "[\\s\\u00a0]*")
      );
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode: Text | null = null;
      while (walker.nextNode()) {
        const current = walker.currentNode;
        if (
          current instanceof Text &&
          current.textContent &&
          normalizeText(current.textContent).includes(normalizeText(payload.markerToken))
        ) {
          textNode = current;
          break;
        }
      }
      if (!textNode) {
        return false;
      }
      const anchor =
        textNode.parentElement?.closest("p, section, blockquote, li, div") ?? textNode.parentElement ?? node;
      if (!(anchor instanceof HTMLElement)) {
        return false;
      }

      const image = [...node.querySelectorAll("img.js_insertlocalimg")].find((candidate) => {
        const fileId = candidate.getAttribute("data-imgfileid");
        const src = candidate.getAttribute("src");
        return fileId === payload.imageIdentifier || src === payload.imageIdentifier;
      });
      if (!(image instanceof HTMLElement)) {
        return false;
      }

      const imageBlock = image.closest("figure, section, p, div") ?? image;
      const replacement = document.createElement("p");
      replacement.style.textAlign = "center";
      replacement.innerHTML = image.outerHTML;

      textNode.textContent = textNode.textContent?.replace(placeholderPattern, "").trim() ?? "";
      anchor.replaceWith(replacement);
      if (imageBlock instanceof HTMLElement) {
        imageBlock.remove();
      }
      node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { imageIdentifier, markerToken }
  );
}

async function waitForBodyImageCount(page: Page, editorSelector: string, expectedCount: number): Promise<void> {
  await page.waitForFunction(
    (selector: string, count: number) => {
      const editor = document.querySelector(selector);
      if (!(editor instanceof HTMLElement)) {
        return false;
      }
      return editor.querySelectorAll("img.js_insertlocalimg").length >= count;
    },
    { timeout: 30000 },
    editorSelector,
    expectedCount
  );
}

async function uploadImageIntoBody(page: Page, editorSelector: string, filePath: string): Promise<string | null> {
  let uploadInput =
    (await page.$(WECHAT_SELECTORS.bodyImageUploadInput)) ??
    (await page.$("input[type='file'][name='file']"));
  if (!uploadInput) {
    await page.waitForFunction(
      () => Boolean(document.querySelector("#js_editor_insertimage input[type='file'], input[type='file'][name='file']")),
      { timeout: 20000 }
    );
    uploadInput =
      (await page.$(WECHAT_SELECTORS.bodyImageUploadInput)) ??
      (await page.$("input[type='file'][name='file']"));
  }
  if (!uploadInput) {
    throw new Error("未找到正文图片上传控件。");
  }
  const beforeCount = await page.$eval(editorSelector, (node) =>
    node instanceof HTMLElement ? node.querySelectorAll("img.js_insertlocalimg").length : 0
  );
  await uploadInput.uploadFile(filePath);
  await waitForBodyImageCount(page, editorSelector, beforeCount + 1);
  return page.$eval(editorSelector, (node) => {
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    const images = [...node.querySelectorAll("img.js_insertlocalimg")];
    const latest = images.at(-1);
    return latest?.getAttribute("data-imgfileid") ?? latest?.getAttribute("src") ?? null;
  });
}

async function removeBodyImage(page: Page, editorSelector: string, identifier: string | null): Promise<void> {
  if (!identifier) {
    return;
  }
  const imageMarked = await page.$eval(
    editorSelector,
    (node, targetIdentifier) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const image = [...node.querySelectorAll("img.js_insertlocalimg")].find((candidate) => {
        const fileId = candidate.getAttribute("data-imgfileid");
        const src = candidate.getAttribute("src");
        return fileId === targetIdentifier || src === targetIdentifier;
      });
      if (!(image instanceof HTMLElement)) {
        return false;
      }
      image.id = "codex-temp-remove-image";
      return true;
    },
    identifier
  );
  if (!imageMarked) {
    return;
  }
  await page.evaluate(() => {
    const image = document.querySelector("#codex-temp-remove-image");
    if (image instanceof HTMLElement) {
      image.click();
    }
  });
  await page.keyboard.press("Backspace");
  await page.waitForFunction(() => !document.querySelector("#codex-temp-remove-image"), {
    timeout: 10000
  });
}

async function applyCoverImage(page: Page, editorSelector: string, filePath: string): Promise<boolean> {
  await moveCaretToEditorEnd(page, editorSelector);
  const temporaryImageIdentifier = await uploadImageIntoBody(page, editorSelector, filePath);
  await sleep(5000);

  const openSucceeded = await page.evaluate((selectors: readonly string[]) => {
    const trigger = selectors
      .map((selector) => document.querySelector(selector))
      .find((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);
    if (!trigger) {
      return false;
    }
    trigger.click();
    return true;
  }, WECHAT_SELECTORS.coverFromContentCandidates);

  if (!openSucceeded) {
    return false;
  }

  await page.waitForSelector(WECHAT_SELECTORS.coverChooserItemCandidates[0], {
    visible: true,
    timeout: 15000
  });
  await page.evaluate((selector: string) => {
    const item = document.querySelector(selector);
    if (item instanceof HTMLElement) {
      item.click();
    }
  }, WECHAT_SELECTORS.coverChooserItemCandidates[0]);

  await page.waitForFunction(
    () => {
      const dialog = document.querySelector(".img_crop_panel")?.closest(".weui-desktop-dialog");
      const nextButton = dialog?.querySelector(".weui-desktop-btn_primary");
      return nextButton instanceof HTMLElement && !nextButton.className.includes("disabled");
    },
    { timeout: 15000 }
  );

  await page.evaluate(() => {
    const nextButton = document
      .querySelector(".img_crop_panel")
      ?.closest(".weui-desktop-dialog")
      ?.querySelector(".weui-desktop-btn_primary");
    if (nextButton instanceof HTMLElement) {
      nextButton.id = "codex-temp-cover-next";
    }
  });
  await page.evaluate(() => {
    const nextButton = document.querySelector("#codex-temp-cover-next");
    if (nextButton instanceof HTMLElement) {
      nextButton.click();
    }
  });
  await sleep(1500);

  await page.waitForSelector(WECHAT_SELECTORS.coverCropDialog, {
    visible: true,
    timeout: 15000
  });

  await page.evaluate(() => {
    const confirmButton = document
      .querySelector(".cover-edit-new")
      ?.closest(".weui-desktop-dialog")
      ?.querySelector(".weui-desktop-btn_primary");
    if (confirmButton instanceof HTMLElement) {
      confirmButton.id = "codex-temp-cover-confirm";
    }
  });
  await page.evaluate(() => {
    const confirmButton = document.querySelector("#codex-temp-cover-confirm");
    if (confirmButton instanceof HTMLElement) {
      confirmButton.click();
    }
  });
  await sleep(1500);

  await page.waitForFunction(
    (selectors: readonly string[]) =>
      selectors.some((selector) => {
        return [...document.querySelectorAll(selector)].some((preview) => {
          if (!(preview instanceof HTMLElement)) {
            return false;
          }
          const style = window.getComputedStyle(preview);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.backgroundImage !== "none" &&
            style.backgroundImage !== 'url("")'
          );
        });
      }),
    { timeout: 20000 },
    WECHAT_SELECTORS.coverPreviewCandidates
  );

  await removeBodyImage(page, editorSelector, temporaryImageIdentifier);
  return true;
}

async function insertBodyImagesAtPlaceholders(
  page: Page,
  editorSelector: string,
  bodySlots: BodyImageSlot[]
): Promise<{
  insertedBodyImagePaths: string[];
  missingPlaceholders: string[];
}> {
  const insertedBodyImagePaths: string[] = [];
  const missingPlaceholders: string[] = [];

  for (const slot of bodySlots) {
    // 1. Locate the marker text in the editor and select it
    const markerFound = await page.evaluate(
      function (selector, token) {
        const editor = document.querySelector(selector);
        if (!editor) {
          return false;
        }
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const idx = node.textContent ? node.textContent.indexOf(token) : -1;
          if (idx >= 0) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + token.length);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
            if (editor instanceof HTMLElement) {
              editor.focus();
            }
            return true;
          }
        }
        return false;
      },
      editorSelector,
      slot.markerToken
    );

    if (!markerFound) {
      missingPlaceholders.push(slot.label);
      continue;
    }

    // 2. Delete the marker so the cursor sits at the intended insertion point
    await page.keyboard.press("Delete");
    await sleep(200);

    // 3. Upload the image — WeChat inserts it at the current cursor position
    const imageIdentifier = await uploadImageIntoBody(page, editorSelector, slot.filePath);
    if (!imageIdentifier) {
      missingPlaceholders.push(slot.label);
      continue;
    }

    insertedBodyImagePaths.push(slot.filePath);
  }

  return {
    insertedBodyImagePaths,
    missingPlaceholders
  };
}

async function waitForSaveSuccess(page: Page): Promise<string | null> {
  await page.waitForFunction(
    (selectors: readonly string[]) =>
      selectors.some((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.innerText.trim().length > 0;
      }),
    { timeout: 20000 },
    WECHAT_SELECTORS.saveSuccessCandidates
  );

  return page.evaluate((selectors: readonly string[]) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) {
        continue;
      }
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") {
        continue;
      }
      const text = node.innerText.trim();
      if (text) {
        return text;
      }
    }
    return null;
  }, WECHAT_SELECTORS.saveSuccessCandidates);
}

async function waitForSavedEditorUrl(page: Page): Promise<void> {
  await page
    .waitForFunction(() => {
      const href = location.href;
      return href.includes("appmsgid=") && href.includes("media/appmsg_edit");
    }, { timeout: 15000 })
    .catch(() => undefined);
}

async function reopenDraftVerification(input: {
  browser: Browser;
  accountId: string;
  accountName: string;
  pageUrl: string;
}): Promise<{
  reopenScreenshotPath: string | null;
  reopenUrl: string | null;
  reopenRichTextPreserved: boolean;
}> {
  const reopenedUrl = buildDraftEditUrl(input.pageUrl);
  if (!reopenedUrl) {
    return {
      reopenScreenshotPath: null,
      reopenUrl: null,
      reopenRichTextPreserved: false
    };
  }

  const screenshotDir = ensureScreenshotDir();
  const reopenScreenshotPath = path.join(
    screenshotDir,
    `${Date.now()}-${sanitizeSegment(input.accountName)}-wechat-reopen.png`
  );
  const cookies = readStoredCookies(input.accountId);
  const page = await input.browser.newPage();

  try {
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1440, height: 1080 });
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    await page.goto(reopenedUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("div.ProseMirror[contenteditable='true']", {
      visible: true,
      timeout: 30000
    });
    const bodyHtml = await page.$eval(WECHAT_SELECTORS.bodyEditorCandidates[0], (node: Element) =>
      node instanceof HTMLElement ? node.innerHTML : ""
    );
    const reopenRichTextPreserved = isRichTextStructurePreserved(bodyHtml);
    await page.screenshot({ path: reopenScreenshotPath, fullPage: true });
    return {
      reopenScreenshotPath,
      reopenUrl: page.url(),
      reopenRichTextPreserved
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function publishWechatDraft(input: {
  accountId: string;
  accountName: string;
  article: ArticleRecord;
  editorUrl: string;
}): Promise<DraftPublishResult> {
  const screenshotDir = ensureScreenshotDir();
  const screenshotPath = path.join(
    screenshotDir,
    `${Date.now()}-${sanitizeSegment(input.accountName)}-wechat-save.png`
  );
  const storedCookies = readStoredCookies(input.accountId);
  const browser = await launchBrowser();
  let browserCrashed = false;

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1440, height: 1080 });

    page.on("dialog", async (dialog) => {
      await dialog.accept().catch(() => undefined);
    });

    if (storedCookies.length > 0) {
      await page.setCookie(...storedCookies);
    }

    await page.goto(input.editorUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // tsx/esbuild injects __name for keepNames, which breaks page.evaluate/page.$eval
    // callbacks because the browser context doesn't have __name. Inject a polyfill.
    await page.evaluate(() => {
      if (typeof (window as any).__name === "undefined") {
        (window as any).__name = (target: any, _value: string) => target;
      }
    });

    const pageText = await page.evaluate(() => document.body.innerText ?? "");
    if (pageText.includes("请重新登录")) {
      throw new Error("进入编辑器后仍然被微信要求重新登录。");
    }

    // Wait for React/SPA editor to fully mount before interacting
    await page.waitForSelector("div[contenteditable='true'], textarea#title, input#title", {
      visible: true,
      timeout: 15000
    }).catch(() => undefined);

    // Give React SPA a moment to fully initialize the editor
    await sleep(800);

    const titleSelector = await findFirstSelector(page, WECHAT_SELECTORS.titleInputCandidates);
    const bodySelector = await findFirstSelector(page, WECHAT_SELECTORS.bodyEditorCandidates);
    if (!titleSelector || !bodySelector) {
      throw new Error("未能定位到标题输入框或正文编辑器。");
    }

    // Wait for title input to be visible (non-zero bounding rect)
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      { timeout: 20000 },
      titleSelector
    ).catch(() => null);
    await sleep(300);

    // Also verify body editor is visible
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      { timeout: 15000 },
      bodySelector
    ).catch(() => null);
    await sleep(300);

    const authorSelector = await findFirstSelector(page, WECHAT_SELECTORS.authorInputCandidates);
    const digestSelector = await findFirstSelector(page, WECHAT_SELECTORS.digestInputCandidates);
    const mediaPlan = buildArticleMediaPlan(input.article);

    await setInputValue(page, titleSelector, input.article.title);
    // Check what actually got written
    const titleAfterWrite = await page.$eval(titleSelector, (node) =>
      node instanceof HTMLTextAreaElement
        ? { valueLen: node.value.length, value: node.value.substring(0, 80) }
        : node instanceof HTMLElement
          ? { valueLen: node.innerText.length, value: node.innerText.substring(0, 80) }
          : null
    );
    console.error("[write] title after setInputValue:", JSON.stringify(titleAfterWrite));

    if (authorSelector && input.article.metadata.author.trim()) {
      await setInputValue(page, authorSelector, input.article.metadata.author.trim());
    }
    if (digestSelector && input.article.metadata.digest.trim()) {
      await setInputValue(page, digestSelector, input.article.metadata.digest.trim());
    }

    const editorHtml = buildEditorHtml(input.article);
    await resetBodyContent(page, bodySelector);
    await pasteBodyHtml(page, bodySelector, editorHtml, input.article.rawMarkdown);

    let bodyHtml = await page.$eval(bodySelector, (node) =>
      node instanceof HTMLElement ? node.innerHTML : ""
    );
    if (!isRichTextStructurePreserved(bodyHtml)) {
      await fillBodyHtml(page, bodySelector, editorHtml);
      bodyHtml = await page.$eval(bodySelector, (node) =>
        node instanceof HTMLElement ? node.innerHTML : ""
      );
    }

    const titleValue = await page.$eval(
      titleSelector,
      (node) =>
        node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
          ? node.value.trim()
          : node instanceof HTMLElement
            ? (node.innerText ?? "").trim()
            : ""
    );
    const bodyLength = await page.$eval(bodySelector, (node) =>
      node instanceof HTMLElement ? (node.innerText ?? "").trim().length : 0
    );
    const richStructurePreserved = isRichTextStructurePreserved(bodyHtml);

    // Comprehensive debug: inspect all relevant inputs
    const debugInfo = await page.evaluate(() => {
      const results: Record<string, unknown> = {};
      const selectors = ["textarea#title", "input#title", "div.ProseMirror[contenteditable='true']", "textarea[name='title']", "input[name='title']"];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        results[sel] = Array.from(els).map((el: Element, i: number) => {
          const isInput = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
          return isInput
            ? { i, tag: (el as HTMLElement).tagName, id: (el as HTMLElement).id, valueLen: (el as HTMLInputElement).value.length }
            : { i, tag: (el as HTMLElement).tagName, id: (el as HTMLElement).id, innerLen: (el as HTMLElement).innerHTML.length };
        });
      }
      return results;
    });
    console.error("[DEBUG] validation failure state:", JSON.stringify({ titleValueLen: titleValue.length, bodyLength, richStructurePreserved, titleFirst50: titleValue.substring(0, 50) }));
    console.error("[DEBUG] element inventory:", JSON.stringify(debugInfo));

    if (!titleValue || bodyLength < 20 || !richStructurePreserved) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return {
        stage: "content-fill",
        titleSelector,
        authorSelector,
        digestSelector,
        bodySelector,
        saveSelector: null,
        screenshotPath,
        finalUrl: page.url(),
        saveSuccessText: null,
        reopenScreenshotPath: null,
        reopenUrl: null,
        reopenRichTextPreserved: false,
        coverImageApplied: false,
        insertedBodyImagePaths: [],
        missingBodyImagePaths: mediaPlan.missingBodyImagePaths,
        coverImagePath: mediaPlan.coverImagePath,
        detail: `标题或正文写入后未通过校验：标题长度=${titleValue.length}，正文长度=${bodyLength}，富文本结构保留=${richStructurePreserved ? "是" : "否"}。`
      };
    }

    let coverImageApplied = false;
    if (mediaPlan.coverImagePath) {
      coverImageApplied = await applyCoverImage(page, bodySelector, mediaPlan.coverImagePath);
    }

    const bodyImageInsertion = await insertBodyImagesAtPlaceholders(page, bodySelector, mediaPlan.bodySlots);
    const unresolvedPlaceholders = [
      ...bodyImageInsertion.missingPlaceholders,
      ...mediaPlan.missingBodyImagePaths
    ];

    const saveSelector = await findFirstSelector(page, WECHAT_SELECTORS.saveDraftButtonCandidates);
    if (!saveSelector) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      return {
        stage: "draft-save",
        titleSelector,
        authorSelector,
        digestSelector,
        bodySelector,
        saveSelector: null,
        screenshotPath,
        finalUrl: page.url(),
        saveSuccessText: null,
        reopenScreenshotPath: null,
        reopenUrl: null,
        reopenRichTextPreserved: false,
        coverImageApplied,
        insertedBodyImagePaths: bodyImageInsertion.insertedBodyImagePaths,
        missingBodyImagePaths: unresolvedPlaceholders,
        coverImagePath: mediaPlan.coverImagePath,
        detail: "已写入标题、摘要、正文和图片，但未找到保存为草稿按钮。"
      };
    }

    await page.click(saveSelector);

    let saveSuccessText: string | null = null;
    try {
      saveSuccessText = await waitForSaveSuccess(page);
    } catch (error) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const message = error instanceof Error ? error.message : "等待保存成功提示超时。";
      return {
        stage: "draft-save",
        titleSelector,
        authorSelector,
        digestSelector,
        bodySelector,
        saveSelector,
        screenshotPath,
        finalUrl: page.url(),
        saveSuccessText: null,
        reopenScreenshotPath: null,
        reopenUrl: null,
        reopenRichTextPreserved: false,
        coverImageApplied,
        insertedBodyImagePaths: bodyImageInsertion.insertedBodyImagePaths,
        missingBodyImagePaths: unresolvedPlaceholders,
        coverImagePath: mediaPlan.coverImagePath,
        detail: `保存按钮已点击，但未等到成功提示：${message}`
      };
    }

    await waitForSavedEditorUrl(page);

    const latestCookies = await page.cookies();
    if (latestCookies.length > 0) {
      saveCookies(input.accountId, latestCookies);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const reopenResult = await reopenDraftVerification({
      browser,
      accountId: input.accountId,
      accountName: input.accountName,
      pageUrl: page.url()
    });

    return {
      stage: "draft-save",
      titleSelector,
      authorSelector,
      digestSelector,
      bodySelector,
      saveSelector,
      screenshotPath,
      finalUrl: page.url(),
      saveSuccessText,
      reopenScreenshotPath: reopenResult.reopenScreenshotPath,
      reopenUrl: reopenResult.reopenUrl,
      reopenRichTextPreserved: reopenResult.reopenRichTextPreserved,
      coverImageApplied,
      insertedBodyImagePaths: bodyImageInsertion.insertedBodyImagePaths,
      missingBodyImagePaths: unresolvedPlaceholders,
      coverImagePath: mediaPlan.coverImagePath,
      detail: `标题、摘要、正文已写入，封面=${coverImageApplied ? "已应用" : "未应用"}，正文图片=${bodyImageInsertion.insertedBodyImagePaths.length} 张，未匹配项=${unresolvedPlaceholders.length}，保存提示为"${saveSuccessText ?? "未读取到"}"，保存后复检富文本=${reopenResult.reopenRichTextPreserved ? "是" : "否"}。`
    };
  } catch (error) {
    browserCrashed = true;
    throw error;
  } finally {
    if (!browserCrashed) {
      await browser.close().catch(() => undefined);
    }
  }
}
