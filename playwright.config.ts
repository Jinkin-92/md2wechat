import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5373",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: "C:\\Users\\DELL\\AppData\\Local\\ms-playwright\\chromium-1219\\chrome-win64\\chrome.exe",
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5373",
    reuseExistingServer: true,
    timeout: 60000,
  },
});

