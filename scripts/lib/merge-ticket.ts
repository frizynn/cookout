import { readFileSync, writeFileSync } from "node:fs";
import type { HunkResolve } from "./conflicts.ts";
import path from "node:path";
import { resolveHunks } from "./conflicts.ts";
import { spawnSync } from "node:child_process";

type Command = readonly string[];

interface HunkRule {
  readonly file: string;
  readonly resolve: HunkResolve;
}

interface RegenerateRule {
  readonly command: Command;
  readonly files: string;
}

interface MergeRules {
  readonly hunks: readonly HunkRule[];
  readonly regenerate: readonly RegenerateRule[];
}

interface MergeOptions {
  readonly attempts: number;
  readonly check: Command;
  readonly cwd: string;
  readonly install: Command;
  readonly log: (line: string) => void;
  readonly rules: MergeRules;
  readonly ticket: number;
  readonly title: string;
}

type Merged =
  | { readonly attempts: number; readonly ok: true; readonly sha: string }
  | { readonly files: readonly string[]; readonly ok: false; readonly reason: string };

interface Stopped {
  readonly files: readonly string[];
  readonly kind: "stopped";
  readonly reason: string;
}

type Step = { readonly kind: "done" } | Stopped;
type Started = { readonly kind: "started"; readonly sha: string } | Stopped;
interface Pushed {
  readonly kind: "pushed";
  readonly sha: string;
}

type Attempt = { readonly kind: "moved" } | Pushed | Stopped;

interface Ran {
  readonly ok: boolean;
  readonly output: string;
}

const LOCKFILE = "pnpm-lock.yaml";
const NONE = 0;
const FIRST_ATTEMPT = 1;
const EXIT_SUCCESS = 0;
const MAX_BUFFER = 268_435_456;
const OUTPUT_TAIL = -40;
const DONE: Step = { kind: "done" };
function stop(reason: string, files: readonly string[] = []): Stopped {
  return { files, kind: "stopped", reason };
}

