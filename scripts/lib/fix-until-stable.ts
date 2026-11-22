import type { Diagnostic, Outcome } from "./tools.ts";
import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { reportOf } from "./tools.ts";

interface FixRun {
  readonly check: readonly string[];
  readonly fix: readonly string[];
  readonly passesLeft: number;
  readonly paths: readonly string[];
}

interface Scope {
  readonly files: readonly string[];
  readonly ignored: readonly string[];
}

const FIX_CONFIG = ".oxlintrc.fix.json";
const MAX_FIX_PASSES = 10;
const NONE = 0;
const ONE_PASS = 1;
const FAILED = 1;
const LINTED = /\.[cm]?[jt]sx?$/u;

function wholeRepo(ignored: readonly string[]): readonly string[] {
  const listed = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
  return listed.stdout
    .split("\n")
    .filter((file) => LINTED.test(file) && !ignored.some((pattern) => path.matchesGlob(file, pattern)));
}

function snapshot(files: readonly string[]): string {
  return files
    .map((file) => {
      if (existsSync(file)) {
        return readFileSync(file, "utf8");
      }
      return "";
    })
    .join("\0");
}

function statusOf(closed: readonly unknown[]): number {
  const [code] = closed;
  if (typeof code === "number") {
    return code;
  }
  return FAILED;
}

async function lint(args: readonly string[]): Promise<Outcome<readonly Diagnostic[]>> {
  const child = spawn("node_modules/.bin/effect-tsgo", ["oxlint", "--type-aware", "-f", "json", ...args]);
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout.on("data", (chunk: unknown) => {
    stdout.push(String(chunk));
  });
  child.stderr.on("data", (chunk: unknown) => {
    stderr.push(String(chunk));
  });
  try {
    const closed: readonly unknown[] = await once(child, "close");
    return reportOf({ status: statusOf(closed), stderr: stderr.join(""), stdout: stdout.join("") });
  } catch (error) {
    return { ok: false, reason: `effect-tsgo could not run (${String(error)}). Run pnpm install.` };
  }
}

export function repoFixRun(scope: Scope): FixRun {
  const check = ["--disable-nested-config", ...scope.files];
  if (scope.files.length > NONE) {
    return { check, fix: ["-c", FIX_CONFIG, ...check], passesLeft: MAX_FIX_PASSES, paths: scope.files };
  }
  const paths = wholeRepo(scope.ignored);
  return { check, fix: ["-c", FIX_CONFIG, "--disable-nested-config", ...paths], passesLeft: MAX_FIX_PASSES, paths };
}

export async function lintFixed(run: FixRun): Promise<Outcome<readonly Diagnostic[]>> {
  if (run.passesLeft === NONE) {
    return lint(run.check);
  }
  const before = snapshot(run.paths);
  const [fixed, checked] = await Promise.all([lint(["--fix", ...run.fix]), lint(run.check)]);
  if (!fixed.ok) {
    return fixed;
  }
  if (snapshot(run.paths) === before) {
    return checked;
  }
  return lintFixed({ ...run, passesLeft: run.passesLeft - ONE_PASS });
}
