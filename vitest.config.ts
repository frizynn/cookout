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
        statements: 89.05,
        branches: 70.5,
        functions: 85.02,
        lines: 91.53,
      },
    },
  },
});
