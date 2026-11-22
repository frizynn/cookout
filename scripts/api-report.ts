import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, tool, unwrap } from "./lib/tools.ts";

const SCRIPT = "api-report";
const DIST = "dist";
const DECLARATIONS = join(DIST, "sdk.d.ts");
const REPORT = "api/sdk.api.md";
const EFFECT_IMPORT = /["'](?:effect|@effect\/[^"'/]+)(?:\/[^"']*)?["']/u;

const header = [
  "# `@ai-hero/cookout/sdk` API report",
  "",
  "The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.",
  "",
];

const render = (declarations: string) => [...header, "```ts", declarations.trimEnd(), "```", ""].join("\n");

const build = unwrap(SCRIPT, tool("tsdown", ["--log-level", "error"]));
if (build.status !== 0) fail(SCRIPT, `the build failed:\n${build.stdout}${build.stderr}`);
if (!existsSync(DECLARATIONS)) fail(SCRIPT, `the build wrote no ${DECLARATIONS}.`);

const leaks = readdirSync(DIST)
  .filter((file) => file.endsWith(".d.ts"))
  .flatMap((file) =>
    readFileSync(join(DIST, file), "utf8")
      .split("\n")
      .filter((line) => EFFECT_IMPORT.test(line))
      .map((line) => `${join(DIST, file)} names an Effect type (${line.trim()}). The SDK is plain TypeScript.`),
  );

const expected = render(readFileSync(DECLARATIONS, "utf8"));
const committed = existsSync(REPORT) ? readFileSync(REPORT, "utf8") : "";

if (process.argv.includes("--write")) {
  writeFileSync(REPORT, expected);
} else if (committed !== expected) {
  leaks.push(
    `${REPORT} doesn't match the SDK's built declarations. If the change to the SDK's surface is deliberate, run pnpm api:write and commit ${REPORT}.`,
  );
}

for (const leak of leaks) console.error(`${SCRIPT}: ${leak}`);
process.exitCode = leaks.length > 0 ? 1 : 0;
