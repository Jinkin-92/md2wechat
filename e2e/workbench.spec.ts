import { test, expect } from "@playwright/test";

test.describe("Workbench Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workbench");
    await page.waitForTimeout(2000);
  });

  test("should navigate to workbench", async ({ page }) => {
    await expect(page).toHaveURL(/\/workbench/);
  });

  test("should display top toolbar", async ({ page }) => {
    await expect(page.getByTitle("首页")).toBeVisible();
    await expect(page.getByTitle("设置")).toBeVisible();
  });

  test("should display article selector", async ({ page }) => {
    const select = page.locator(".workbench-article-select");
    await expect(select).toBeVisible();
  });

  test("should display markdown editor textarea", async ({ page }) => {
    const textarea = page.locator(".workbench-editor-textarea");
    await expect(textarea).toBeVisible();
  });

  test("should display generate preview button", async ({ page }) => {
    const btn = page.getByRole("button", { name: /生成预览/ });
    await expect(btn).toBeVisible();
  });

  test("should display template list in left panel", async ({ page }) => {
    await page.waitForTimeout(1000);
    const templateItems = page.locator(".workbench-template-item");
    await expect(templateItems.first()).toBeVisible();
  });

  test("should switch to custom panel", async ({ page }) => {
    await page.getByRole("button", { name: "自定义" }).click();
    const fontSizeSection = page.getByText("字号");
    await expect(fontSizeSection).toBeVisible();
  });

  test("should toggle font size chips in custom panel", async ({ page }) => {
    await page.getByRole("button", { name: "自定义" }).click();
    const px15 = page.getByRole("button", { name: "15px" });
    await px15.click();
    await expect(px15).toHaveClass(/active/);
  });

  test("should display preview panel", async ({ page }) => {
    await expect(page.getByText("排版预览")).toBeVisible();
  });

  test("should display HTML source tab", async ({ page }) => {
    await page.getByRole("button", { name: "HTML" }).click();
    const pre = page.locator(".workbench-html-source");
    await expect(pre).toBeVisible();
  });

  test("should display publish button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /发布到草稿箱/ })).toBeVisible();
  });

  test("should show publish dropdown on click", async ({ page }) => {
    await page.getByRole("button", { name: /发布到草稿箱/ }).click();
    await expect(page.getByText("微信公众号")).toBeVisible();
    await expect(page.getByText("知乎专栏")).toBeVisible();
  });

  test("should navigate to settings via icon", async ({ page }) => {
    await page.getByTitle("设置").click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("should navigate to home via icon", async ({ page }) => {
    await page.getByTitle("首页").click();
    await expect(page).toHaveURL("/");
  });
});