function run(cwd: string, command: Command): Ran {
  const [program = "true", ...args] = command;
  const ran = spawnSync(program, args, { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (ran.error instanceof Error) {
    return { ok: false, output: ran.error.message };
  }
  return { ok: ran.status === EXIT_SUCCESS, output: `${ran.stdout}${ran.stderr}`.trim() };
}

function git(options: MergeOptions, ...args: readonly string[]): Ran {
  return run(options.cwd, ["git", ...args]);
}

function tail(output: string): string {
  return output.split("\n").slice(OUTPUT_TAIL).join("\n");
}

function lines(output: string): readonly string[] {
  return output.split("\n").filter((line) => line.length > NONE);
}

function stepOf(result: Ran, what: string): Step {
  if (result.ok) {
    return DONE;
  }
  return stop(`${what} failed; nothing was pushed.\n${tail(result.output)}`);
}

function failed(command: Command, ran: Ran, after: string): Stopped {
  return stop(`${command.join(" ")} failed; nothing was pushed.${after}\n${tail(ran.output)}`);
}

function resolvedByHunks(options: MergeOptions, file: string): boolean {
  const rules = options.rules.hunks.filter((candidate) => candidate.file === file);
  const filePath = path.join(options.cwd, file);
  return rules.some((rule) => {
    const resolved = resolveHunks({ resolve: rule.resolve, source: readFileSync(filePath, "utf8") });
    if (resolved.ok) {
      writeFileSync(filePath, resolved.text);
    }
    return resolved.ok && git(options, "add", "--", file).ok;
  });
}

function isGenerated(options: MergeOptions, file: string): boolean {
  return options.rules.regenerate.some((rule) => new RegExp(rule.files, "u").test(file));
}

function regenerate(options: MergeOptions, generated: readonly string[]): Step {
  for (const file of generated) {
    git(options, "checkout", "--ours", "--", file);
  }
  const rules = options.rules.regenerate.filter((rule) =>
    generated.some((file) => new RegExp(rule.files, "u").test(file)),
  );
  for (const rule of rules) {
    options.log(`Regenerating with ${rule.command.join(" ")}`);
    const ran = run(options.cwd, rule.command);
    if (!ran.ok) {
      return failed(rule.command, ran, "");
    }
  }
  return DONE;
}

function unresolvable(options: MergeOptions, left: readonly string[]): Stopped {
  const listed = left.map((file) => `  ${file}`).join("\n");
  return stop(
    `ticket-${options.ticket} conflicts with v1 in files that are not generated, a migration number or the coverage floor:\n${listed}\nNothing was pushed. The merge is in progress on merge-ticket-${options.ticket}: resolve it by hand, or run git merge --abort.`,
    left,
  );
}

function firstStop(steps: readonly (() => Step)[]): Step {
  for (const step of steps) {
    const result = step();
    if (result.kind === "stopped") {
      return result;
    }
  }
  return DONE;
}

function resolveConflicts(options: MergeOptions, conflicted: readonly string[]): Step {
  const generated = conflicted.filter((file) => isGenerated(options, file));
  const left = conflicted.filter((file) => !generated.includes(file) && !resolvedByHunks(options, file));
  if (left.length > NONE) {
    return unresolvable(options, left);
  }
  const regenerated = regenerate(options, generated);
  if (regenerated.kind === "stopped") {
    return regenerated;
  }
  const committed = firstStop([
    (): Step => stepOf(git(options, "add", "-u"), "git add -u"),
    (): Step => stepOf(git(options, "commit", "-q", "--no-edit"), "Committing the resolved merge"),
  ]);
  return committed;
}

function merge(options: MergeOptions): Step {
  const message = `Merge ticket-${options.ticket}: ${options.title} (#${options.ticket})`;
  const ticket = `ticket-${options.ticket}`;
  const merged = git(options, "-c", "merge.conflictStyle=diff3", "merge", "-q", "--no-ff", ticket, "-m", message);
  if (merged.ok) {
    return DONE;
  }
  const conflicted = lines(git(options, "diff", "--name-only", "--diff-filter=U").output);
  if (conflicted.length === NONE) {
    return stop(`git merge failed.\n${tail(merged.output)}`);
  }
  options.log(`Resolving conflicts in ${conflicted.join(", ")}`);
  return resolveConflicts(options, conflicted);
}

function install(options: MergeOptions, base: string): Step {
  if (lines(git(options, "diff", "--name-only", base, "HEAD", "--", LOCKFILE).output).length === NONE) {
    return DONE;
  }
  options.log(`${LOCKFILE} changed: running ${options.install.join(" ")}`);
  const installed = run(options.cwd, options.install);
  if (installed.ok) {
    return DONE;
  }
  return failed(options.install, installed, "");
}

function check(options: MergeOptions): Step {
  options.log(`Running ${options.check.join(" ")}`);
  const checked = run(options.cwd, options.check);
  if (checked.ok) {
    return DONE;
  }
  return failed(options.check, checked, ` The merge is on merge-ticket-${options.ticket}.`);
}

function startFromV1(options: MergeOptions): Started {
  const fetched = git(options, "fetch", "-q", "origin");
  if (!fetched.ok) {
    return stop(`git fetch failed.\n${tail(fetched.output)}`);
  }
  const branch = `merge-ticket-${options.ticket}`;
  const checkedOut = git(options, "checkout", "-q", "-B", branch, "origin/v1");
  if (!checkedOut.ok) {
    return stop(`Could not create ${branch} from origin/v1.\n${tail(checkedOut.output)}`);
  }
  return { kind: "started", sha: git(options, "rev-parse", "origin/v1").output };
}

function push(options: MergeOptions, base: string): Attempt {
  const pushed = git(options, "push", "-q", "origin", "HEAD:v1");
  if (pushed.ok) {
    return { kind: "pushed", sha: git(options, "rev-parse", "HEAD").output };
  }
  git(options, "fetch", "-q", "origin");
  if (git(options, "rev-parse", "origin/v1").output === base) {
    return stop(`git push origin HEAD:v1 failed.\n${tail(pushed.output)}`);
  }
  return { kind: "moved" };
}

function attempt(options: MergeOptions): Attempt {
  const started = startFromV1(options);
  if (started.kind === "stopped") {
    return started;
  }
  const stepped = firstStop([
    (): Step => merge(options),
    (): Step => install(options, started.sha),
    (): Step => check(options),
  ]);
  if (stepped.kind === "stopped") {
    return stepped;
  }
  return push(options, started.sha);
}

function finished(outcome: Pushed | Stopped, count: number): Merged {
  if (outcome.kind === "pushed") {
    return { attempts: count, ok: true, sha: outcome.sha };
  }
  return { files: outcome.files, ok: false, reason: outcome.reason };
}

function attemptFrom(options: MergeOptions, count: number): Merged {
  if (count > options.attempts) {
    const reason = `v1 kept moving: gave up after ${options.attempts} attempts. Nothing was pushed.`;
    return { files: [], ok: false, reason };
  }
  options.log(`Attempt ${count} of ${options.attempts}: merging ticket-${options.ticket} into origin/v1`);
  const outcome = attempt(options);
  if (outcome.kind === "moved") {
    options.log("v1 moved before the push; merging again.");
    return attemptFrom(options, count + FIRST_ATTEMPT);
  }
  return finished(outcome, count);
}

function mergeTicket(options: MergeOptions): Merged {
  const status = git(options, "status", "--porcelain", "--untracked-files=no");
  if (!status.ok || status.output !== "") {
    return { files: [], ok: false, reason: `The working tree is not clean; commit first.\n${status.output}` };
  }
  return attemptFrom(options, FIRST_ATTEMPT);
}

export type { MergeRules, Merged };
export { mergeTicket };
