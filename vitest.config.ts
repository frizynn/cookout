import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "lint/**/*.test.js"],
    isolate: false,
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["app/**/tests/**", "app/modules/sdk/lib/generated/**", "app/main.ts", "app/dev.ts"],
      thresholds: {
        autoUpdate: false,
        statements: 99.22,
        branches: 95.02,
        functions: 98.95,
        lines: 99.61,
      },
    },
  },
});
