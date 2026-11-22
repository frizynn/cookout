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
        statements: 84.61,
        branches: 55.88,
        functions: 75.92,
        lines: 86.52,
      },
    },
  },
});
