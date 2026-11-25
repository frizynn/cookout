import { DONE, git, lines, stop, tail } from "./merge-steps.ts";
import type { Step, Stopped } from "./merge-steps.ts";

interface PushOptions {
  readonly ci: (branch: string, sha: string) => Step;
  readonly cwd: string;
  readonly log: (line: string) => void;
  readonly ticket: number;
}

interface Pushed {
  readonly kind: "pushed";
  readonly sha: string;
}

type Attempt = { readonly kind: "moved" } | Pushed | Stopped;

const DOCS = /(?:\.md$|^docs\/|^\.changeset\/)/u;

function branchOf(options: PushOptions): string {
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

function pushBranch(
  options: PushOptions,
  { sha, unchanged }: { readonly sha: string; readonly unchanged: boolean },
): Step {
  const branch = branchOf(options);
  if (unchanged) {
    options.log(
      `${branch} is already at ${sha} on origin: waiting for its existing Check run, not pushing again. If that run is red, its failed jobs are rerun once, in case they were flaky.`,
    );
    return DONE;
  }
  deleteRemoteBranch(options);
  const pushed = git(options, "push", "-q", "origin", `${sha}:refs/heads/${branch}`);
  if (!pushed.ok) {
    return stop(`git push origin ${sha}:${branch} failed; nothing was pushed to v1.\n${tail(pushed.output)}`);
  }
  options.log(`Pushed ${branch} at ${sha}: waiting for its Check run`);
  return DONE;
}

function adviceOn(options: PushOptions, watched: Stopped): string {
  const branch = branchOf(options);
  const resume = `run pnpm merge-ticket ${options.ticket} --continue`;
  if (watched.cutOff === true) {
    return `The merge is on ${branch}: a rerun would hit the same limit, so make the job fit it, commit, then ${resume}.`;
  }
  return `The merge is on ${branch}: its failed jobs were rerun once, so fix it there and commit, then ${resume}.`;
}

function greenOnCi(options: PushOptions, sha: string): Step {
  const branch = branchOf(options);
  const unchanged = onOrigin(options, sha);
  const pushed = pushBranch(options, { sha, unchanged });
  if (pushed.kind === "stopped") {
    return pushed;
  }
  const watched = options.ci(branch, sha);
  if (watched.kind === "stopped") {
    const on = `That Check run was on ${branch} at ${sha}.`;
    return { ...watched, reason: `${watched.reason}\n${on}\nNothing was pushed to v1. ${adviceOn(options, watched)}` };
  }
  return DONE;
}

function fastForwardV1(options: PushOptions, { base, sha }: { readonly base: string; readonly sha: string }): Attempt {
  const pushed = git(options, "push", "-q", "origin", `${sha}:refs/heads/v1`);
  if (pushed.ok) {
    return { kind: "pushed", sha };
  }
  git(options, "fetch", "-q", "origin");
  if (git(options, "rev-parse", "origin/v1").output === base) {
    return stop(`git push origin ${sha}:v1 failed.\n${tail(pushed.output)}`);
  }
  return { kind: "moved" };
}

function docsOnly(options: PushOptions, base: string): boolean {
  return lines(git(options, "diff", "--name-only", base, "HEAD").output).every((file) => DOCS.test(file));
}

interface Push {
  readonly afterGreen: boolean;
  readonly base: string;
  readonly options: PushOptions;
}

function push({ afterGreen, base, options }: Push): Attempt {
  const sha = git(options, "rev-parse", "HEAD").output;
  if (afterGreen && docsOnly(options, base)) {
    options.log(
      `${branchOf(options)} touches only docs and merged the moved v1 cleanly: fast-forwarding v1 to ${sha} without another Check run, as its last run was green`,
    );
    return fastForwardV1(options, { base, sha });
  }
  const watched = greenOnCi(options, sha);
  if (watched.kind === "stopped") {
    return watched;
  }
  return fastForwardV1(options, { base, sha });
}

export type { Attempt, PushOptions, Pushed };
export { branchOf, deleteRemoteBranch, push };
