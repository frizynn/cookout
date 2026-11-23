import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "app/**/tests/**",
        "packages/handler-example/app/**/tests/**",
        "packages/handler-example/app/main.ts",
        "app/modules/sdk/lib/generated/**",
        "app/main.ts",
        "app/dev.ts",
      ],
      include: ["app/**/*.{ts,tsx}", "packages/handler-example/app/**/*.ts"],
      provider: "v8",
      thresholds: {
        autoUpdate: false,
        branches: 96.42,
        functions: 99.54,
        lines: 99.93,
        statements: 99.76,
      },
    },
    include: ["app/**/*.test.ts", "packages/handler-example/app/**/*.test.ts", "lint/**/*.test.js"],
    isolate: false,
  },
});
