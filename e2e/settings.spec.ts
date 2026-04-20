import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to settings page", async ({ page }) => {
    await expect(page).toHaveURL(/\/settings/);
  });

  test("should display AI settings section", async ({ page }) => {
    await expect(page.getByText("AI 功能")).toBeVisible();
  });

  test("should display AI assistant toggle", async ({ page }) => {
    // Toggle wrapper (label) is visible; input itself has opacity:0
    const aiToggleWrapper = page.locator(".settings-toggle").first();
    await expect(aiToggleWrapper).toBeVisible();
  });

  test("should toggle AI assistant and show fields", async ({ page }) => {
    const aiToggleWrapper = page.locator(".settings-toggle").first();
    await aiToggleWrapper.click();
    // Fields should appear after enabling
    await expect(page.getByPlaceholder("https://api.openai.com/v1")).toBeVisible();
    await expect(page.getByPlaceholder("sk-")).toBeVisible();
  });

  test("should display model select when AI enabled", async ({ page }) => {
    const aiToggleWrapper = page.locator(".settings-toggle").first();
    await aiToggleWrapper.click();
    const select = page.locator(".settings-select").first();
    await expect(select).toBeVisible();
    await select.selectOption("claude");
    await expect(select).toHaveValue("claude");
  });

  test("should display API fields when AI enabled", async ({ page }) => {
    const aiToggleWrapper = page.locator(".settings-toggle").first();
    await aiToggleWrapper.click();
    await expect(page.getByPlaceholder("https://api.openai.com/v1")).toBeVisible();
    await expect(page.getByPlaceholder("sk-")).toBeVisible();
    await expect(page.getByPlaceholder("gpt-4-turbo")).toBeVisible();
  });

  test("should display smart typesetting section", async ({ page }) => {
    await expect(page.getByText("智能排版设置")).toBeVisible();
  });

  test("should display learning template section", async ({ page }) => {
    await expect(page.getByText("学习模板设置")).toBeVisible();
  });

  test("should display account management section", async ({ page }) => {
    await expect(page.getByText("账号管理")).toBeVisible();
  });

  test("should show wechat account row", async ({ page }) => {
    const wechatRow = page.locator(".settings-account-row").first();
    await expect(wechatRow.getByText("微信")).toBeVisible();
    await expect(wechatRow.getByRole("button", { name: "连接" })).toBeVisible();
  });

  test("should show zhihu account row", async ({ page }) => {
    const rows = page.locator(".settings-account-row");
    const zhihuRow = rows.filter({ hasText: "知乎" });
    await expect(zhihuRow).toBeVisible();
    await expect(zhihuRow.getByRole("button", { name: "连接" })).toBeVisible();
  });

  test("should show jianshu account row", async ({ page }) => {
    const rows = page.locator(".settings-account-row");
    const jianshuRow = rows.filter({ hasText: "简书" });
    await expect(jianshuRow).toBeVisible();
    await expect(jianshuRow.getByRole("button", { name: "连接" })).toBeVisible();
  });

  test("should display save button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "保存设置" })).toBeVisible();
  });

  test("should save settings and show confirmation", async ({ page }) => {
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("设置已保存")).toBeVisible({ timeout: 3000 });
  });

  test("should navigate back to home via back button", async ({ page }) => {
    await page.getByRole("button", { name: "返回" }).click();
    await expect(page).toHaveURL("/");
  });
});
