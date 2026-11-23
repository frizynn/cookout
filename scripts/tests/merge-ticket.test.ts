import { ATTEMPTS, BRANCH, FLOOR, TICKET, floor, generated, git, migrations, repo, repos } from "./lib/merge-repos.ts";
import { expect, it } from "vitest";
import type { Merged } from "../lib/merge-ticket.ts";
import { existsSync } from "node:fs";
import path from "node:path";

const ONE_ATTEMPT = 1;
const TWO_ATTEMPTS = 2;
const MERGE_PARENTS = 2;

function moveV1(other: string, marker: string): string {
  return `git -C ${other} commit -q --allow-empty -m moved && git -C ${other} push -q origin HEAD:v1 && touch ${marker}`;
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
  repo(other).push({
    "floor.ts": floor(FLOOR.v1),
    "gen/out.txt": generated("a", "b"),
    "migrations.ts": migrations("a", "b"),
    "src/b.txt": "b\n",
  });
  repo(work).commit("the ticket", {
    "floor.ts": floor(FLOOR.ticket),
    "gen/out.txt": generated("a", "c"),
    "migrations.ts": migrations("a", "c"),
    "pnpm-lock.yaml": "ticket\n",
    "src/c.txt": "c\n",
  });
  const installed = path.join(root, "installed");

  const merged = repo(work).merge({ install: ["touch", installed] });

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
  repo(other).push({ "migrations.ts": migrations("other"), "notes.txt": "v1\n" });
  const before = git(origin, "rev-parse", "v1");
  repo(work).commit("the ticket", files);

  const merged = repo(work).merge({ check: ["false"] });

  expect(filesOf(merged)).toStrictEqual(Object.keys(files));
  expect(reason(merged)).toContain(`the coverage floor:\n  ${Object.keys(files).join("")}\nNothing was pushed.`);
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});

it("merges again onto v1 when v1 moved before the push", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });
  const moved = path.join(root, "moved");

  const merged = repo(work).merge({ check: ["sh", "-c", `test -f ${moved} || { ${moveV1(other, moved)}; }`] });

  expect(merged).toStrictEqual({ attempts: TWO_ATTEMPTS, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect(git(origin, "log", "--format=%s", "v1")).toContain("moved");
});

it("gives up after its attempts when v1 keeps moving", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });

  const merged = repo(work).merge({ check: ["sh", "-c", moveV1(other, path.join(root, "moved"))] });

  expect(reason(merged)).toContain(`gave up after ${ATTEMPTS} attempts`);
  expect(git(origin, "log", "--format=%s", "v1")).not.toContain(`Merge ${BRANCH}`);
});

it("pushes nothing when the check fails", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  const before = git(origin, "rev-parse", "v1");
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });

  const merged = repo(work).merge({ check: ["false"] });

  expect(reason(merged)).toContain("false failed; nothing was pushed");
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});

it("continues a merge resolved by hand: checks it and pushes it to v1", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  repo(other).push({ "notes.txt": "v1\n" });
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });
  repo(work).merge({});
  repo(work).resolveByHand("both\n");

  const merged = repo(work).continueMerge({});

  expect(merged).toStrictEqual({ attempts: ONE_ATTEMPT, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect([git(origin, "show", "v1:notes.txt"), git(origin, "log", "-1", "--format=%s", "v1")]).toStrictEqual([
    "both",
    `Merge ${BRANCH}: Add the c table (#${TICKET})`,
  ]);
});

it("continues a merge resolved by hand when v1 moved, reusing the resolution", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  repo(other).push({ "notes.txt": "v1\n" });
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });
  repo(work).merge({});
  repo(work).resolveByHand("both\n");
  const moved = path.join(root, "moved");

  const merged = repo(work).continueMerge({ check: ["sh", "-c", `test -f ${moved} || { ${moveV1(other, moved)}; }`] });

  expect(merged).toStrictEqual({ attempts: TWO_ATTEMPTS, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect([git(origin, "show", "v1:notes.txt"), git(origin, "log", "--format=%s", "v1")]).toStrictEqual([
    "both",
    expect.stringContaining("moved"),
  ]);
});

it("refuses to continue when the branch holds no merge", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  const before = git(origin, "rev-parse", "v1");
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });

  const merged = repo(work).continueMerge({});

  expect(reason(merged)).toContain(`not on merge-ticket-${TICKET}`);
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});
