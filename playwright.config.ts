import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: true,
  fullyParallel: true,
  globalSetup: "./scripts/browser-test-server.ts",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], baseURL: process.env["COOKOUT_URL"], headless: true } },
  ],
  reporter: "list",
  retries: 0,
  testDir: "app/modules/routes/tests/browser",
  testMatch: "*.browser.test.ts",
  timeout: 15_000,
});
