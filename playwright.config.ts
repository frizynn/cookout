import { defineConfig, devices } from "@playwright/test";
import type { ClockOptions } from "./app/modules/routes/tests/browser/clock.ts";
import type { RelayOptions } from "./app/modules/routes/tests/browser/relay.ts";

const MOVES_THE_CLOCK = "*.clock.browser.test.ts";
const chromium = {
  ...devices["Desktop Chrome"],
  baseURL: process.env["COOKOUT_URL"],
  clockUrl: process.env["COOKOUT_CLOCK_URL"] ?? "",
  headless: true,
  relayUrl: process.env["COOKOUT_RELAY_URL"] ?? "",
};

export default defineConfig<ClockOptions & RelayOptions>({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: true,
  globalSetup: "./scripts/browser-test-server.ts",
  projects: [
    { name: "chromium", testIgnore: MOVES_THE_CLOCK, use: chromium },
    { dependencies: ["chromium"], name: "clock-moved", testMatch: MOVES_THE_CLOCK, use: chromium },
  ],
  reporter: [["list"], ["json", { outputFile: ".timings/browser.json" }]],
  retries: 0,
  testDir: "app/modules/routes/tests/browser",
  testMatch: "*.browser.test.ts",
  timeout: 30_000,
});
