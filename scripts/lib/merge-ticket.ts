import type { Command, Ran, Step, Stopped } from "./merge-steps.ts";
import { DONE, RERERE, firstStop, git, lines, run, stepOf, stop, tail } from "./merge-steps.ts";
import type { FirstSide, HunkResolve } from "./conflicts.ts";
import { asOneTicketMerge, cleanTree, messageOf } from "./merge-branch.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { renumberAdrs, renumberOpenMerge } from "./merge-adrs.ts";
import { appendOnlyMigrations } from "./merge-migrations.ts";
import path from "node:path";
import { resolveHunks } from "./conflicts.ts";

interface HunkRule {
  readonly file: string;
  readonly resolve: HunkResolve;
}

interface RegenerateRule {
  readonly command: Command;
  readonly files: string;
}

interface MergeRules {
  readonly adrs: string;
  readonly appendOnly: readonly string[];
  readonly hunks: readonly HunkRule[];
  readonly regenerate: readonly RegenerateRule[];
}

interface MergeOptions {
  readonly attempts: number;
  readonly check: Command;
  readonly cwd: string;
  readonly install: Command;
  readonly log: (line: string) => void;
  readonly migrationsBase: string;
  readonly rules: MergeRules;
  readonly ticket: number;
  readonly title: string;
}

type Merged =
  | { readonly attempts: number; readonly ok: true; readonly sha: string }
  | { readonly files: readonly string[]; readonly ok: false; readonly reason: string };

type Started = { readonly kind: "started"; readonly sha: string } | Stopped;
interface Pushed {
  readonly kind: "pushed";
  readonly sha: string;
}

type Attempt = { readonly kind: "moved" } | Pushed | Stopped;

const LOCKFILE = "pnpm-lock.yaml";
const NONE = 0;
const FIRST_ATTEMPT = 1;
function failed(command: Command, ran: Ran, after: string): Stopped {
  return stop(`${command.join(" ")} failed; nothing was pushed.${after}\n${tail(ran.output)}`);
}

