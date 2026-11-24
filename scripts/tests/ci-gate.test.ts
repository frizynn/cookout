import {
  COMPLETED,
  E2E_STEPS,
  NO_WAITS,
  ONE_WAIT,
  POLLS,
  RUN,
  RUNNING,
  URL,
  done,
  ended,
  fake,
  reasonOf,
  running,
  view,
} from "./lib/fake-gh.ts";
import { expect, it } from "vitest";
import type { Responses } from "./lib/fake-gh.ts";

const LAST_TWO = -2;

it("passes when the latest Check run has every job green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view({ jobs: [done("lint"), done("e2e-docker")], status: COMPLETED })] });

  const { logs, step } = gh.gate(["--branch", "v1"]);

  expect([step, logs]).toStrictEqual([
    { kind: "done" },
    ["lint: success", "e2e-docker: success", `v1's latest Check run is green: ${URL}`],
  ]);
  expect(gh.calls()).toStrictEqual([
    "run list --workflow Check --event push --limit 1 --json databaseId --branch v1",
    "run view 42 --json status,conclusion,url,jobs",
  ]);
});

it("refuses a red run, naming the failing jobs and the run", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN],
    view: [
      view({
        jobs: [done("lint"), ended({ conclusion: "failure", failedStep: "pnpm check", name: "e2e-docker" })],
        status: COMPLETED,
      }),
    ],
  });

  expect(reasonOf(gh.gate(["--branch", "v1"]).step)).toBe(
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}${E2E_STEPS}`,
  );
});

it("counts a skipped job as not green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN],
    view: [
      view({
        jobs: [done("check"), ended({ conclusion: "skipped", failedStep: "pnpm check", name: "e2e-docker" })],
        status: COMPLETED,
      }),
    ],
  });

  expect(reasonOf(gh.gate(["--branch", "ticket-7", "--commit", "abc"]).step)).toBe(
    `v1's latest Check run is red: e2e-docker (skipped).\n${URL}\ne2e-docker failed steps: none named`,
  );
});

it("refuses a finished run with no jobs", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view({ jobs: [], status: COMPLETED })] });

  expect(reasonOf(gh.gate(["--branch", "v1"]).step)).toBe(`v1's latest Check run is red: the run (no jobs).\n${URL}`);
});

it("waits for a run still in progress, then passes once it is green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN],
    view: [
      view({ jobs: [done("lint"), running("e2e-docker")], status: RUNNING }),
      view({ jobs: [done("lint"), done("e2e-docker")], status: COMPLETED }),
    ],
  });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([step, sleeps]).toStrictEqual([{ kind: "done" }, ONE_WAIT]);
});

it("refuses a run in progress as soon as one of its jobs has failed", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN],
    view: [
      view({
        jobs: [ended({ conclusion: "failure", failedStep: "pnpm check", name: "e2e-docker" }), running("lint")],
        status: RUNNING,
      }),
    ],
  });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([reasonOf(step), sleeps]).toStrictEqual([
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}${E2E_STEPS}`,
    NO_WAITS,
  ]);
});

it("gives up on a run still in progress after the last wait", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view({ jobs: [running("e2e-docker")], status: RUNNING })] });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([reasonOf(step), sleeps]).toStrictEqual([
    `v1's latest Check run was still running after ${POLLS} waits: ${URL}`,
    POLLS,
  ]);
});

it("refuses when there is no Check run to read", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [[]], view: [] });

  expect(reasonOf(gh.gate(["--branch", "ticket-7", "--commit", "abc"]).step)).toBe(
    "v1 has no Check push run: run list --workflow Check --event push --limit 1 --json databaseId --branch ticket-7 --commit abc",
  );
});

