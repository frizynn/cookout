import { expect, it } from "vitest";
import { adrEdits } from "../lib/adr-append-only.ts";

function changed(file: string, hunk: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    "index 1111111..2222222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -2,0 +3,2 @@",
    hunk,
  ].join("\n");
}

const ADR = "docs/adr/0004-a-lease.md";

it("passes the dated notes existing ADRs already carry", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const notes = [
    "+Superseded by [ADR 0042](0042-agent-session-tokens-replace-the-lease.md): there is no lease.",
    "+",
    "+Superseded in part by [ADR 0028](0028-only-agent-identities-take-the-lease.md): agents only.",
    "+Superseded in its lease parts by [ADR 0042](0042-agent-session-tokens-replace-the-lease.md): no lease.",
    "+Superseded on 2026-11-23 by [ADR 0050](0050-the-cli-is-published-to-npm.md): the CLI is published.",
    "+_Superseded by ADR 0051._",
    "+Confirmed by Matt on 2026-11-24 (mattpocock/cookout#200).",
    "+2026-11-23: Matt confirmed all three assumptions below (mattpocock/cookout#134).",
    "+More than one admin, and who may make one: [ADR 0037](0037-any-admin-can-make-any-human-an-admin.md).",
    "+[ADR 0039](0039-cookout-admin-name-names-the-admin-token-identity.md) lets `COOKOUT_ADMIN_NAME` name it.",
  ].join("\n");

  expect(adrEdits({ diff: changed(ADR, notes), locked: new Set([ADR]), originals: new Map() })).toStrictEqual([]);
});

it("names the ADR and the line when an existing ADR gains other text or loses a line", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const hunk = ["-- Inbox rows keep their plain-text preview.", "+- One-line previews show a plain-text summary."].join(
    "\n",
  );

  const originals = new Map([[ADR, ["- Inbox rows keep their plain-text preview."]]]);

  expect(adrEdits({ diff: changed(ADR, hunk), locked: new Set([ADR]), originals })).toStrictEqual([
    `${ADR} is append-only, but this change removes the line "- Inbox rows keep their plain-text preview.". Write a new ADR and add a dated line here, such as "Superseded in part on YYYY-MM-DD by [ADR NNNN](…): …".`,
    `${ADR} is append-only, but this change adds the line "- One-line previews show a plain-text summary.", which is not a dated note. Write a new ADR and add a dated line here, such as "Superseded in part on YYYY-MM-DD by [ADR NNNN](…): …".`,
  ]);
});

it("passes a new ADR, renumbered or not, and fails a deleted one", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const diff = [
    "diff --git a/docs/adr/0053-new.md b/docs/adr/0053-new.md",
    "new file mode 100644",
    "index 0000000..3333333",
    "--- /dev/null",
    "+++ b/docs/adr/0053-new.md",
    "@@ -0,0 +1,2 @@",
    "+# Anything at all",
    "+--- a horizontal rule, not a header",
    "diff --git a/docs/adr/0001-old.md b/docs/adr/0001-old.md",
    "deleted file mode 100644",
    "index 4444444..0000000",
    "--- a/docs/adr/0001-old.md",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-# Old",
  ].join("\n");

  expect(
    adrEdits({ diff, locked: new Set(["docs/adr/0001-old.md", "docs/adr/0053-new.md"]), originals: new Map() }),
  ).toStrictEqual([
    "docs/adr/0001-old.md is append-only, but this change deletes it. Restore it, and mark it superseded with a dated line instead.",
  ]);
});

it("passes putting back an ADR's original text over an edit made in place", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const hunk = ["-- One-line previews show a plain-text summary.", "+- Inbox rows keep their plain-text preview."].join(
    "\n",
  );
  const originals = new Map([[ADR, ["# A lease", "", "- Inbox rows keep their plain-text preview."]]]);

  expect(adrEdits({ diff: changed(ADR, hunk), locked: new Set([ADR]), originals })).toStrictEqual([]);
});

const BRANCH_NEW = "docs/adr/0060-added-on-this-branch.md";
const REWRITE = ["-# A first draft", "+# A second draft"].join("\n");
const DELETION = [
  `diff --git a/${BRANCH_NEW} b/${BRANCH_NEW}`,
  "deleted file mode 100644",
  "index 4444444..0000000",
  `--- a/${BRANCH_NEW}`,
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-# A second draft",
].join("\n");

it("passes rewriting or deleting an ADR that is not on v1 yet", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const originals = new Map([[BRANCH_NEW, ["# A first draft"]]]);

  expect([
    adrEdits({ diff: changed(BRANCH_NEW, REWRITE), locked: new Set([ADR]), originals }),
    adrEdits({ diff: DELETION, locked: new Set([ADR]), originals }),
  ]).toStrictEqual([[], []]);
});

it("fails rewriting an ADR that is on v1", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const originals = new Map([[BRANCH_NEW, ["# A first draft"]]]);

  expect(adrEdits({ diff: changed(BRANCH_NEW, REWRITE), locked: new Set([BRANCH_NEW]), originals })).toStrictEqual([
    `${BRANCH_NEW} is append-only, but this change removes the line "# A first draft". Write a new ADR and add a dated line here, such as "Superseded in part on YYYY-MM-DD by [ADR NNNN](…): …".`,
    `${BRANCH_NEW} is append-only, but this change adds the line "# A second draft", which is not a dated note. Write a new ADR and add a dated line here, such as "Superseded in part on YYYY-MM-DD by [ADR NNNN](…): …".`,
  ]);
});
