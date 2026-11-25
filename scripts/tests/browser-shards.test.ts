import { browserShardPlan, shardByTime } from "../lib/browser-shards.ts";
import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Outcome } from "../lib/tools.ts";
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

it("splits the browser test files so each shard's recorded time comes out close, slowest file first", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  const timings = [
    { file: file("alpha"), seconds: 50 },
    { file: file("bravo"), seconds: 40 },
    { file: file("charlie"), seconds: 30 },
    { file: file("delta"), seconds: 20 },
    { file: file("echo"), seconds: 10 },
  ];

  expect(["1/2", "2/2"].map((shard) => shardByTime({ files: FILES, shard, timings }))).toStrictEqual([
    { ok: true, value: { files: [file("alpha"), file("delta"), file("echo")], seconds: 80 } },
    { ok: true, value: { files: [file("bravo"), file("charlie")], seconds: 70 } },
  ]);
});

it("counts a file with no recorded time as the average file, and adds up a file's times across reports", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  const timings = [
    { file: file("alpha"), seconds: 30 },
    { file: file("alpha"), seconds: 30 },
    { file: file("bravo"), seconds: 20 },
    { file: file("gone"), seconds: 500 },
  ];
  const files = [file("alpha"), file("bravo"), file("new")];

  expect(["1/2", "2/2"].map((shard) => shardByTime({ files, shard, timings }))).toStrictEqual([
    { ok: true, value: { files: [file("alpha")], seconds: 60 } },
    { ok: true, value: { files: [file("bravo"), file("new")], seconds: 60 } },
  ]);
});

it("can't split by time when no browser test file has a recorded time, or the shard isn't one", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  expect([
    shardByTime({ files: FILES, shard: "1/2", timings: [{ file: file("gone"), seconds: 5 }] }),
    shardByTime({ files: FILES, shard: "3/2", timings: [{ file: file("alpha"), seconds: 5 }] }),
  ]).toStrictEqual([
    { ok: false, reason: "no browser test file has a recorded time" },
    { ok: false, reason: "3/2 isn't a shard such as 1/3" },
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
