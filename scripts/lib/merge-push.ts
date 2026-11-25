import { DONE, git, stop, tail } from "./merge-steps.ts";
import type { Landed, Landing } from "./merge-queue.ts";
import type { Step, Stopped } from "./merge-steps.ts";
import { titleOf } from "./merge-branch.ts";

interface Queue {
  readonly land: (landing: Landing) => Landed | Stopped;
  readonly required: boolean;
}

interface PushOptions {
  readonly ci: (branch: string, sha: string) => Step;
  readonly cwd: string;
  readonly log: (line: string) => void;
  readonly queue: Queue;
  readonly ticket: number;
  readonly title: string;
}

type Attempt = Landed | Stopped;

const NONE = 0;

function branchOf(options: Pick<PushOptions, "ticket">): string {
  return `merge-ticket-${options.ticket}`;
}

function deleteRemoteBranch(options: PushOptions): void {
  const branch = branchOf(options);
  if (git(options, "ls-remote", "--exit-code", "--heads", "origin", branch).ok) {
    git(options, "push", "-q", "origin", "--delete", branch);
  }
}

function onOrigin(options: PushOptions, sha: string): boolean {
  const listed = git(options, "ls-remote", "--heads", "origin", branchOf(options));
  return listed.ok && listed.output.startsWith(`${sha}\t`);
}

function pushBranch(options: PushOptions, sha: string): Step {
  const branch = branchOf(options);
  if (onOrigin(options, sha)) {
    options.log(
      `${branch} is already at ${sha} on origin: not pushing again. If its Check run is red, its failed jobs are rerun once, in case they were flaky.`,
    );
    return DONE;
  }
  const pushed = git(options, "push", "-q", "--force", "origin", `${sha}:refs/heads/${branch}`);
  if (!pushed.ok) {
    return stop(`git push origin ${sha}:${branch} failed; nothing was merged.\n${tail(pushed.output)}`);
  }
  options.log(`Pushed ${branch} at ${sha}.`);
  return DONE;
}

function adviceOn(options: PushOptions, watched: Stopped): string {
  const branch = branchOf(options);
  const resume = `run pnpm merge-ticket ${options.ticket} --continue`;
  if (watched.cutOff === true) {
    return `The merge is on ${branch}: a rerun would hit the same limit, so make the job fit it, commit, then ${resume}.`;
  }
  if (watched.jobs.length === NONE) {
    return `The merge is on ${branch}: fix what stopped it, commit any change there, then ${resume}, which first merges a moved v1 into it.`;
  }
  return `The merge is on ${branch}: its failed jobs were rerun once, so fix it there and commit, then ${resume}.`;
}

function nothingMerged(options: PushOptions, stopped: Stopped, on: string): Stopped {
  return { ...stopped, reason: `${stopped.reason}\n${on}\nNothing was merged. ${adviceOn(options, stopped)}` };
}

function greenOnCi(options: PushOptions, sha: string): Step {
  const branch = branchOf(options);
  if (options.queue.required) {
    options.log(`v1 lands through the merge queue: its merge_group Check run is the gate, not ${branch}'s push run.`);
    return DONE;
  }
  options.log(`v1 has no merge queue yet: waiting for ${branch}'s Check run before enqueuing.`);
  const watched = options.ci(branch, sha);
  if (watched.kind === "stopped") {
    return nothingMerged(options, watched, `That Check run was on ${branch} at ${sha}.`);
  }
  return DONE;
}

function pushedAndGreen(options: PushOptions, sha: string): Step {
  const pushed = pushBranch(options, sha);
  if (pushed.kind === "stopped") {
    return pushed;
  }
  return greenOnCi(options, sha);
}

function push({ options }: { readonly options: PushOptions }): Attempt {
  const sha = git(options, "rev-parse", "HEAD").output;
  const branch = branchOf(options);
  const watched = pushedAndGreen(options, sha);
  if (watched.kind === "stopped") {
    return watched;
  }
  const landed = options.queue.land({ branch, sha, title: titleOf(options) });
  if (landed.kind === "stopped") {
    return nothingMerged(options, landed, `The pull request's head is ${branch} at ${sha}.`);
  }
  return landed;
}

export type { Attempt, PushOptions, Queue };
export { branchOf, deleteRemoteBranch, push };
