import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const WRITTEN_BY_OTHER_CHECKS = [
  "**/coverage/**",
  "**/dist/**",
  "**/lint/fixers-run/**",
  "**/playwright-report/**",
  "**/.vitest/**",
];

export default defineConfig({
  build: { emptyOutDir: true, outDir: "dist/web" },
  clearScreen: false,
  logLevel: "warn",
  plugins: [tailwindcss()],
  server: { watch: { ignored: WRITTEN_BY_OTHER_CHECKS } },
});
