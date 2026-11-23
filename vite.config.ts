import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: { emptyOutDir: true, outDir: "dist/web" },
  clearScreen: false,
  logLevel: "warn",
  plugins: [tailwindcss()],
});
