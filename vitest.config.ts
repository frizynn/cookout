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
        statements: 97.63,
        branches: 84.1,
        functions: 97.46,
        lines: 98.61,
      },
    },
  },
});