function resolvedByHunks(options: MergeOptions, file: string, first: FirstSide): boolean {
  const rules = options.rules.hunks.filter((candidate) => candidate.file === file);
  const filePath = path.join(options.cwd, file);
  return rules.some((rule) => {
    const resolved = resolveHunks({ first, resolve: rule.resolve, source: readFileSync(filePath, "utf8") });
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
    const ran = run(options.cwd, ...rule.command);
    if (!ran.ok) {
      return failed(rule.command, ran, "");
    }
  }
  return DONE;
}

function unresolvable(options: MergeOptions, left: readonly string[]): Stopped {
  const listed = left.map((file) => `  ${file}`).join("\n");
  return stop(
    `ticket-${options.ticket} conflicts with v1 in files that are not generated, a migration number or the coverage floor:\n${listed}\nNothing was pushed. The merge is in progress on merge-ticket-${options.ticket}: resolve it by hand and commit, then run pnpm merge-ticket ${options.ticket} --continue; or run git merge --abort.`,
    ...left,
  );
}

function resolveConflicts(options: MergeOptions, conflicted: readonly string[], first: FirstSide): Step {
  const generated = conflicted.filter((file) => isGenerated(options, file));
  const left = conflicted.filter((file) => !generated.includes(file) && !resolvedByHunks(options, file, first));
  if (left.length > NONE) {
    return unresolvable(options, left);
  }
  const regenerated = regenerate(options, generated);
  if (regenerated.kind === "stopped") {
    return regenerated;
  }
  const committed = firstStop([
    (): Step => stepOf({ ran: git(options, "add", "-u"), what: "git add -u" }),
    (): Step => stepOf({ ran: git(options, "commit", "-q", "--no-edit"), what: "Committing the resolved merge" }),
  ]);
  return committed;
}

function merge(options: MergeOptions, into: string, first: FirstSide): Step {
  const merged = git(
    options,
    ...RERERE,
    "-c",
    "merge.conflictStyle=diff3",
    "merge",
    "-q",
    "--no-ff",
    into,
    "-m",
    messageOf(options),
  );
  if (merged.ok) {
    return DONE;
  }
  const conflicted = lines(git(options, "diff", "--name-only", "--diff-filter=U").output);
  if (conflicted.length === NONE && !git(options, "rev-parse", "-q", "--verify", "MERGE_HEAD").ok) {
    return stop(`git merge failed.\n${tail(merged.output)}`);
  }
  options.log(`Resolving conflicts in ${conflicted.join(", ")}`);
  return firstStop([
    (): Step => renumberOpenMerge({ adrs: options.rules.adrs, cwd: options.cwd, log: options.log }),
    (): Step => resolveConflicts(options, conflicted, first),
  ]);
}

function install(options: MergeOptions): Step {
  const ticket = `ticket-${options.ticket}`;
  if (lines(git(options, "diff", "--name-only", ticket, "HEAD", "--", LOCKFILE).output).length === NONE) {
    return DONE;
  }
  options.log(`${LOCKFILE} differs from ${ticket}'s: running ${options.install.join(" ")}`);
  const installed = run(options.cwd, ...options.install);
  if (installed.ok) {
    return DONE;
  }
  return failed(options.install, installed, "");
}

function check(options: MergeOptions): Step {
  options.log(`Running ${options.check.join(" ")}`);
  const checked = run(options.cwd, ...options.check);
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
    (): Step => merge(options, `ticket-${options.ticket}`, "ours"),
    (): Step => appendOnlyMigrations(options),
    (): Step => renumberAdrs({ adrs: options.rules.adrs, cwd: options.cwd, log: options.log }),
    (): Step => install(options),
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

function regenerateChanged(options: MergeOptions, base: string): Step {
  const changed = lines(git(options, "diff", "--name-only", base, "HEAD").output);
  const regenerated = regenerate(
    options,
    changed.filter((file) => isGenerated(options, file)),
  );
  if (regenerated.kind === "stopped" || cleanTree(options).kind === "done") {
    return regenerated;
  }
  return firstStop([
    (): Step => stepOf({ ran: git(options, "add", "-u"), what: "git add -u" }),
    (): Step =>
      stepOf({ ran: git(options, "commit", "-q", "--amend", "--no-edit"), what: "Committing the regenerated files" }),
  ]);
}

function checkAndPush(options: MergeOptions, base: string): Attempt {
  const stepped = firstStop([
    (): Step => appendOnlyMigrations(options),
    (): Step => renumberAdrs({ adrs: options.rules.adrs, cwd: options.cwd, log: options.log }),
    (): Step => regenerateChanged(options, base),
    (): Step => install(options),
    (): Step => check(options),
  ]);
  if (stepped.kind === "stopped") {
    return stepped;
  }
  return push(options, base);
}

function retry(options: MergeOptions): Attempt {
  const base = git(options, "rev-parse", "origin/v1").output;
  const stepped = firstStop([(): Step => merge(options, "origin/v1", "theirs"), (): Step => asOneTicketMerge(options)]);
  if (stepped.kind === "stopped") {
    return stepped;
  }
  return checkAndPush(options, base);
}

function afterAttempt(options: MergeOptions, outcome: Attempt, count: number): Merged {
  if (outcome.kind !== "moved") {
    return finished(outcome, count);
  }
  const next = count + FIRST_ATTEMPT;
  if (next > options.attempts) {
    const reason = `v1 kept moving: gave up after ${options.attempts} attempts. Nothing was pushed.`;
    return { files: [], ok: false, reason };
  }
  options.log(
    `v1 moved before the push. Attempt ${next} of ${options.attempts}: merging the new origin/v1 into merge-ticket-${options.ticket}`,
  );
  return afterAttempt(options, retry(options), next);
}

function mergeTicket(options: MergeOptions): Merged {
  const clean = cleanTree(options);
  if (clean.kind === "stopped") {
    return finished(clean, NONE);
  }
  options.log(`Attempt ${FIRST_ATTEMPT} of ${options.attempts}: merging ticket-${options.ticket} into origin/v1`);
  return afterAttempt(options, attempt(options), FIRST_ATTEMPT);
}

function continueAttempt(options: MergeOptions): Attempt {
  const branch = `merge-ticket-${options.ticket}`;
  const head = git(options, "rev-parse", "--abbrev-ref", "HEAD").output;
  if (head !== branch || !git(options, "rev-parse", "-q", "--verify", "HEAD^2").ok) {
    return stop(
      `Nothing to continue: not on ${branch} with a merge commit at HEAD (on ${head}). Run pnpm merge-ticket ${options.ticket} first.`,
    );
  }
  const stepped = firstStop([(): Step => cleanTree(options), (): Step => asOneTicketMerge(options)]);
  if (stepped.kind === "stopped") {
    return stepped;
  }
  return checkAndPush(options, git(options, "rev-parse", "HEAD^1").output);
}

function continueMerge(options: MergeOptions): Merged {
  options.log(`Attempt ${FIRST_ATTEMPT} of ${options.attempts}: checking and pushing merge-ticket-${options.ticket}`);
  return afterAttempt(options, continueAttempt(options), FIRST_ATTEMPT);
}

export type { MergeOptions, MergeRules, Merged };
export { continueMerge, mergeTicket };
