import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.ts", "lint/**/*.test.js"],
    isolate: false,
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["app/**/tests/**", "app/modules/sdk/lib/generated/**"],
      thresholds: {
        autoUpdate: true,
        statements: 98.43,
        branches: 89.34,
        functions: 97.95,
        lines: 99.05,
      },
    },
  },
});
