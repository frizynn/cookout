import { execFileSync, spawnSync } from "node:child_process";
import { expect, it, onTestFinished } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = path.resolve("scripts/hygiene.ts");
const MIGRATIONS = "app/modules/storage/lib/server/migrations.ts";
const PASSED = 0;
const FAILED = 1;
const MINUTE = 60;
const clock = { now: 1_700_000_000 };

interface Run {
  readonly status: number | null;
  readonly stderr: string;
}

function git(dir: string, ...args: readonly string[]): string {
  clock.now += MINUTE;
  const date = `@${clock.now} +0000`;
  return execFileSync("env", [`GIT_AUTHOR_DATE=${date}`, `GIT_COMMITTER_DATE=${date}`, "git", ...args], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(dir: string, file: string, content: string): void {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), content);
}

function migrations(entries: readonly string[]): string {
  return `const migrations = [\n${entries.map((entry) => `  \`CREATE TABLE ${entry} (id TEXT) STRICT;\`,\n`).join("")}];\n`;
}

function commit(dir: string, file: string, content: string): void {
  write(dir, file, content);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", file);
}

function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hygiene-"));
  onTestFinished(() => {
    rmSync(dir, { force: true, recursive: true });
  });
  git(dir, "init", "-q", "-b", "v1");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "commit.gpgsign", "false");
  write(dir, "pnpm-workspace.yaml", "packages: []\n");
  write(dir, "README.md", "# Test\n");
  write(dir, ".env.example", "");
  return dir;
}

function deployedTwice(): { readonly dir: string; readonly first: string } {
  const dir = repo();
  commit(dir, MIGRATIONS, migrations(["a"]));
  git(dir, "tag", "deploy/first");
  const first = git(dir, "rev-parse", "HEAD");
  commit(dir, MIGRATIONS, migrations(["a", "b"]));
  git(dir, "tag", "deploy/second");
  git(dir, "update-ref", "refs/remotes/origin/v1", "v1");
  return { dir, first };
}

function hygiene(dir: string): Run {
  const run = spawnSync("node", [SCRIPT], { cwd: dir, encoding: "utf8" });
  return { status: run.status, stderr: run.stderr };
}

it("passes a branch cut before the newest deploy that changed no migrations", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { dir, first } = deployedTwice();
  git(dir, "checkout", "-q", "-b", "ticket-1", first);
  commit(dir, "ticket.txt", "work\n");

  expect(hygiene(dir)).toStrictEqual({ status: PASSED, stderr: "" });
});

it("refuses a branch that contains no deploy tag", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const dir = repo();
  commit(dir, MIGRATIONS, migrations(["a"]));
  git(dir, "update-ref", "refs/remotes/origin/v1", "v1");
  commit(dir, "ticket.txt", "work\n");
  const run = hygiene(dir);

  expect(run.status).toBe(FAILED);
  expect(run.stderr).toContain("hygiene: found no deploy/* tag that HEAD contains");
});

it("refuses a migration inserted mid-list on a branch that contains the newest deploy", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { dir } = deployedTwice();
  commit(dir, MIGRATIONS, migrations(["a", "c", "b"]));
  const run = hygiene(dir);

  expect(run.status).toBe(FAILED);
  expect(run.stderr).toContain(
    `hygiene: ${MIGRATIONS}: the migrations list must begin with deploy/second's, entry for entry, but index 1 (schema version 2) differs`,
  );
});
