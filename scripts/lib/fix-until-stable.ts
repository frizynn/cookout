import type { Diagnostic, Outcome } from "./tools.ts";
import { existsSync, readFileSync } from "node:fs";
import { oxlint } from "./tools.ts";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface FixRun {
  readonly files: readonly string[];
  readonly ignored: readonly string[];
}

const MAX_FIX_PASSES = 10;
const NONE = 0;
const FIRST_PASS = 1;
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

function pathsOf(run: FixRun): readonly string[] {
  if (run.files.length > NONE) {
    return run.files;
  }
  return wholeRepo(run.ignored);
}

export function lintFixed(run: FixRun): Outcome<readonly Diagnostic[]> {
  const paths = pathsOf(run);
  const lintArgs = ["--disable-nested-config", ...run.files];
  for (let pass = FIRST_PASS; pass <= MAX_FIX_PASSES; pass += FIRST_PASS) {
    const before = snapshot(paths);
    const fixed = oxlint(["--fix", ...lintArgs]);
    if (!fixed.ok || snapshot(paths) === before) {
      return fixed;
    }
  }
  return oxlint(lintArgs);
}
