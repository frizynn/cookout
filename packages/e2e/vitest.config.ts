import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["app/**/*.browser.test.ts"],
    globalSetup: ["app/modules/cookout/lib/server/leftover-channels.ts"],
    include: ["app/**/*.test.ts"],
    outputFile: { json: "../../.timings/e2e-tests.json" },
    reporters: ["verbose", "json"],
    retry: 0,
    testTimeout: 30_000,
  },
});
