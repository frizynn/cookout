import type { CheckRun, Job, Unreadable } from "./check-run.ts";
import type { Command, Step, Stopped } from "./merge-steps.ts";
import { DONE, run, stop, tail } from "./merge-steps.ts";
import { field, list, parseJson } from "./json.ts";
import { readCheckRun } from "./check-run.ts";

interface CiGateOptions {
  readonly args: readonly string[];
  readonly base: readonly string[];
  readonly cwd: string;
  readonly gh: Command;
  readonly log: (line: string) => void;
  readonly polls: number;
  readonly sleep: () => void;
  readonly subject: string;
}

const NONE = 0;
const NEXT = 1;
const GREEN = "success";
const COMPLETED = "completed";
const LIST = ["run", "list", "--workflow", "Check", "--event", "push", "--limit", "1", "--json", "databaseId"];

function unreadable(options: CiGateOptions, read: Unreadable): Stopped {
  return stop(`Could not read ${options.subject}'s Check run: gh ${read.args.join(" ")}\n${tail(read.output)}`);
}

function runs(args: readonly string[], options: CiGateOptions): readonly unknown[] | Unreadable {
  const ran = run(options.cwd, ...options.gh, ...args);
  if (!ran.ok) {
    return { args, kind: "unreadable", output: ran.output };
  }
  return list(parseJson(ran.output)) ?? { args, kind: "unreadable", output: "gh printed no list of runs." };
}

function latestRun(options: CiGateOptions, filters: readonly string[]): number | Stopped {
  const args = [...LIST, ...filters];
  const listed = runs(args, options);
  if ("kind" in listed) {
    return unreadable(options, listed);
  }
  const runNumber = field(listed.at(NONE), "databaseId");
  if (typeof runNumber !== "number") {
    return stop(`${options.subject} has no Check push run: ${args.join(" ")}`);
  }
  return runNumber;
}

function notGreen(checkRun: CheckRun): readonly Job[] {
  return checkRun.jobs.filter((job) => job.status === COMPLETED && job.conclusion !== GREEN);
}

function baseRun(options: CiGateOptions): CheckRun | Stopped {
  const runNumber = latestRun(options, options.base);
  if (typeof runNumber !== "number") {
    return runNumber;
  }
  const read = readCheckRun({ ...options, runNumber });
  if (read.kind === "unreadable") {
    return unreadable(options, read);
  }
  return read;
}

function inheritedFrom(options: CiGateOptions, failed: readonly Job[]): string {
  if (options.base.length === NONE || failed.length === NONE) {
    return "";
  }
  const base = baseRun(options);
  if (base.kind === "stopped") {
    return "";
  }
  const redOnBase = new Set(notGreen(base).map((job) => job.name));
  if (!failed.every((job) => redOnBase.has(job.name))) {
    return "";
  }
  return `\nThe same jobs failed on v1's Check run for ${options.subject}'s merge-base: ${base.url}\nYour base was red; merge the current green v1 into ${options.subject} (git merge origin/v1), push, and rerun merge-ticket.`;
}

function red(options: CiGateOptions, checkRun: CheckRun): Step {
  const failed = notGreen(checkRun);
  const named = failed.map((job) => `${job.name} (${job.conclusion})`);
  if (checkRun.status === COMPLETED && checkRun.jobs.length === NONE) {
    named.push("the run (no jobs)");
  }
  if (named.length === NONE) {
    return DONE;
  }
  return stop(
    `${options.subject}'s latest Check run is red: ${named.join(", ")}.\n${checkRun.url}${inheritedFrom(options, failed)}`,
  );
}

function wait(options: CiGateOptions, checkRun: CheckRun, waited: number): Step {
  if (waited >= options.polls) {
    return stop(
      `${options.subject}'s latest Check run was still running after ${options.polls} waits: ${checkRun.url}`,
    );
  }
  options.log(
    `${options.subject}'s latest Check run is still running: waiting (${waited + NEXT} of ${options.polls}). ${checkRun.url}`,
  );
  options.sleep();
  return DONE;
}

function verdict(options: CiGateOptions, checkRun: CheckRun): Step | "running" {
  const refused = red(options, checkRun);
  if (refused.kind === "stopped") {
    return refused;
  }
  if (checkRun.status !== COMPLETED) {
    return "running";
  }
  options.log(`${options.subject}'s latest Check run is green: ${checkRun.url}`);
  return DONE;
}

function poll(options: CiGateOptions, runNumber: number, waited: number): Step {
  const checkRun = readCheckRun({ ...options, runNumber });
  if (checkRun.kind === "unreadable") {
    return unreadable(options, checkRun);
  }
  const judged = verdict(options, checkRun);
  if (judged !== "running") {
    return judged;
  }
  const slept = wait(options, checkRun, waited);
  if (slept.kind === "stopped") {
    return slept;
  }
  return poll(options, runNumber, waited + NEXT);
}

function ciGreen(options: CiGateOptions): Step {
  const runNumber = latestRun(options, options.args);
  if (typeof runNumber !== "number") {
    return runNumber;
  }
  return poll(options, runNumber, NONE);
}

export { ciGreen };
