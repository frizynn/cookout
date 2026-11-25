import { COMPLETED, RUNNING, URL as RUN_URL, done, ended, fake, running, view } from "./lib/fake-gh.ts";
import { expect, it } from "vitest";
import type { Landed } from "../lib/merge-queue.ts";
import type { Stopped } from "../lib/merge-steps.ts";
import { readFileSync } from "node:fs";

const PR = "https://github.com/o/r/pull/9";
const OPENED = [{ number: 9, url: PR }];
const QUEUE_BRANCH = "gh-readonly-queue/v1/pr-9-abc";
const FIRST_RUN = { databaseId: 50, headBranch: QUEUE_BRANCH, headSha: "abc" };
const SECOND_RUN = { databaseId: 51, headBranch: "gh-readonly-queue/v1/pr-9-def", headSha: "def" };
const LANDING = { branch: "merge-ticket-7", sha: "head7", title: "Merge ticket-7: Add the c table (#7)" };
const MERGED = { autoMergeRequest: null, mergeCommit: { oid: "m3rg3" }, state: "MERGED" };
const DEQUEUED = { autoMergeRequest: null, mergeCommit: null, state: "OPEN" };
const GREEN = view({ jobs: [done("lint"), done("checked")], status: COMPLETED });
const RED = view({
  jobs: [ended({ conclusion: "failure", failedStep: "pnpm check", name: "tests 1/2" }), done("lint")],
  status: COMPLETED,
});
const RERUNNING = view({ jobs: [running("tests 1/2"), done("lint")], status: RUNNING });
const ENQUEUE = "pr merge 9 --merge --auto --match-head-commit head7 --subject Merge ticket-7: Add the c table (#7)";
const TWICE = 2;
const ONCE = 1;
const FIRST = 0;

function recorded(name: string): string {
  return readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");
}

function reasonOf(landed: Landed | Stopped): string {
  if (landed.kind === "landed") {
    return `landed ${landed.sha}`;
  }
  return landed.reason;
}

function called(calls: readonly string[], prefix: string): readonly string[] {
  return calls.filter((call) => call.startsWith(prefix));
}

it("opens a pull request, enqueues it, and lands when the queue's merge_group run is green", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [[FIRST_RUN], [{ databaseId: 50 }]],
    "pr create": [PR],
    "pr list": [[], OPENED],
    "pr merge": [""],
    "pr view": [MERGED],
    view: [GREEN],
  });

  const { landed, logs } = gh.land(LANDING);

  expect(landed).toStrictEqual({ kind: "landed", sha: "m3rg3" });
  expect(logs).toStrictEqual([
    `Opened merge-ticket-7's pull request into v1: ${PR}`,
    `Enqueued ${PR} in v1's merge queue at head7.`,
    `Watching the merge queue's Check run of ${QUEUE_BRANCH}, run 50.`,
    "lint: success",
    "checked: success",
    `${QUEUE_BRANCH}'s latest Check run is green: ${RUN_URL}`,
  ]);
  expect([
    called(gh.calls(), "pr create"),
    called(gh.calls(), "pr merge"),
    called(gh.calls(), "run list"),
  ]).toStrictEqual([
    [
      "pr create --head merge-ticket-7 --base v1 --title Merge ticket-7: Add the c table (#7) --body Opened by `pnpm merge-ticket` to land merge-ticket-7 on v1 through the merge queue.",
    ],
    [ENQUEUE],
    [
      "run list --workflow Check --event merge_group --limit 20 --json databaseId,headBranch,headSha",
      `run list --workflow Check --event merge_group --limit 1 --json databaseId --branch ${QUEUE_BRANCH} --commit abc`,
    ],
  ]);
});

it("reuses merge-ticket-N's open pull request instead of opening another", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [[FIRST_RUN], [{ databaseId: 50 }]],
    "pr list": [OPENED],
    "pr merge": [""],
    "pr view": [MERGED],
    view: [GREEN],
  });

  const { landed, logs } = gh.land(LANDING);

  expect([landed, logs.at(FIRST), called(gh.calls(), "pr create")]).toStrictEqual([
    { kind: "landed", sha: "m3rg3" },
    `Reusing merge-ticket-7's pull request into v1: ${PR}`,
    [],
  ]);
});

it("names each failing test of a red queue run and its assertion, after rerunning its failed jobs once", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const log = recorded("ci-vitest-job.log");
  const gh = fake({
    list: [[FIRST_RUN], [{ databaseId: 50 }], []],
    log: [log],
    "pr list": [OPENED],
    "pr merge": [""],
    rerun: [""],
    view: [RED, RERUNNING, RED],
  });

  const { landed } = gh.land(LANDING);

  expect(reasonOf(landed)).toContain(
    [
      `${QUEUE_BRANCH}'s latest Check run is red: tests 1/2 (failure).\n${RUN_URL}`,
      "tests 1/2 failed steps: pnpm check",
      "Failing tests:",
      "  FAIL web app/modules/routes/tests/trigger-url.test.tsx > an agent whose trigger call fails shows Unreachable, and the owner's Clear takes the URL away",
      "    AssertionError: expected <p …(1)></p> to be null",
    ].join("\n"),
  );
  expect(reasonOf(landed)).toMatch(/\nIts failed jobs were rerun once and failed again\.$/u);
  expect([landed, called(gh.calls(), "run rerun"), called(gh.calls(), "pr view")]).toMatchObject([
    { jobs: ["tests 1/2"], kind: "stopped" },
    ["run rerun 50 --failed"],
    [],
  ]);
});

