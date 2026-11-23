import { TICKET, git, migrations, repo, repos } from "./lib/merge-repos.ts";
import { expect, it } from "vitest";
import type { Merged } from "../lib/merge-ticket.ts";
import path from "node:path";
import { writeFileSync } from "node:fs";

const TWO_ATTEMPTS = 2;

function refusal(merged: Merged): { readonly files: readonly string[]; readonly reason: string } {
  if (merged.ok) {
    return { files: [], reason: "merged" };
  }
  return { files: merged.files, reason: merged.reason };
}

it("refuses a merge that inserts a migration before one v1 already has, naming the index", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  const before = git(origin, "rev-parse", "v1");
  repo(work).commit("the ticket", { "migrations.ts": migrations("c", "a") });

  const { files, reason } = refusal(repo(work).merge({}));

  expect(files).toStrictEqual(["migrations.ts"]);
  expect(reason).toContain(
    "migrations.ts: the migrations list must begin with origin/v1's, entry for entry, but index 0 (schema version 1) differs",
  );
  expect(reason).toContain(`Nothing was pushed. The merge is on merge-ticket-${TICKET}`);
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});

it("puts v1's new migrations before the ticket's when v1 moved before the push", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, root, work } = repos();
  repo(work).commit("the ticket", { "migrations.ts": migrations("a", "c") });
  const moved = path.join(root, "moved");
  const v1Migrations = path.join(root, "v1-migrations.ts");
  writeFileSync(v1Migrations, migrations("a", "b"));
  const moveV1 = [
    `cp ${v1Migrations} ${other}/migrations.ts`,
    `git -C ${other} commit -q -am moved`,
    `git -C ${other} push -q origin HEAD:v1`,
    `touch ${moved}`,
  ].join(" && ");

  const merged = repo(work).merge({ check: ["sh", "-c", `test -f ${moved} || { ${moveV1}; }`] });

  expect(merged).toStrictEqual({ attempts: TWO_ATTEMPTS, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect(git(origin, "show", "v1:migrations.ts")).toBe(migrations("a", "b", "c").trim());
});
