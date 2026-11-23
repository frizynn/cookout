import { expect, it, onTestFinished } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Step } from "../lib/merge-steps.ts";
import { ciGreen } from "../lib/ci-gate.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const URL = "https://github.com/o/r/actions/runs/42";
const RUN = [{ databaseId: 42 }];
const POLLS = 2;
const NO_WAITS = 0;
const ONE_WAIT = 1;
const COMPLETED = "completed";
const RUNNING = "in_progress";

const FAKE_GH = `
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
const state = JSON.parse(readFileSync(new URL("state.json", dir), "utf8"));
const [, verb] = process.argv.slice(2);
appendFileSync(new URL("calls.log", dir), process.argv.slice(2).join(" ") + "\\n");
const queue = state[verb] ?? [];
const next = queue.length > 1 ? queue.shift() : queue[0];
writeFileSync(new URL("state.json", dir), JSON.stringify(state));
if (next === "fail") {
  process.stderr.write("HTTP 502");
  process.exit(1);
}
process.stdout.write(JSON.stringify(next));
`;

interface Job {
  readonly conclusion: string;
  readonly name: string;
  readonly status: string;
}

interface Gated {
  readonly logs: readonly string[];
  readonly sleeps: number;
  readonly step: Step;
}

interface Fake {
  readonly calls: () => readonly string[];
  readonly gate: (args: readonly string[]) => Gated;
}

interface Responses {
  readonly list: readonly unknown[];
  readonly view: readonly unknown[];
}

function done(name: string, conclusion = "success"): Job {
  return { conclusion, name, status: COMPLETED };
}

function running(name: string): Job {
  return { conclusion: "", name, status: RUNNING };
}

function view(status: string, jobs: readonly Job[]): unknown {
  return { jobs, status, url: URL };
}

function fake(responses: Responses): Fake {
  const dir = mkdtempSync(path.join(tmpdir(), "ci-gate-"));
  onTestFinished(() => {
    rmSync(dir, { force: true, recursive: true });
  });
  writeFileSync(path.join(dir, "gh.mjs"), FAKE_GH);
  writeFileSync(path.join(dir, "state.json"), JSON.stringify(responses));
  writeFileSync(path.join(dir, "calls.log"), "");
  return {
    calls: (): readonly string[] => readFileSync(path.join(dir, "calls.log"), "utf8").trim().split("\n"),
    gate: (args): Gated => {
      const logs: string[] = [];
      const sleeps: string[] = [];
      const step = ciGreen({
        args,
        cwd: dir,
        gh: ["node", path.join(dir, "gh.mjs")],
        log: (line) => {
          logs.push(line);
        },
        polls: POLLS,
        sleep: () => {
          sleeps.push("slept");
        },
        subject: "v1",
      });
      return { logs, sleeps: sleeps.length, step };
    },
  };
}

function reasonOf(step: Step): string {
  if (step.kind === "stopped") {
    return step.reason;
  }
  return "green";
}

it("passes when the latest Check run has every job green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(COMPLETED, [done("lint"), done("e2e-docker")])] });

  const { logs, step } = gh.gate(["--branch", "v1"]);

  expect([step, logs]).toStrictEqual([{ kind: "done" }, [`v1's latest Check run is green: ${URL}`]]);
  expect(gh.calls()).toStrictEqual([
    "run list --workflow Check --event push --limit 1 --json databaseId --branch v1",
    "run view 42 --json status,url,jobs",
  ]);
});

it("refuses a red run, naming the failing jobs and the run", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(COMPLETED, [done("lint"), done("e2e-docker", "failure")])] });

  expect(reasonOf(gh.gate(["--branch", "v1"]).step)).toBe(
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}`,
  );
});

it("counts a skipped job as not green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(COMPLETED, [done("check"), done("e2e-docker", "skipped")])] });

  expect(reasonOf(gh.gate(["--branch", "ticket-7", "--commit", "abc"]).step)).toBe(
    `v1's latest Check run is red: e2e-docker (skipped).\n${URL}`,
  );
});

it("refuses a finished run with no jobs", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(COMPLETED, [])] });

  expect(reasonOf(gh.gate(["--branch", "v1"]).step)).toBe(`v1's latest Check run is red: the run (no jobs).\n${URL}`);
});

it("waits for a run still in progress, then passes once it is green", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({
    list: [RUN],
    view: [view(RUNNING, [done("lint"), running("e2e-docker")]), view(COMPLETED, [done("lint"), done("e2e-docker")])],
  });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([step, sleeps]).toStrictEqual([{ kind: "done" }, ONE_WAIT]);
});

it("refuses a run in progress as soon as one of its jobs has failed", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(RUNNING, [done("e2e-docker", "failure"), running("lint")])] });

  const { sleeps, step } = gh.gate(["--branch", "v1"]);

  expect([reasonOf(step), sleeps]).toStrictEqual([
    `v1's latest Check run is red: e2e-docker (failure).\n${URL}`,
    NO_WAITS,
  ]);
});

it("gives up on a run still in progress after the last wait", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const gh = fake({ list: [RUN], view: [view(RUNNING, [running("e2e-docker")])] });

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
