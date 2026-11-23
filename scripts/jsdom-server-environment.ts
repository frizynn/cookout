import type { Environment } from "vitest/runtime";
import { builtinEnvironments } from "vitest/runtime";

const jsdomServerEnvironment: Environment = {
  ...builtinEnvironments.jsdom,
  name: "jsdom-server",
  viteEnvironment: "ssr",
};

export default jsdomServerEnvironment;
