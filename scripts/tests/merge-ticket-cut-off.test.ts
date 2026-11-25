import { TICKET, git, repo, repos } from "./lib/merge-repos.ts";
import { expect, it } from "vitest";
import type { Step } from "../lib/merge-steps.ts";
import { stop } from "../lib/merge-steps.ts";

const MERGE_BRANCH = `merge-ticket-${TICKET}`;

it("stops on merge-ticket-N's run cut off at its time limit, keeping the cut-off jobs for the verdict", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const { origin, work } = repos();
  repo(work).commit("the ticket", { "notes.txt": "ticket\n" });
  const cut: Step = {
    ...stop("browser 2/3 was cut off at its time limit of 5 minutes."),
    cutOff: true,
    jobs: ["browser 2/3"],
  };

  const merged = repo(work).merge({ ci: () => cut });

  const sha = git(origin, "rev-parse", MERGE_BRANCH);

  expect(merged).toStrictEqual({
    cutOff: ["browser 2/3"],
    files: [],
    ok: false,
    reason: `browser 2/3 was cut off at its time limit of 5 minutes.\nThat Check run was on ${MERGE_BRANCH} at ${sha}.\nNothing was merged. The merge is on ${MERGE_BRANCH}: a rerun would hit the same limit, so make the job fit it, commit, then run pnpm merge-ticket ${TICKET} --continue.`,
  });
});
