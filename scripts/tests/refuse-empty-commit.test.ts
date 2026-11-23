import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { expect, it, onTestFinished } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const SCRIPT = path.resolve("scripts/refuse-empty-commit.sh");
const EXECUTABLE = 0o755;
const FAILED = 1;
const PASSED = 0;

interface Run {
  readonly status: number | null;
  readonly stderr: string;
}

function git(cwd: string, ...args: readonly string[]): Run {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function hooksIn(root: string): string {
  const hooks = path.join(root, "hooks");
  mkdirSync(hooks);
  writeFileSync(path.join(hooks, "pre-commit"), `#!/usr/bin/env bash\nexec ${SCRIPT}\n`);
  chmodSync(path.join(hooks, "pre-commit"), EXECUTABLE);
  return hooks;
}

function repo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "refuse-empty-commit-"));
  onTestFinished(() => {
    rmSync(root, { force: true, recursive: true });
  });
  const work = path.join(root, "work");
  mkdirSync(work);
  git(work, "init", "--quiet");
  writeFileSync(path.join(work, "a.txt"), "a\n");
  const setup = [
    ["config", "user.email", "test@example.com"],
    ["config", "user.name", "Test"],
    ["config", "core.hooksPath", hooksIn(root)],
    ["add", "a.txt"],
    ["commit", "--quiet", "-m", "first"],
  ];
  for (const args of setup) {
    git(work, ...args);
  }
  return work;
}

it("a commit with nothing staged fails and says to run git add", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const work = repo();
  writeFileSync(path.join(work, "a.txt"), "changed\n");
  const run = git(work, "commit", "-m", "nothing staged");

  expect(run.status).toBe(FAILED);
  expect(run.stderr).toContain("nothing staged: run git add first");
});

it("a commit with something staged passes the hook", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const work = repo();
  writeFileSync(path.join(work, "a.txt"), "changed\n");
  git(work, "add", "a.txt");

  expect(git(work, "commit", "--quiet", "-m", "staged").status).toBe(PASSED);
});

it("an amend or an allowed empty commit may stage nothing", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const work = repo();

  expect(git(work, "commit", "--quiet", "--amend", "-m", "reworded").status).toBe(PASSED);
  expect(git(work, "commit", "--quiet", "--allow-empty", "-m", "empty").status).toBe(PASSED);
});
