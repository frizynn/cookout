import { expect, it, onTestFinished } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readTimings, saveFullList, slowestNames, slowestSummary } from "../lib/slowest-files.ts";
import type { ReportFile } from "../lib/slowest-files.ts";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = "/repo";
const FILE_COUNT = 12;
const QUARTER = 0.25;
const FIRST_TWO = 2;
const NONE = 0;

const vitestReport = {
  testResults: [
    { endTime: 3500, name: `${ROOT}/a.test.ts`, startTime: 1000 },
    { endTime: 2250, name: `${ROOT}/b.test.ts`, startTime: 2000 },
  ],
};

const playwrightReport = {
  suites: [
    {
      file: "chat.browser.test.ts",
      specs: [{ tests: [{ results: [{ duration: 1200 }, { duration: 300 }] }] }],
      suites: [{ specs: [{ tests: [{ results: [{ duration: 500 }, { status: "skipped" }] }] }] }],
    },
    { file: "login.browser.test.ts", specs: [{ tests: [{ results: [{ duration: 700 }] }] }] },
  ],
};

function folder(): string {
  const made = mkdtempSync(path.join(tmpdir(), "slowest-files-"));
  onTestFinished(() => {
    rmSync(made, { force: true, recursive: true });
  });
  return made;
}

function reportFile(report: unknown, options: Omit<ReportFile, "file">): ReportFile {
  const file = path.join(folder(), "report.json");
  writeFileSync(file, JSON.stringify(report));
  return { ...options, file };
}

const timings = Array.from({ length: FILE_COUNT }, (unused, index) => ({
  file: `f${String(index)}.test.ts`,
  seconds: index + QUARTER,
}));

it("reads each test file's duration from a Vitest JSON report, relative to the root", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(readTimings(reportFile(vitestReport, { base: ROOT, runner: "vitest" }))).toStrictEqual([
    { file: "a.test.ts", seconds: 2.5 },
    { file: "b.test.ts", seconds: 0.25 },
  ]);
});

it("reads no timings from a report that isn't a Vitest JSON report", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const missing = path.join(folder(), "missing.json");

  expect([
    readTimings(reportFile(null, { base: ROOT, runner: "vitest" })),
    readTimings(reportFile({ testResults: [{ name: "a.test.ts" }] }, { base: ROOT, runner: "vitest" })),
    readTimings({ base: ROOT, file: missing, runner: "vitest" }),
  ]).toStrictEqual([[], [], []]);
});

it("adds up every result in a Playwright file, nested describes and retries included", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(readTimings(reportFile(playwrightReport, { base: "app/browser", runner: "playwright" }))).toStrictEqual([
    { file: "app/browser/chat.browser.test.ts", seconds: 2 },
    { file: "app/browser/login.browser.test.ts", seconds: 0.7 },
  ]);
});

it("reads no timings from a report that isn't a Playwright JSON report", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect([
    readTimings(reportFile(null, { base: "", runner: "playwright" })),
    readTimings(reportFile({ suites: [{ specs: [] }] }, { base: "", runner: "playwright" })),
  ]).toStrictEqual([[], []]);
});

it("lists the 10 slowest files, slowest first, with their durations", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(slowestSummary({ label: "tests", timings })).toBe(
    [
      "tests: the 10 slowest of 12 test files",
      "  11.3s  f11.test.ts",
      "  10.3s  f10.test.ts",
      "   9.3s  f9.test.ts",
      "   8.3s  f8.test.ts",
      "   7.3s  f7.test.ts",
      "   6.3s  f6.test.ts",
      "   5.3s  f5.test.ts",
      "   4.3s  f4.test.ts",
      "   3.3s  f3.test.ts",
      "   2.3s  f2.test.ts",
    ].join("\n"),
  );
});

it("lists every file when there are fewer than 10", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(slowestSummary({ label: "browser", timings: [{ file: "a.test.ts", seconds: 1 }] })).toBe(
    ["browser: the 1 slowest of 1 test files", "  1.0s  a.test.ts"].join("\n"),
  );
});

it("says when the run reported no per-file timings", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(slowestSummary({ label: "tests", timings: [] })).toBe("tests: no per-file timings reported");
});

it("names the 3 slowest files in one line, for the budget warning", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(slowestNames(timings)).toBe("f11.test.ts (11.3s), f10.test.ts (10.3s), f9.test.ts (9.3s)");
});

it("saves the full list as <label>.txt, slowest first, one file a line", { timeout: 10_000 }, () => {
  expect.hasAssertions();

  const dir = path.join(folder(), "timings");
  saveFullList({ dir, label: "tests", timings: timings.slice(NONE, FIRST_TWO) });

  expect(readFileSync(path.join(dir, "tests.txt"), "utf8")).toBe("1.3s\tf1.test.ts\n0.3s\tf0.test.ts\n");
});
