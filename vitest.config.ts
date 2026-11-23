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
        "app/web.tsx",
        "app/modules/live/lib/event-source.ts",
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
    projects: [
      {
        extends: true,
        test: {
          exclude: ["app/**/*.browser.test.ts"],
          include: [
            "app/**/*.test.ts",
            "packages/handler-example/app/**/*.test.ts",
            "lint/**/*.test.js",
            "scripts/**/*.test.ts",
          ],
          isolate: false,
          name: "server",
        },
      },
      {
        extends: true,
        test: {
          environment: "./scripts/web-test-environment.ts",
          exclude: ["app/**/*.clock.test.tsx"],
          include: ["app/**/*.test.tsx"],
          name: "web",
        },
      },
      {
        extends: true,
        test: {
          environment: "./scripts/jsdom-server-environment.ts",
          include: ["app/**/*.clock.test.tsx"],
          name: "web-clock",
        },
      },
    ],
  },
});
