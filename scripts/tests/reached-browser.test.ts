import { expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { reachedBrowserShardPlan, reachedShard } from "../lib/reached-browser.ts";
import type { Outcome } from "../lib/tools.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const DIR = "app/modules/routes/tests/browser";
const RUN = "900";
const MS = 1000;
const LAST = -1;
const RECORDED = { alpha: 50, bravo: 40, charlie: 30 };
const AFTER_FIRST = 1;

function file(name: string): string {
  return `${DIR}/${name}.browser.test.ts`;
}

const FILES = ["alpha", "bravo", "charlie", "delta", "echo"].map((name) => file(name));

function reportOf(seconds: Readonly<Record<string, number>>): string {
  const suites = Object.entries(seconds).map(([name, took]: readonly [string, number]) => ({
    file: `${name}.browser.test.ts`,
    specs: [{ tests: [{ results: [{ duration: took * MS }] }] }],
  }));
  return JSON.stringify({ suites });
}

const ARTIFACTS = JSON.stringify({
  artifacts: [
    { created_at: "2026-11-25T09:00:00Z", expired: false, name: "test-timings-browser-1", workflow_run: { id: 800 } },
  ],
});

function recorded(args: readonly string[]): Outcome<string> {
  const [verb, target = ""] = args;
  if (verb === "run") {
    const dir = path.join(args.at(LAST) ?? "", ".timings");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "browser.json"), reportOf(RECORDED));
    return { ok: true, value: "" };
  }
  if (target.endsWith(`/runs/${RUN}`)) {
    return { ok: true, value: JSON.stringify({ created_at: "2026-11-25T10:00:00Z" }) };
  }
  return { ok: true, value: ARTIFACTS };
}

function offline(): Outcome<string> {
  return { ok: false, reason: "gh api failed: offline" };
}

it("a pull request's shard runs its share of the reached files' recorded time, and none when its share is empty", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const reached = { ok: true, value: [file("alpha"), file("charlie")] } as const;

  expect(
    ["1/3", "2/3", "3/3"].map((shard) => reachedBrowserShardPlan({ files: reached, gh: recorded, run: RUN, shard })),
  ).toStrictEqual([
    { args: [file("alpha")], line: "browser shard 1/3: 1 of 2 files, 50.0s of test time as run 800 recorded it" },
    { args: [file("charlie")], line: "browser shard 2/3: 1 of 2 files, 30.0s of test time as run 800 recorded it" },
    { args: [], line: "browser shard 3/3: 0 of 2 files, 0.0s of test time as run 800 recorded it" },
  ]);
});

it("a pull request's shard falls back to every third reached file when no run recorded browser timings", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  expect([
    reachedBrowserShardPlan({ files: { ok: true, value: FILES }, gh: offline, run: RUN, shard: "1/3" }),
    reachedBrowserShardPlan({ files: { ok: false, reason: "no listing" }, gh: offline, run: RUN, shard: "2/3" }).args,
  ]).toStrictEqual([
    {
      args: [file("alpha"), file("delta")],
      line: "browser shard 1/3: split by file count, since gh api failed: offline",
    },
    ["--shard=2/3"],
  ]);
});

it("a docs-only change, or a shard whose share is empty, has nothing to run and says so", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const cwd = mkdtempSync(path.join(tmpdir(), "reached-browser-"));
  const none = { all: false, run: [], skipped: FILES } as const;
  const one = { all: false, run: [file("alpha")], skipped: FILES.slice(AFTER_FIRST) } as const;

  expect([
    reachedShard({ cwd, gh: recorded, run: RUN, shard: "1/6", tests: none }),
    reachedShard({ cwd, gh: recorded, run: RUN, shard: "2/6", tests: one }).nothing,
    reachedShard({ cwd, gh: recorded, run: RUN, shard: "1/6", tests: one }).args,
  ]).toStrictEqual([
    {
      args: [],
      lines: ["check: this change reaches 0 of 5 browser test files."],
      nothing: "check: no browser test to run, so the browser check passes.",
    },
    "check: browser shard 2/6 got none of the reached files, so it passes.",
    [file("alpha")],
  ]);
});

it("a change that reaches every browser test runs its share of all of them", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const cwd = mkdtempSync(path.join(tmpdir(), "reached-browser-"));
  mkdirSync(path.join(cwd, DIR), { recursive: true });
  for (const test of FILES) {
    writeFileSync(path.join(cwd, test), "");
  }

  expect(reachedShard({ cwd, gh: offline, run: RUN, shard: "2/3", tests: { all: true, reason: "x" } })).toStrictEqual({
    args: [file("bravo"), file("echo")],
    lines: ["", "browser shard 2/3: split by file count, since gh api failed: offline"],
    nothing: "",
  });
});
