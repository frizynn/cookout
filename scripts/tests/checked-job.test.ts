import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const WORKFLOW = readFileSync(new URL("../../.github/workflows/check.yml", import.meta.url), "utf8");
const JOB_KEYS = /^ {2}[a-z][\w-]*:$/gmu;
const NEEDS = /^ {4}needs: \[[^\]]*\]$/mu;
const SCRIPT_INDENT = "          ";
const START = 0;
const NEXT = 1;
const LAST = -1;
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

interface Result {
  readonly job: string;
  readonly result: string;
}

function jobKeys(): readonly string[] {
  const jobs = WORKFLOW.slice(WORKFLOW.indexOf("\njobs:\n"));
  return (jobs.match(JOB_KEYS) ?? []).map((line) => line.trim().slice(START, LAST));
}

function checkedBlock(): string {
  return WORKFLOW.slice(WORKFLOW.indexOf("\n  checked:\n"));
}

function neededJobs(): readonly string[] {
  const [line = ""] = NEEDS.exec(checkedBlock()) ?? [];
  return line.slice(line.indexOf("[") + NEXT, line.indexOf("]")).split(", ");
}

function checkedScript(): string {
  const lines = checkedBlock().split("\n");
  const start = lines.findIndex((line) => line.trim() === "run: |") + NEXT;
  return lines
    .slice(start)
    .filter((line) => line.startsWith(SCRIPT_INDENT))
    .map((line) => line.slice(SCRIPT_INDENT.length))
    .join("\n");
}

function checked(results: readonly Result[]): { readonly output: string; readonly status: number | null } {
  const needs = Object.fromEntries(results.map(({ job, result }) => [job, { outputs: {}, result }]));
  const ran = spawnSync("bash", ["-c", `NEEDS="$0"\n${checkedScript()}`, JSON.stringify(needs)], {
    encoding: "utf8",
  });
  return { output: ran.stdout.trim(), status: ran.status };
}

it("makes the checked job need every other job of the Check workflow", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(neededJobs().toSorted()).toStrictEqual(
    jobKeys()
      .filter((key) => key !== "checked")
      .toSorted(),
  );
});

it("runs the checked job even when a job it needs failed", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(checkedBlock()).toMatch(/\n {4}if: always\(\)\n/u);
});

it.each<{ readonly name: string; readonly result: string }>([
  { name: "a job failed", result: "failure" },
  { name: "a job was cancelled", result: "cancelled" },
])("fails the checked job when $name, naming that job", { timeout: 10_000 }, ({ result }) => {
  expect.hasAssertions();
  expect(
    checked([
      { job: "browser", result: "success" },
      { job: "tests", result },
    ]),
  ).toStrictEqual({ output: `Not every job passed:\ntests: ${result}`, status: EXIT_FAILURE });
});

it("passes the checked job when every job passed or was skipped", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect(
    checked([
      { job: "browser", result: "success" },
      { job: "coverage", result: "skipped" },
      { job: "tests", result: "success" },
    ]),
  ).toStrictEqual({ output: "Every job passed.", status: EXIT_SUCCESS });
});
