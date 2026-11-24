import { expect, it, onTestFinished } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const SCRIPT = path.resolve("scripts/commit.sh");
const FAILED = 1;
const PASSED = 0;

interface Run {
  readonly status: number | null;
  readonly stderr: string;
}

function git(cwd: string, ...args: readonly string[]): Run {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function commit(cwd: string, ...args: readonly string[]): Run {
  return spawnSync(SCRIPT, args, { cwd, encoding: "utf8" });
}

function repo(): string {
  const work = mkdtempSync(path.join(tmpdir(), "commit-"));
  onTestFinished(() => {
    rmSync(work, { force: true, recursive: true });
  });
  writeFileSync(path.join(work, "a.txt"), "a\n");
  const setup = [
    ["init", "--quiet"],
    ["config", "user.email", "test@example.com"],
    ["config", "user.name", "Test"],
    ["add", "a.txt"],
    ["commit", "--quiet", "-m", "first"],
  ];
  for (const args of setup) {
    git(work, ...args);
  }
  writeFileSync(path.join(work, "a.txt"), "changed\n");
  return work;
}

it("a commit with nothing staged fails and says to run git add", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const run = commit(repo(), "-m", "nothing staged");

  expect(run.status).toBe(FAILED);
  expect(run.stderr).toBe("nothing staged: run git add first\n");
});

it("a commit with something staged is made", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const work = repo();
  git(work, "add", "a.txt");

  expect(commit(work, "--quiet", "-m", "staged").status).toBe(PASSED);
  expect(git(work, "diff", "HEAD", "--quiet").status).toBe(PASSED);
});

it("an amend, an allowed empty commit or a commit of every change may stage nothing", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const work = repo();

  expect(commit(work, "--quiet", "--amend", "-m", "reworded").status).toBe(PASSED);
  expect(commit(work, "--quiet", "--allow-empty", "-m", "empty").status).toBe(PASSED);
  expect(commit(work, "--quiet", "-a", "-m", "everything").status).toBe(PASSED);
});
