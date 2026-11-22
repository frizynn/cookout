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
        statements: 99.01,
        branches: 93.5,
        functions: 98.74,
        lines: 99.53,
      },
    },
  },
});
