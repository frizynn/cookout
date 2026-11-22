import { defineConfig } from "vitest/config";

// One run covers every package's tests plus the repo-level tests in tests/.
// A package that needs its own environment (e.g. web with a DOM) adds a
// vitest.config.ts in its folder; the glob below picks it up as a project.
export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        test: {
          name: "repo",
          include: ["tests/**/*.test.ts"],
          // Probes write into real packages; keep runs of this file serial.
          fileParallelism: false,
        },
      },
    ],
  },
});
