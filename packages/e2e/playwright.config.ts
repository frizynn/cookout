import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: true,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], headless: true } }],
  reporter: "list",
  retries: 0,
  testDir: "app/modules/cookout/tests/browser",
  testMatch: "*.browser.test.ts",
  timeout: 30_000,
});
