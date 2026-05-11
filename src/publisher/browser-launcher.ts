import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: "shell",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1440,1080"
    ]
  });
}
