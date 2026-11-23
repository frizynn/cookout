import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["app/**/*.browser.test.ts"],
    include: ["app/**/*.test.ts"],
    reporters: ["verbose"],
    retry: 0,
    testTimeout: 30_000,
  },
});
