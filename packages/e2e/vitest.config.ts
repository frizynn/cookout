import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
    retry: 0,
    testTimeout: 30_000,
  },
});
