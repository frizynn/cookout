import { BRANCH, TICKET, git, repo, repos } from "./lib/merge-repos.ts";
import { expect, it } from "vitest";

const ONE_ATTEMPT = 1;
const ADRS = {
  ticket: {
    "docs/adr/0002-ticket.md": "# Ticket\n\nSee ADR 0002.\n",
    "notes.txt": "ticket: ADR 0002, adr/0002-ticket.md\n",
  },
  v1: { "docs/adr/0002-v1.md": "# v1\n", "v1.txt": "v1: ADR 0002\n" },
} as const;
const RENUMBERED = ["docs/adr/0001-base.md", "docs/adr/0002-v1.md", "docs/adr/0003-ticket.md"] as const;

function adrsOn(origin: string): readonly string[] {
  return git(origin, "ls-tree", "--name-only", "v1", "docs/adr/").split("\n");
}

it("renumbers a ticket's new ADR past v1's highest, and the references the ticket added", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  repo(other).push(ADRS.v1);
  repo(work).commit("the ticket", ADRS.ticket);

  const merged = repo(work).merge({});

  expect(merged).toStrictEqual({ attempts: ONE_ATTEMPT, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect([
    adrsOn(origin),
    git(origin, "show", "v1:docs/adr/0003-ticket.md"),
    git(origin, "show", "v1:notes.txt"),
    git(origin, "show", "v1:v1.txt"),
    git(origin, "log", "-1", "--format=%s", "v1"),
  ]).toStrictEqual([
    RENUMBERED,
    "# Ticket\n\nSee ADR 0003.",
    "ticket: ADR 0003, adr/0003-ticket.md",
    "v1: ADR 0002",
    `Merge ${BRANCH}: Add the c table (#${TICKET})`,
  ]);
});

it("renumbers a ticket's new ADR when it continues a merge resolved by hand", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  repo(other).push({ ...ADRS.v1, "notes.txt": "v1\n" });
  repo(work).commit("the ticket", ADRS.ticket);
  repo(work).merge({});
  repo(work).resolveByHand("ticket: ADR 0002, adr/0002-ticket.md\n");

  const merged = repo(work).continueMerge({});

  expect(merged).toStrictEqual({ attempts: ONE_ATTEMPT, ok: true, sha: git(origin, "rev-parse", "v1") });
  expect([adrsOn(origin), git(origin, "show", "v1:notes.txt")]).toStrictEqual([
    RENUMBERED,
    "ticket: ADR 0003, adr/0003-ticket.md",
  ]);
});