it("enqueues again when the red queue run goes green on its rerun, and lands on the new entry's green run", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fake({
    "api graphql": ["Required status check checked failed"],
    list: [[FIRST_RUN], [{ databaseId: 50 }], [], [SECOND_RUN, FIRST_RUN], [{ databaseId: 51 }]],
    log: ["boom"],
    "pr list": [OPENED],
    "pr merge": [""],
    "pr view": [DEQUEUED, MERGED],
    rerun: [""],
    view: [RED, RERUNNING, GREEN, GREEN],
  });

  const { landed, logs } = gh.land(LANDING);

  expect([landed, called(gh.calls(), "pr merge")]).toStrictEqual([
    { kind: "landed", sha: "m3rg3" },
    [ENQUEUE, ENQUEUE],
  ]);
  expect(logs).toStrictEqual(
    expect.arrayContaining([
      `${PR} left the merge queue without merging: Required status check checked failed.\nIts merge queue run went green on its rerun: enqueuing ${PR} again.`,
      "Watching the merge queue's Check run of gh-readonly-queue/v1/pr-9-def, run 51.",
    ]),
  );
  expect(called(gh.calls(), "run list")).toHaveLength(TWICE + TWICE + ONCE);
});

it("names GitHub's reason when the queue drops the pull request before any run, as on a conflict", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fake({
    "api graphql": ["The merge commit could not be created"],
    list: [[]],
    "pr list": [OPENED],
    "pr merge": [""],
    "pr view": [DEQUEUED],
    view: [],
  });

  const { landed } = gh.land(LANDING);

  expect([reasonOf(landed), called(gh.calls(), "pr merge").length]).toStrictEqual([
    `${PR} left the merge queue without merging: The merge commit could not be created.`,
    ONCE,
  ]);
});

it("merges the pull request directly, reading no queue run, while v1 has no merge queue", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [], "pr list": [OPENED], "pr merge": [""], "pr view": [MERGED], view: [] });

  const { landed, logs } = gh.land(LANDING, false);

  expect([landed, called(gh.calls(), "run list"), called(gh.calls(), "pr merge")]).toStrictEqual([
    { kind: "landed", sha: "m3rg3" },
    [],
    ["pr merge 9 --merge --match-head-commit head7 --subject Merge ticket-7: Add the c table (#7)"],
  ]);
  expect(logs).toContain(`v1 has no merge queue yet: merging ${PR} at head7 directly, as its Check run is green.`);
});

it("lands once gh pr merge succeeds, reading the pull request only with fields gh knows (#564)", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fake({ list: [], "pr list": [OPENED], "pr merge": [""], "pr view": [MERGED], view: [] });

  const { landed } = gh.land(LANDING, false);

  expect([landed, called(gh.calls(), "pr view")]).toStrictEqual([
    { kind: "landed", sha: "m3rg3" },
    ["pr view 9 --json state,mergeCommit,autoMergeRequest"],
  ]);
});

it("stops, naming the command, when the pull request cannot be enqueued", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [], "pr list": [OPENED], "pr merge": ["fail"], view: [] });

  expect(reasonOf(gh.land(LANDING).landed)).toBe(
    `Could not enqueue ${PR}: gh pr merge 9 --merge --auto --match-head-commit head7\nHTTP 502`,
  );
});

const RULES = "api repos/{owner}/{repo}/rules/branches/v1";

it.each<{ readonly name: string; readonly output: string; readonly required: boolean }>([
  { name: "a merge_queue rule", output: "1", required: true },
  { name: "no merge_queue rule", output: "0", required: false },
])("reads v1 as requiring the merge queue when its rules hold $name", { timeout: 10_000 }, ({ output, required }) => {
  expect.hasAssertions();

  const gh = fake({ [RULES]: [output], list: [], view: [] });

  expect([gh.required(), gh.calls()]).toStrictEqual([
    { logs: [], required },
    [`${RULES} --jq [.[] | select(.type == "merge_queue")] | length`],
  ]);
});

it("lands as if v1 had no merge queue, and says so, when v1's rules cannot be read", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ [RULES]: ["fail"], list: [], view: [] });

  expect(gh.required()).toStrictEqual({
    logs: [
      "Could not read v1's rules (gh api repos/{owner}/{repo}/rules/branches/v1), so landing as if v1 had no merge queue.\nHTTP 502",
    ],
    required: false,
  });
});
