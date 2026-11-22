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
        autoUpdate: true,
        statements: 99.03,
        branches: 93.71,
        functions: 98.79,
        lines: 99.54,
      },
    },
  },
});