it.each<Responses & { readonly name: string }>([
  { list: ["fail"], name: "listing runs fails", view: [] },
  { list: [RUN], name: "reading the run fails", view: ["fail"] },
  { list: [{}], name: "listing runs returns no list", view: [] },
  { list: [RUN], name: "reading the run returns no jobs", view: [{ status: COMPLETED }] },
])("refuses when $name", { timeout: 10_000 }, (responses) => {
  expect.hasAssertions();

  const gh = fake(responses);

  expect(reasonOf(gh.gate(["--branch", "v1"]).step)).toMatch(/^Could not read v1's Check run: gh run /u);
});

const BASE = ["--branch", "v1", "--commit", "base"];
const BASE_URL = "https://github.com/o/r/actions/runs/41";
const BASE_RUN = [{ databaseId: 41 }];
const TICKET = ["--branch", "ticket-7", "--commit", "abc"];
const TICKET_RED = view({
  jobs: [done("lint"), ended({ conclusion: "failure", failedStep: "pnpm check", name: "e2e-docker" })],
  status: COMPLETED,
});

it("says the base was red when the same jobs failed on v1's run for the merge-base", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN, BASE_RUN],
    view: [
      TICKET_RED,
      view({
        jobs: [ended({ conclusion: "failure", failedStep: "pnpm check", name: "e2e-docker" })],
        status: COMPLETED,
        url: BASE_URL,
      }),
    ],
  });

  expect(reasonOf(gh.gate(TICKET, BASE).step)).toBe(
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}${E2E_STEPS}\nThe same jobs failed on v1's Check run for v1's merge-base: ${BASE_URL}\nYour base was red; merge the current green v1 into v1 (git merge origin/v1), push, and rerun merge-ticket.`,
  );
  expect(gh.calls().slice(LAST_TWO)).toStrictEqual([
    "run list --workflow Check --event push --limit 1 --json databaseId --branch v1 --commit base",
    "run view 41 --json status,conclusion,url,jobs",
  ]);
});

it.each<Responses & { readonly name: string }>([
  {
    list: [RUN, BASE_RUN],
    name: "the base run was green",
    view: [TICKET_RED, view({ jobs: [done("e2e-docker")], status: COMPLETED })],
  },
  { list: [RUN, []], name: "the base has no run", view: [TICKET_RED] },
  { list: [RUN, BASE_RUN], name: "the base run cannot be read", view: [TICKET_RED, "fail"] },
])("blames the ticket alone when $name", { timeout: 10_000 }, (responses) => {
  expect.hasAssertions();

  const gh = fake(responses);

  expect(reasonOf(gh.gate(TICKET, BASE).step)).toBe(
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}${E2E_STEPS}`,
  );
});

const MERGE_URL = "https://github.com/o/r/actions/runs/40";
const ON_COMMIT = [
  { databaseId: 42, headBranch: "v1" },
  { databaseId: 40, headBranch: "merge-ticket-7" },
];
const V1_RUNNING = view({ jobs: [done("lint"), running("e2e-docker")], status: RUNNING });
const HEAD = { headSha: "abc" };
const VOUCHED_BY = "merge-ticket-";

it("counts a v1 run still in progress as green when the same commit's merge-ticket run is green", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN, ON_COMMIT],
    view: [V1_RUNNING, HEAD, view({ jobs: [done("lint"), done("e2e-docker")], status: COMPLETED, url: MERGE_URL })],
    vouchedBy: VOUCHED_BY,
  });

  const { logs, sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([step, sleeps, logs]).toStrictEqual([
    { kind: "done" },
    NO_WAITS,
    [
      `v1's latest Check run is still running, but merge-ticket-7's Check run on the same commit is green: ${MERGE_URL}`,
    ],
  ]);
  expect(gh.calls()).toStrictEqual([
    "run list --workflow Check --event push --limit 1 --json databaseId --branch v1",
    "run view 42 --json status,conclusion,url,jobs",
    "run view 42 --json headSha",
    "run list --workflow Check --event push --json databaseId,headBranch --commit abc",
    "run view 40 --json status,conclusion,url,jobs",
  ]);
});

it.each<Responses & { readonly name: string }>([
  {
    list: [RUN, [{ databaseId: 42, headBranch: "v1" }]],
    name: "the commit has no merge-ticket run",
    view: [V1_RUNNING, HEAD, V1_RUNNING],
  },
  {
    list: [RUN, ON_COMMIT],
    name: "the merge-ticket run is not green",
    view: [V1_RUNNING, HEAD, view({ jobs: [running("e2e-docker")], status: RUNNING }), V1_RUNNING],
  },
  { list: [RUN, ON_COMMIT], name: "the run's commit cannot be read", view: [V1_RUNNING, "fail", V1_RUNNING] },
  { list: [RUN, "fail"], name: "the commit's runs cannot be listed", view: [V1_RUNNING, HEAD, V1_RUNNING] },
])("waits for a v1 run still in progress when $name", { timeout: 10_000 }, (responses) => {
  expect.hasAssertions();

  const gh = fake({ ...responses, vouchedBy: VOUCHED_BY });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([reasonOf(step), sleeps]).toStrictEqual([
    `v1's latest Check run was still running after ${POLLS} waits: ${URL}`,
    POLLS,
  ]);
});
