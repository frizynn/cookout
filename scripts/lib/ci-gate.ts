import type { Command, Step, Stopped } from "./merge-steps.ts";
import { DONE, run, stop, tail } from "./merge-steps.ts";
import { field, list, parseJson, text } from "./json.ts";

interface CiGateOptions {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly gh: Command;
  readonly log: (line: string) => void;
  readonly polls: number;
  readonly sleep: () => void;
  readonly subject: string;
}

interface Job {
  readonly conclusion: string;
  readonly name: string;
  readonly status: string;
}

interface CheckRun {
  readonly jobs: readonly Job[];
  readonly status: string;
  readonly url: string;
}

interface Read {
  readonly kind: "read";
  readonly value: unknown;
}

const NONE = 0;
const NEXT = 1;
const GREEN = "success";
const COMPLETED = "completed";
const LIST = ["run", "list", "--workflow", "Check", "--event", "push", "--limit", "1", "--json", "databaseId"];

function unreadable(options: CiGateOptions, args: readonly string[], output: string): Stopped {
  return stop(`Could not read ${options.subject}'s Check run: gh ${args.join(" ")}\n${tail(output)}`);
}

function jobsOf(values: readonly unknown[]): readonly Job[] {
  return values.flatMap((value) => {
    const name = text(field(value, "name"));
    const status = text(field(value, "status"));
    if (typeof name !== "string" || typeof status !== "string") {
      return [];
    }
    return [{ conclusion: text(field(value, "conclusion")) ?? "", name, status }];
  });
}

function gh(options: CiGateOptions, args: readonly string[]): Read | Stopped {
  const ran = run(options.cwd, ...options.gh, ...args);
  if (!ran.ok) {
    return unreadable(options, args, ran.output);
  }
  return { kind: "read", value: parseJson(ran.output) };
}

function runs(options: CiGateOptions, args: readonly string[]): readonly unknown[] | Stopped {
  const listed = gh(options, args);
  if (listed.kind === "stopped") {
    return listed;
  }
  return list(listed.value) ?? unreadable(options, args, "gh printed no list of runs.");
}

function viewOfLatestRun(options: CiGateOptions): Command | Stopped {
  const args = [...LIST, ...options.args];
  const listed = runs(options, args);
  if ("kind" in listed) {
    return listed;
  }
  const databaseId = field(listed.at(NONE), "databaseId");
  if (typeof databaseId !== "number") {
    return stop(`${options.subject} has no Check push run: ${args.join(" ")}`);
  }
  return ["run", "view", String(databaseId), "--json", "status,url,jobs"];
}

function viewRun(options: CiGateOptions, args: Command): CheckRun | Stopped {
  const viewed = gh(options, args);
  if (viewed.kind === "stopped") {
    return viewed;
  }
  const jobs = list(field(viewed.value, "jobs"));
  const status = text(field(viewed.value, "status"));
  if (!Array.isArray(jobs) || typeof status !== "string") {
    return unreadable(options, args, "gh printed no status and jobs.");
  }
  return { jobs: jobsOf(jobs), status, url: text(field(viewed.value, "url")) ?? "" };
}

function red(options: CiGateOptions, checkRun: CheckRun): Step {
  const failed = checkRun.jobs.filter((job) => job.status === COMPLETED && job.conclusion !== GREEN);
  const named = failed.map((job) => `${job.name} (${job.conclusion})`);
  if (checkRun.status === COMPLETED && checkRun.jobs.length === NONE) {
    named.push("the run (no jobs)");
  }
  if (named.length === NONE) {
    return DONE;
  }
  return stop(`${options.subject}'s latest Check run is red: ${named.join(", ")}.\n${checkRun.url}`);
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

function poll(options: CiGateOptions, view: Command, waited: number): Step {
  const checkRun = viewRun(options, view);
  if ("kind" in checkRun) {
    return checkRun;
  }
  const judged = verdict(options, checkRun);
  if (judged !== "running") {
    return judged;
  }
  const slept = wait(options, checkRun, waited);
  if (slept.kind === "stopped") {
    return slept;
  }
  return poll(options, view, waited + NEXT);
}

function ciGreen(options: CiGateOptions): Step {
  const view = viewOfLatestRun(options);
  if ("kind" in view) {
    return view;
  }
  return poll(options, view, NONE);
}

export { ciGreen };
