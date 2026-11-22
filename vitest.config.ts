import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "lint/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["app/**/tests/**", "app/modules/sdk/lib/generated/**"],
      thresholds: {
        autoUpdate: true,
        statements: 87.57,
        branches: 70.05,
        functions: 82.67,
        lines: 90.04,
      },
    },
  },
});
