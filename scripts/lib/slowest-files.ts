import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { field, list, parseJson, text } from "./json.ts";
import path from "node:path";

interface FileTiming {
  readonly file: string;
  readonly seconds: number;
}

interface Report {
  readonly base: string;
  readonly report: unknown;
}

interface Summary {
  readonly label: string;
  readonly timings: readonly FileTiming[];
}

interface SavedList extends Summary {
  readonly dir: string;
}

interface ReportFile {
  readonly base: string;
  readonly file: string;
  readonly runner: "playwright" | "vitest";
}

const TIMINGS_DIR = ".timings";
const MS_PER_SECOND = 1000;
const DECIMALS = 1;
const SUMMARY_COUNT = 10;
const WARNING_COUNT = 3;
const NONE = 0;

function vitestTiming(result: unknown, root: string): readonly FileTiming[] {
  const name = text(field(result, "name")) ?? "";
  const start = field(result, "startTime");
  const end = field(result, "endTime");
  if (name === "" || typeof start !== "number" || typeof end !== "number") {
    return [];
  }
  return [{ file: path.relative(root, name), seconds: (end - start) / MS_PER_SECOND }];
}

function vitestTimings({ base, report }: Report): readonly FileTiming[] {
  return (list(field(report, "testResults")) ?? []).flatMap((result) => vitestTiming(result, base));
}

function durationMs(result: unknown): number {
  const duration = field(result, "duration");
  if (typeof duration !== "number") {
    return NONE;
  }
  return duration;
}

function testMs(test: unknown): number {
  return (list(field(test, "results")) ?? []).reduce<number>((sum, result) => sum + durationMs(result), NONE);
}

function specMs(spec: unknown): number {
  return (list(field(spec, "tests")) ?? []).reduce<number>((sum, test) => sum + testMs(test), NONE);
}

function suiteMs(suite: unknown): number {
  const specs = (list(field(suite, "specs")) ?? []).reduce<number>((sum, spec) => sum + specMs(spec), NONE);
  return (list(field(suite, "suites")) ?? []).reduce<number>((sum, inner) => sum + suiteMs(inner), specs);
}

function playwrightTiming(suite: unknown, testDir: string): readonly FileTiming[] {
  const file = text(field(suite, "file")) ?? "";
  if (file === "") {
    return [];
  }
  return [{ file: path.join(testDir, file), seconds: suiteMs(suite) / MS_PER_SECOND }];
}

function playwrightTimings({ base, report }: Report): readonly FileTiming[] {
  return (list(field(report, "suites")) ?? []).flatMap((suite) => playwrightTiming(suite, base));
}

function bySlowest(timings: readonly FileTiming[]): readonly FileTiming[] {
  return timings.toSorted((left, right) => right.seconds - left.seconds);
}

function seconds(timing: FileTiming): string {
  return `${timing.seconds.toFixed(DECIMALS)}s`;
}

function slowestSummary({ label, timings }: Summary): string {
  if (timings.length === NONE) {
    return `${label}: no per-file timings reported`;
  }
  const shown = bySlowest(timings).slice(NONE, SUMMARY_COUNT);
  const width = Math.max(...shown.map((timing) => seconds(timing).length));
  const lines = shown.map((timing) => `  ${seconds(timing).padStart(width)}  ${timing.file}`);
  return [`${label}: the ${String(shown.length)} slowest of ${String(timings.length)} test files`, ...lines].join("\n");
}

function slowestNames(timings: readonly FileTiming[]): string {
  return bySlowest(timings)
    .slice(NONE, WARNING_COUNT)
    .map((timing) => `${timing.file} (${seconds(timing)})`)
    .join(", ");
}

function fullList(timings: readonly FileTiming[]): string {
  return bySlowest(timings)
    .map((timing) => `${seconds(timing)}\t${timing.file}\n`)
    .join("");
}

function readTimings({ base, file, runner }: ReportFile): readonly FileTiming[] {
  if (!existsSync(file)) {
    return [];
  }
  const report = parseJson(readFileSync(file, "utf8"));
  if (runner === "playwright") {
    return playwrightTimings({ base, report });
  }
  return vitestTimings({ base, report });
}

function saveFullList({ dir, label, timings }: SavedList): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${label}.txt`), fullList(timings));
}

export type { FileTiming, ReportFile };
export { TIMINGS_DIR, readTimings, saveFullList, slowestNames, slowestSummary };
