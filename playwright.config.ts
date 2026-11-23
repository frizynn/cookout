import { defineConfig, devices } from "@playwright/test";
import type { RelayOptions } from "./app/modules/routes/tests/browser/relay.ts";

export default defineConfig<RelayOptions>({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: true,
  globalSetup: "./scripts/browser-test-server.ts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env["COOKOUT_URL"],
        headless: true,
        relayUrl: process.env["COOKOUT_RELAY_URL"] ?? "",
      },
    },
  ],
  reporter: "list",
  retries: 0,
  testDir: "app/modules/routes/tests/browser",
  testMatch: "*.browser.test.ts",
  timeout: 30_000,
});
