import { defineConfig } from "vite";

export default defineConfig({
  build: { emptyOutDir: true, outDir: "dist/web" },
  clearScreen: false,
  logLevel: "warn",
});
