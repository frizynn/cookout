import { changedFiles } from "./lib/changed-files.ts";
import { lintable } from "./lib/fix-until-stable.ts";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { unwrap } from "./lib/tools.ts";

const SCRIPT = "lint:changed";
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const NONE = 0;
const TYPES = ["node_modules/.bin/tsc", "--noEmit", "--incremental"] as const;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { base: { default: "origin/v1", type: "string" } },
});

function filesToLint(): readonly string[] {
  if (positionals.length > NONE) {
    return positionals;
  }
  return unwrap(SCRIPT, changedFiles({ base: values.base, cwd: process.cwd() }));
}

function passes(command: readonly string[]): boolean {
  const [program = "true", ...rest] = command;
  const ran = spawnSync(program, rest, { stdio: "inherit" });
  return ran.status === EXIT_SUCCESS;
}

function checksOf(files: readonly string[]): readonly (readonly string[])[] {
  if (files.length === NONE) {
    return [TYPES];
  }
  return [["node", "scripts/lint-ratchet.ts", ...files], TYPES];
}

function exitCodeOf(checks: readonly (readonly string[])[]): number {
  const failed = checks.filter((command) => !passes(command));
  if (failed.length === NONE) {
    return EXIT_SUCCESS;
  }
  return EXIT_FAILURE;
}

process.exitCode = exitCodeOf(checksOf(filesToLint().filter((file) => lintable(file))));
