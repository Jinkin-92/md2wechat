import puppeteer from "puppeteer";
import type { Browser, LaunchOptions } from "puppeteer";

/**
 * 启动 Puppeteer 浏览器。配置从环境变量读取,默认值保留历史行为。
 *
 * - `CHROME_EXECUTABLE_PATH`: 指定 chrome.exe / msedge.exe 绝对路径。空则使用 Puppeteer 自带 Chromium。
 * - `PUPPETEER_HEADLESS`: `"true"` / `"1"` → 无头(headless: "shell", 适合 CI),
 *                          `"false"` / `"0"` → 可见窗口(headless: false, 适合人工扫码)。
 *                          其他值或未设置 → 默认 headless: "shell"。
 */
function resolveHeadless(): "shell" | boolean {
  const raw = (process.env.PUPPETEER_HEADLESS ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  return "shell";
}

function resolveExecutablePath(): string | undefined {
  const raw = (process.env.CHROME_EXECUTABLE_PATH ?? "").trim();
  return raw ? raw : undefined;
}

export async function launchBrowser(): Promise<Browser> {
  const baseArgs: LaunchOptions["args"] = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    "--window-size=1440,1080"
  ];

  const launchOptions: LaunchOptions = {
    headless: resolveHeadless(),
    args: baseArgs
  };

  const executablePath = resolveExecutablePath();
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return puppeteer.launch(launchOptions);
}
