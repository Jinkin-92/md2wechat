import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { readStoredCookies, saveCookies } from "../src/shared/session-cookies.js";

// Mock the storage module
vi.mock("../src/storage/publish.js", () => ({
  getAccountSessionFilePath: (accountId: string) =>
    path.join("/tmp", `session-${accountId}.json`),
}));

describe("session-cookies", () => {
  const testAccountId = "test-account-123";
  const sessionFilePath = path.join("/tmp", `session-${testAccountId}.json`);

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  });

  describe("readStoredCookies", () => {
    it("should return empty array when no session file exists", () => {
      const result = readStoredCookies(testAccountId);
      expect(result).toEqual([]);
    });

    it("should return stored cookies when session file exists", () => {
      const mockCookies = [
        { name: "session_id", value: "abc123" },
        { name: "user", value: "testuser" },
      ];
      fs.writeFileSync(sessionFilePath, JSON.stringify(mockCookies), "utf8");

      const result = readStoredCookies(testAccountId);
      expect(result).toEqual(mockCookies);
    });

    it("should return empty array for invalid JSON", () => {
      fs.writeFileSync(sessionFilePath, "not valid json", "utf8");

      expect(() => readStoredCookies(testAccountId)).toThrow();
    });
  });

  describe("saveCookies", () => {
    it("should create session file with cookies", () => {
      const mockCookies = [{ name: "session_id", value: "xyz789" }];
      saveCookies(testAccountId, mockCookies);

      expect(fs.existsSync(sessionFilePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
      expect(content).toEqual(mockCookies);
    });

    it("should overwrite existing session file", () => {
      const oldCookies = [{ name: "old", value: "session" }];
      fs.writeFileSync(sessionFilePath, JSON.stringify(oldCookies), "utf8");

      const newCookies = [{ name: "new", value: "session" }];
      saveCookies(testAccountId, newCookies);

      const content = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
      expect(content).toEqual(newCookies);
    });

    it("should save empty array", () => {
      saveCookies(testAccountId, []);
      expect(fs.existsSync(sessionFilePath)).toBe(true);
    });
  });
});
