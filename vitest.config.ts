import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["app/**/tests/**", "app/modules/sdk/lib/generated/**", "app/main.ts", "app/dev.ts"],
      include: ["app/**/*.{ts,tsx}"],
      provider: "v8",
      thresholds: {
        autoUpdate: false,
        branches: 95.02,
        functions: 98.95,
        lines: 99.61,
        statements: 99.22,
      },
    },
    include: ["app/**/*.test.ts", "lint/**/*.test.js"],
    isolate: false,
  },
});
