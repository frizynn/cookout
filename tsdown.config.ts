import { defineConfig, type UserConfig } from "tsdown";

const shared: UserConfig = {
  outDir: "dist",
  format: "esm",
  platform: "node",
  target: "node22.18",
  fixedExtension: false,
};

export default defineConfig([
  { ...shared, entry: { main: "app/main.ts" }, dts: false, clean: true },
  { ...shared, entry: { sdk: "app/modules/sdk/index.ts" }, tsconfig: "tsconfig.sdk.json", dts: true, clean: true },
]);
