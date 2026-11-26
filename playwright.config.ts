import { defineConfig, devices } from "@playwright/test";
import type { ProbeOptions } from "./app/modules/routes/tests/browser/probe.ts";
import type { RelayOptions } from "./app/modules/routes/tests/browser/relay.ts";
import type { SlowOptions } from "./app/modules/routes/tests/browser/slow.ts";
import { recordBrowserCoverage } from "./scripts/browser-coverage-recorder.ts";

const coverageRecords = process.env["COOKOUT_BROWSER_COVERAGE"] ?? "";
if (coverageRecords !== "") {
  recordBrowserCoverage({ dir: coverageRecords, root: import.meta.dirname });
}

const CI_WORKERS = 4;
const LOCAL_WORKERS = "50%";

function workers(): number | string {
  if (process.env["CI"] === "true") {
    return CI_WORKERS;
  }
  return LOCAL_WORKERS;
}

const chromium = {
  ...devices["Desktop Chrome"],
  baseURL: process.env["COOKOUT_URL"],
  headless: true,
  probe: process.env["COOKOUT_BROWSER_PROBE"] === "1",
  relayUrl: process.env["COOKOUT_RELAY_URL"] ?? "",
  slowMs: Number(process.env["COOKOUT_BROWSER_SLOW_MS"] ?? "0"),
};

const webkitPhone = {
  ...devices["iPhone 15"],
  baseURL: process.env["COOKOUT_URL"],
  headless: true,
  viewport: { height: 844, width: 390 },
};

function projects(): { readonly name: string; readonly testMatch?: string; readonly use: object }[] {
  const all = [{ name: "chromium", use: chromium }];
  if (process.env["COOKOUT_BROWSER_WEBKIT"] === "1") {
    return [...all, { name: "webkit", testMatch: "phone-*.browser.test.ts", use: webkitPhone }];
  }
  return all;
}

export default defineConfig<ProbeOptions & RelayOptions & SlowOptions>({
  expect: { timeout: 10_000 },
  forbidOnly: true,
  fullyParallel: true,
  globalSetup: "./scripts/browser-test-server.ts",
  projects: projects(),
  reporter: [["list"], ["json", { outputFile: ".timings/browser.json" }]],
  retries: 0,
  testDir: "app/modules/routes/tests/browser",
  testMatch: "*.browser.test.ts",
  timeout: 30_000,
  workers: workers(),
});
