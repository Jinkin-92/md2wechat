import fs from "node:fs";
import path from "node:path";

import type { CookieParam } from "puppeteer";

import { getAccountSessionFilePath } from "../storage/publish.js";

/**
 * Read stored cookies for an account.
 * Returns empty array if no session file exists.
 */
export function readStoredCookies(accountId: string): CookieParam[] {
  const sessionFilePath = getAccountSessionFilePath(accountId);
  if (!fs.existsSync(sessionFilePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(sessionFilePath, "utf8")) as CookieParam[];
}

/**
 * Save cookies for an account.
 * Should only be called AFTER login state is confirmed as "authenticated".
 */
export function saveCookies(accountId: string, cookies: unknown[]): void {
  const sessionFilePath = getAccountSessionFilePath(accountId);
  fs.writeFileSync(sessionFilePath, JSON.stringify(cookies, null, 2), "utf8");
}