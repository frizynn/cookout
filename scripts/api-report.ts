import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fail, tool, unwrap } from "./lib/tools.ts";
import path from "node:path";

const SCRIPT = "api-report";
const DIST = "dist";
const DECLARATIONS = path.join(DIST, "sdk.d.ts");
const REPORT = "api/sdk.api.md";
const EFFECT_IMPORT = /["'](?:effect|@effect\/[^"'/]+)(?:\/[^"']*)?["']/u;
const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const NONE = 0;

const header = [
  "# `@ai-hero/cookout/sdk` API report",
  "",
  "The SDK's public surface: the built `dist/sdk.d.ts`, as consumers of the published package see it. `pnpm check` fails when it and the code disagree; after a deliberate change to the SDK's surface, run `pnpm api:write` and commit the result.",
  "",
];

function render(declarations: string): string {
  return [...header, "```ts", declarations.trimEnd(), "```", ""].join("\n");
}

function committedReport(): string {
  if (existsSync(REPORT)) {
    return readFileSync(REPORT, "utf8");
  }
  return "";
}

function leaksIn(file: string): readonly string[] {
  return readFileSync(path.join(DIST, file), "utf8")
    .split("\n")
    .filter((line) => EFFECT_IMPORT.test(line))
    .map((line) => `${path.join(DIST, file)} names an Effect type (${line.trim()}). The SDK is plain TypeScript.`);
}

const build = unwrap(SCRIPT, tool("tsdown", ["--log-level", "error"]));
if (build.status !== EXIT_SUCCESS) {
  fail(SCRIPT, `the build failed:\n${build.stdout}${build.stderr}`);
}
if (!existsSync(DECLARATIONS)) {
  fail(SCRIPT, `the build wrote no ${DECLARATIONS}.`);
}

const leaks = readdirSync(DIST)
  .filter((file) => file.endsWith(".d.ts"))
  .flatMap((file) => leaksIn(file));
const expected = render(readFileSync(DECLARATIONS, "utf8"));

if (process.argv.includes("--write")) {
  writeFileSync(REPORT, expected);
} else if (committedReport() !== expected) {
  leaks.push(
    `${REPORT} doesn't match the SDK's built declarations. If the change to the SDK's surface is deliberate, run pnpm api:write and commit ${REPORT}.`,
  );
}

for (const leak of leaks) {
  console.error(`${SCRIPT}: ${leak}`);
}
process.exitCode = EXIT_SUCCESS;
if (leaks.length > NONE) {
  process.exitCode = EXIT_FAILURE;
}
