import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Outcome } from "../lib/tools.ts";
import { browserShardPlan } from "../lib/browser-shards.ts";
import path from "node:path";

const DIR = "app/modules/routes/tests/browser";
const RUN = "900";
const ASKED_AT = "2026-11-25T10:00:00Z";
const EARLIER = "2026-11-25T09:00:00Z";
const LATER = "2026-11-25T10:05:00Z";
const MS = 1000;
const LAST = -1;
const NAME = 4;

interface ArtifactAt {
  readonly createdAt: string;
  readonly expired?: boolean;
  readonly name: string;
  readonly run: number;
}

type Seconds = Readonly<Record<string, number>>;

function file(name: string): string {
  return `${DIR}/${name}.browser.test.ts`;
}

function reportOf(seconds: Seconds): string {
  const suites = Object.entries(seconds).map(([name, took]: readonly [string, number]) => ({
    file: `${name}.browser.test.ts`,
    specs: [{ tests: [{ results: [{ duration: took * MS }] }] }],
  }));
  return JSON.stringify({ suites });
}

function listing(artifacts: readonly ArtifactAt[]): string {
  return JSON.stringify({
    artifacts: artifacts.map(({ createdAt, expired = false, name, run }) => ({
      created_at: createdAt,
      expired,
      name,
      workflow_run: { id: run },
    })),
  });
}

interface FakeCi {
  readonly artifacts: readonly ArtifactAt[];
  readonly reports: Readonly<Record<string, Seconds>>;
}

function download(args: readonly string[], reports: FakeCi["reports"]): Outcome<string> {
  const dir = path.join(args.at(LAST) ?? "", ".timings");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "browser.json"), reportOf(reports[args[NAME] ?? ""] ?? {}));
  return { ok: true, value: "" };
}

function api(target: string, artifacts: FakeCi["artifacts"]): Outcome<string> {
  if (target.endsWith(`/runs/${RUN}`)) {
    return { ok: true, value: JSON.stringify({ created_at: ASKED_AT, id: Number(RUN) }) };
  }
  const [, run = ""] = /\/runs\/(?<run>\d+)\/artifacts/v.exec(target) ?? [];
  if (run !== "") {
    return { ok: true, value: listing(artifacts.filter((artifact) => String(artifact.run) === run)) };
  }
  return { ok: true, value: listing(artifacts.filter((artifact) => artifact.name === "test-timings-browser-1")) };
}

function fakeGh({ artifacts, reports }: FakeCi): (args: readonly string[]) => Outcome<string> {
  return (args) => {
    const [verb, target = ""] = args;
    if (verb === "run") {
      return download(args, reports);
    }
    return api(target, artifacts);
  };
}

function offline(): Outcome<string> {
  return { ok: false, reason: "gh api failed: offline" };
}

const FILES = ["alpha", "bravo", "charlie", "delta", "echo"].map((name) => file(name));

function recordedBy(reports: FakeCi["reports"]): (args: readonly string[]) => Outcome<string> {
  const artifacts = Object.keys(reports).map((name) => ({ createdAt: EARLIER, name, run: 800 }));
  return fakeGh({ artifacts, reports });
}

function planned(shard: string, reports: FakeCi["reports"], files: readonly string[] = FILES): readonly string[] {
  return browserShardPlan({ files: { ok: true, value: files }, gh: recordedBy(reports), run: RUN, shard }).args;
}

it("counts a file with no recorded time as the average file, and adds up a file's times across reports", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const reports = {
    "test-timings-browser-1": { alpha: 30, bravo: 20 },
    "test-timings-browser-2": { alpha: 30, gone: 500 },
  };
  const files = [file("alpha"), file("bravo"), file("new")];

  expect(["1/2", "2/2"].map((shard) => planned(shard, reports, files))).toStrictEqual([
    ["--record-shard=1/2", file("alpha")],
    ["--record-shard=2/2", file("bravo"), file("new")],
  ]);
});

it("splits by test count when no browser test file has a recorded time, or the shard isn't one", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  expect([
    browserShardPlan({
      files: { ok: true, value: FILES },
      gh: recordedBy({ "test-timings-browser-1": { gone: 5 } }),
      run: RUN,
      shard: "1/2",
    }).line,
    browserShardPlan({
      files: { ok: true, value: FILES },
      gh: recordedBy({ "test-timings-browser-1": { alpha: 5 } }),
      run: RUN,
      shard: "3/2",
    }).line,
  ]).toStrictEqual([
    "browser shard 1/2: split by test count, since no browser test file has a recorded time",
    "browser shard 3/2: split by test count, since 3/2 isn't a shard such as 1/3",
  ]);
});

it("a CI shard runs the files its share of the time recorded before its run picks, labelling its coverage map", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const gh = fakeGh({
    artifacts: [
      { createdAt: LATER, name: "test-timings-browser-1", run: 899 },
      { createdAt: EARLIER, name: "test-timings-browser-1", run: 800 },
      { createdAt: EARLIER, expired: true, name: "test-timings-browser-1", run: 850 },
      { createdAt: EARLIER, name: "test-timings-browser-2", run: 800 },
      { createdAt: LATER, name: "test-timings-browser-3", run: 800 },
      { createdAt: EARLIER, name: "test-timings-tests-1", run: 800 },
    ],
    reports: {
      "test-timings-browser-1": { alpha: 50, bravo: 40 },
      "test-timings-browser-2": { charlie: 30, delta: 20, echo: 10 },
      "test-timings-browser-3": { echo: 1000 },
    },
  });

  expect(
    ["1/2", "2/2"].map((shard) => browserShardPlan({ files: { ok: true, value: FILES }, gh, run: RUN, shard })),
  ).toStrictEqual([
    {
      args: ["--record-shard=1/2", file("alpha"), file("delta"), file("echo")],
      line: "browser shard 1/2: 3 of 5 files, 80.0s of test time as run 800 recorded it",
    },
    {
      args: ["--record-shard=2/2", file("bravo"), file("charlie")],
      line: "browser shard 2/2: 2 of 5 files, 70.0s of test time as run 800 recorded it",
    },
  ]);
});

it("a CI shard falls back to Playwright's split by test count when it can't read recorded times", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const files = { ok: true, value: FILES } as const;
  const none = fakeGh({ artifacts: [{ createdAt: LATER, name: "test-timings-browser-1", run: 899 }], reports: {} });

  expect([
    browserShardPlan({ files, gh: none, run: RUN, shard: "1/3" }).line,
    browserShardPlan({ files, gh: offline, run: RUN, shard: "1/3" }).line,
    browserShardPlan({ files, gh: none, run: "", shard: "1/3" }).line,
    browserShardPlan({ files: { ok: false, reason: "no listing" }, gh: none, run: RUN, shard: "2/3" }),
  ]).toStrictEqual([
    "browser shard 1/3: split by test count, since no Check run recorded browser timings before run 900",
    "browser shard 1/3: split by test count, since gh api failed: offline",
    "browser shard 1/3: split by test count, since this isn't a GitHub Actions run",
    { args: ["--shard=2/3"], line: "browser shard 2/3: split by test count, since no listing" },
  ]);
});
