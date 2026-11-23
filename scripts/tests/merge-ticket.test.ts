import type { MergeRules, Merged } from "../lib/merge-ticket.ts";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { expect, it, onTestFinished } from "vitest";
import { execFileSync } from "node:child_process";
import { mergeTicket } from "../lib/merge-ticket.ts";
import path from "node:path";
import { tmpdir } from "node:os";

interface Repos {
  readonly origin: string;
  readonly other: string;
  readonly root: string;
  readonly work: string;
}

interface Overrides {
  readonly check?: readonly string[];
  readonly install?: readonly string[];
}

const TICKET = 7;
const BRANCH = `ticket-${TICKET}`;
const ONE_ATTEMPT = 1;
const TWO_ATTEMPTS = 2;
const ATTEMPTS = 3;
const MERGE_PARENTS = 2;
const FLOOR = { base: ["90", "95"], merged: ["91", "94"], ticket: ["92", "94"], v1: ["91", "95"] } as const;

const rules: MergeRules = {
  hunks: [
    { file: "migrations.ts", resolve: "append" },
    { file: "floor.ts", resolve: "lower" },
  ],
  regenerate: [{ command: ["sh", "-c", "cat src/*.txt > gen/out.txt"], files: "^gen/" }],
};

function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function commit(dir: string, message: string, files: Readonly<Record<string, string>>): void {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
}

function generated(...sources: readonly string[]): string {
  return sources.map((source) => `${source}\n`).join("");
}

function migrations(...entries: readonly string[]): string {
  const listed = entries.map((entry) => `  \`CREATE TABLE ${entry} (\n     id TEXT\n   ) STRICT;\`,\n`).join("");
  return `const migrations = [\n${listed}];\n`;
}

function floor([branches, lines]: readonly [string, string]): string {
  return `export default {\n  thresholds: {\n    branches: ${branches},\n    lines: ${lines},\n  },\n};\n`;
}

function clone(root: string, origin: string, name: string): string {
  const dir = path.join(root, name);
  git(root, "init", "-q", "-b", "v1", dir);
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "remote", "add", "origin", origin);
  return dir;
}

function temporaryRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "merge-ticket-"));
  onTestFinished(() => {
    rmSync(root, { force: true, recursive: true });
  });
  return root;
}

function bareOrigin(root: string): string {
  const origin = path.join(root, "origin.git");
  git(root, "init", "-q", "--bare", "-b", "v1", origin);
  return origin;
}

function pushToV1(other: string, files: Readonly<Record<string, string>>): void {
  commit(other, "v1 moves on", files);
  git(other, "push", "-q", "origin", "v1");
}

function repos(): Repos {
  const root = temporaryRoot();
  const origin = bareOrigin(root);
  const work = clone(root, origin, "work");
  const other = clone(root, origin, "other");
  const base = { "floor.ts": floor(FLOOR.base), "gen/out.txt": generated("a"), "migrations.ts": migrations("a") };
  commit(work, "base", { ...base, "notes.txt": "base\n", "pnpm-lock.yaml": "base\n", "src/a.txt": "a\n" });
  git(work, "push", "-q", "origin", "v1");
  git(other, "pull", "-q", "origin", "v1");
  git(work, "checkout", "-q", "-b", BRANCH);
  return { origin, other, root, work };
}

function moveV1(other: string, marker: string): string {
  return `git -C ${other} commit -q --allow-empty -m moved && git -C ${other} push -q origin HEAD:v1 && touch ${marker}`;
}

function runMerge(work: string, overrides: Overrides): Merged {
  const logged: string[] = [];
  return mergeTicket({
    attempts: ATTEMPTS,
    check: overrides.check ?? ["true"],
    cwd: work,
    install: overrides.install ?? ["true"],
    log: (line): void => {
      logged.push(line);
    },
    rules,
    ticket: TICKET,
    title: "Add the c table",
  });
}

function reason(merged: Merged): string {
  if (merged.ok) {
    return "merged";
  }
  return merged.reason;
}

function filesOf(merged: Merged): readonly string[] {
  if (merged.ok) {
    return [];
  }
  return merged.files;
}

it("merges a ticket whose only conflicts are generated files, a migration number and the coverage floor", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  pushToV1(other, {
    "floor.ts": floor(FLOOR.v1),
    "gen/out.txt": generated("a", "b"),
    "migrations.ts": migrations("a", "b"),
    "src/b.txt": "b\n",
  });
  commit(work, "the ticket", {
    "floor.ts": floor(FLOOR.ticket),
    "gen/out.txt": generated("a", "c"),
    "migrations.ts": migrations("a", "c"),
    "pnpm-lock.yaml": "ticket\n",
    "src/c.txt": "c\n",
  });
  const installed = path.join(root, "installed");

  const merged = runMerge(work, { install: ["touch", installed] });

  expect(merged).toStrictEqual({ attempts: ONE_ATTEMPT, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect([
    git(origin, "log", "-1", "--format=%s", "v1"),
    git(origin, "log", "-1", "--format=%P", "v1").split(" ").length,
  ]).toStrictEqual([`Merge ${BRANCH}: Add the c table (#${TICKET})`, MERGE_PARENTS]);
  expect([
    git(origin, "show", "v1:migrations.ts"),
    git(origin, "show", "v1:gen/out.txt"),
    git(origin, "show", "v1:floor.ts"),
  ]).toStrictEqual([migrations("a", "b", "c").trim(), generated("a", "b", "c").trim(), floor(FLOOR.merged).trim()]);
  expect(existsSync(installed)).toBe(true);
});

it.each<{ readonly files: Readonly<Record<string, string>>; readonly name: string }>([
  { files: { "notes.txt": "ticket\n" }, name: "a hand-written file" },
  { files: { "migrations.ts": migrations("changed") }, name: "a shipped migration" },
])("stops on a conflict in $name, lists the files and pushes nothing", { timeout: 10_000 }, ({ files }) => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  pushToV1(other, { "migrations.ts": migrations("other"), "notes.txt": "v1\n" });
  const before = git(origin, "rev-parse", "v1");
  commit(work, "the ticket", files);

  const merged = runMerge(work, { check: ["false"] });

  expect(filesOf(merged)).toStrictEqual(Object.keys(files));
  expect(reason(merged)).toContain(`the coverage floor:\n  ${Object.keys(files).join("")}\nNothing was pushed.`);
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});

it("merges again onto v1 when v1 moved before the push", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  commit(work, "the ticket", { "notes.txt": "ticket\n" });
  const moved = path.join(root, "moved");

  const merged = runMerge(work, { check: ["sh", "-c", `test -f ${moved} || { ${moveV1(other, moved)}; }`] });

  expect(merged).toStrictEqual({ attempts: TWO_ATTEMPTS, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect(git(origin, "log", "--format=%s", "v1")).toContain("moved");
});

it("gives up after its attempts when v1 keeps moving", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  commit(work, "the ticket", { "notes.txt": "ticket\n" });

  const merged = runMerge(work, { check: ["sh", "-c", moveV1(other, path.join(root, "moved"))] });

  expect(reason(merged)).toContain(`gave up after ${ATTEMPTS} attempts`);
  expect(git(origin, "log", "--format=%s", "v1")).not.toContain(`Merge ${BRANCH}`);
});

it("pushes nothing when the check fails", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  const before = git(origin, "rev-parse", "v1");
  commit(work, "the ticket", { "notes.txt": "ticket\n" });

  const merged = runMerge(work, { check: ["false"] });

  expect(reason(merged)).toContain("false failed; nothing was pushed");
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});
