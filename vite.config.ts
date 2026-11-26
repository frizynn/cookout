import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { String as Str } from "effect";
import tailwindcss from "@tailwindcss/vite";

const WRITTEN_BY_OTHER_CHECKS = [
  "**/coverage/**",
  "**/dist/**",
  "**/lint/fixers-run/**",
  "**/playwright-report/**",
  "**/.vitest/**",
];
const ROOT_TAG = '<html lang="en">';
const BUILD_VARIABLE = "COOKOUT_BUILD";
const ANY_MODE = "";
const UNKNOWN = "unknown";

function buildOr(given: string): string {
  if (given === "") {
    return UNKNOWN;
  }
  return given;
}

function buildStamp(): Plugin {
  const build = buildOr(loadEnv(ANY_MODE, import.meta.dirname, BUILD_VARIABLE)[BUILD_VARIABLE] ?? "");
  return {
    generateBundle() {
      this.emitFile({ fileName: "assets/build.txt", source: `${build}\n`, type: "asset" });
    },
    name: "cookout-build-stamp",
    transformIndexHtml: Str.replace(ROOT_TAG, `<html lang="en" data-build="${build}">`),
  };
}

export default defineConfig({
  build: { emptyOutDir: true, outDir: "dist/web" },
  clearScreen: false,
  logLevel: "warn",
  plugins: [tailwindcss(), buildStamp()],
  server: { watch: { ignored: WRITTEN_BY_OTHER_CHECKS } },
});
