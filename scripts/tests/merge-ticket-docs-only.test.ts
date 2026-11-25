import { DONE, stop } from "../lib/merge-steps.ts";
import { expect, it } from "vitest";
import { git, repo, repos } from "./lib/merge-repos.ts";
import type { Step } from "../lib/merge-steps.ts";

const ONE_RUN = 1;
const TWO_RUNS = 2;

interface MovingCi {
  readonly ci: (branch: string, sha: string) => Step;
  readonly runs: () => number;
}

function movingV1On1stRun(other: string, files: Readonly<Record<string, string>>): MovingCi {
  let runs = 0;
  return {
    ci: (): Step => {
      runs += ONE_RUN;
      if (runs === ONE_RUN) {
        repo(other).push(files);
      }
      return DONE;
    },
    runs: (): number => runs,
  };
}

it("fast-forwards v1 without another Check run when v1 moves after a green run of a docs-only ticket", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  repo(work).commit("the ticket", { ".changeset/c.md": "c\n", "README.md": "ticket\n", "docs/guide.txt": "g\n" });
  const { ci, runs } = movingV1On1stRun(other, { "src/b.txt": "b\n" });

  const merged = repo(work).merge({ ci });

  const sha = git(origin, "rev-parse", "v1");

  expect([
    merged,
    runs(),
    git(origin, "log", "-1", "--format=%s", "v1^1"),
    git(origin, "show", "v1:src/b.txt"),
  ]).toStrictEqual([{ attempts: TWO_RUNS, ok: true, sha }, ONE_RUN, "v1 moves on", "b"]);
});

it("runs CI again when v1 moves after a green run of a ticket that touches more than docs", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const { other, work } = repos();
  repo(work).commit("the ticket", { "README.md": "ticket\n", "src/c.txt": "c\n" });
  const { ci, runs } = movingV1On1stRun(other, { "docs/b.md": "b\n" });

  const merged = repo(work).merge({ ci });

  expect([merged.ok, runs()]).toStrictEqual([true, TWO_RUNS]);
});

it("stops when the moved v1 conflicts with a docs-only ticket, fast-forwarding nothing", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, other, work } = repos();
  repo(work).commit("the ticket", { "docs/guide.md": "ticket\n" });
  const { ci } = movingV1On1stRun(other, { "docs/guide.md": "v1\n" });

  const merged = repo(work).merge({ ci });

  expect([merged.ok, git(origin, "log", "-1", "--format=%s", "v1")]).toStrictEqual([false, "v1 moves on"]);
});

it("never fast-forwards a red run, docs-only or not", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  const before = git(origin, "rev-parse", "v1");
  repo(work).commit("the ticket", { "docs/guide.md": "ticket\n" });

  const merged = repo(work).merge({ ci: () => stop("red") });

  expect([merged.ok, git(origin, "rev-parse", "v1")]).toStrictEqual([false, before]);
});
