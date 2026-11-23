import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["app/**/tests/**", "app/modules/sdk/lib/generated/**", "app/main.ts", "app/dev.ts"],
      include: ["app/**/*.{ts,tsx}"],
      provider: "v8",
      thresholds: {
        autoUpdate: false,
        branches: 96.42,
        functions: 99.54,
        lines: 99.93,
        statements: 99.76,
      },
    },
    include: ["app/**/*.test.ts", "lint/**/*.test.js"],
    isolate: false,
  },
});
