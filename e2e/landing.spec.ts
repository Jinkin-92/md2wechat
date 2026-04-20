import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the landing page", async ({ page }) => {
    await expect(page).toHaveTitle(/Markdown|md2wechat|MdPublisher/i);
  });

  test("should display hero title", async ({ page }) => {
    await expect(page.getByText(/Markdown.*公众号|公众号.*Markdown/)).toBeVisible();
  });

  test("should display upload area", async ({ page }) => {
    await expect(page.getByText("拖拽文件到这里，或点击选择")).toBeVisible();
  });

  test("should display template tabs", async ({ page }) => {
    await page.waitForTimeout(2000); // Wait for API to load templates
    const tabs = page.locator(".landing-template-tab");
    await expect(tabs.first()).toBeVisible();
  });

  test("should switch template tabs", async ({ page }) => {
    await page.waitForTimeout(2000);
    const tabs = page.locator(".landing-template-tab");
    const count = await tabs.count();
    if (count >= 2) {
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveClass(/active/);
    }
  });

  test("should show upload button", async ({ page }) => {
    const uploadBtn = page.getByRole("button", { name: /导入文章|上传文章/ });
    await expect(uploadBtn).toBeVisible();
  });
});
