import type {
  Again,
  Dropped,
  Entry,
  Gating,
  Landed,
  Landing,
  Left,
  PullRequest,
  QueueOptions,
  QueueRun,
  Waiting,
} from "./merge-queue-types.ts";
import type { Step, Stopped } from "./merge-steps.ts";
import { field, list, parseJson, text } from "./json.ts";
import { run, stop, tail } from "./merge-steps.ts";
import { ciGreen } from "./ci-gate.ts";

const NONE = 0;
const NEXT = 1;
const BASE = "v1";
const MERGED = "MERGED";
const CLOSED = "CLOSED";
const MERGE_GROUP = "merge_group";
const OPEN = ["--base", BASE, "--state", "open", "--json", "number,url"];
const PR_STATE = "state,mergeCommit,autoMergeRequest,isInMergeQueue";
const QUEUE_RUNS = ["run", "list", "--workflow", "Check", "--event", MERGE_GROUP, "--limit", "20"];
const RULES = `repos/{owner}/{repo}/rules/branches/${BASE}`;
const QUEUE_RULES = '[.[] | select(.type == "merge_queue")] | length';
const REPOSITORY = ["api", "graphql", "-F", "owner={owner}", "-F", "name={repo}"];
const REMOVED = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      timelineItems(last: 1, itemTypes: [REMOVED_FROM_MERGE_QUEUE_EVENT]) {
        nodes { ... on RemovedFromMergeQueueEvent { reason } }
      }
    }
  }
}`;
const REASON = ".data.repository.pullRequest.timelineItems.nodes[0].reason // empty";

function gh(options: QueueOptions, ...args: readonly string[]): ReturnType<typeof run> {
  return run(options.cwd, ...options.gh, ...args);
}

function left(reason: string): Dropped {
  return { greenRun: NONE, kind: "left", reason };
}

function queueRequired(options: Pick<QueueOptions, "cwd" | "gh" | "log">): boolean {
  const ran = run(options.cwd, ...options.gh, "api", RULES, "--jq", QUEUE_RULES);
  if (!ran.ok) {
    options.log(
      `Could not read v1's rules (gh api ${RULES}), so landing as if v1 had no merge queue.\n${tail(ran.output)}`,
    );
    return false;
  }
  return Number(ran.output) > NONE;
}

function pullRequestIn(output: string): PullRequest | "none" {
  const first = (list(parseJson(output)) ?? []).at(NONE);
  const number = field(first, "number");
  const url = field(first, "url");
  if (typeof number !== "number" || typeof url !== "string") {
    return "none";
  }
  return { number, url };
}

function openPullRequest(options: QueueOptions, landing: Landing): PullRequest | Stopped {
  const listed = gh(options, "pr", "list", "--head", landing.branch, ...OPEN);
  if (!listed.ok) {
    return stop(`Could not list ${landing.branch}'s pull requests: gh pr list\n${tail(listed.output)}`);
  }
  const found = pullRequestIn(listed.output);
  if (found === "none") {
    return stop(`gh pr list printed no pull request for ${landing.branch}.\n${tail(listed.output)}`);
  }
  return found;
}

function createPullRequest(options: QueueOptions, landing: Landing): PullRequest | Stopped {
  const body = `Opened by \`pnpm merge-ticket\` to land ${landing.branch} on v1 through the merge queue.`;
  const args = ["--head", landing.branch, "--base", BASE, "--title", landing.title, "--body", body];
  const created = gh(options, "pr", "create", ...args);
  if (!created.ok) {
    return stop(`Could not open a pull request from ${landing.branch} into v1: gh pr create\n${tail(created.output)}`);
  }
  const opened = openPullRequest(options, landing);
  if (!("kind" in opened)) {
    options.log(`Opened ${landing.branch}'s pull request into v1: ${opened.url}`);
  }
  return opened;
}

function pullRequestOf(options: QueueOptions, landing: Landing): PullRequest | Stopped {
  const open = openPullRequest(options, landing);
  if ("kind" in open) {
    return createPullRequest(options, landing);
  }
  options.log(`Reusing ${landing.branch}'s pull request into v1: ${open.url}`);
  return open;
}

function enqueue(options: QueueOptions, pr: PullRequest, landing: Landing): Step {
  const auto = ["--auto"].filter(() => options.required);
  const args = ["pr", "merge", String(pr.number), "--merge", ...auto, "--match-head-commit", landing.sha];
  const ran = gh(options, ...args, "--subject", landing.title);
  if (!ran.ok) {
    return stop(`Could not enqueue ${pr.url}: gh ${args.join(" ")}\n${tail(ran.output)}`);
  }
  if (options.required) {
    options.log(`Enqueued ${pr.url} in v1's merge queue at ${landing.sha}.`);
  } else {
    options.log(`v1 has no merge queue yet: merging ${pr.url} at ${landing.sha} directly, as its Check run is green.`);
  }
  return { kind: "done" };
}

function removedReason(options: QueueOptions, pr: PullRequest): string {
  const ran = gh(options, ...REPOSITORY, "-F", `number=${pr.number}`, "-f", `query=${REMOVED}`, "--jq", REASON);
  if (!ran.ok || ran.output === "") {
    return "GitHub gave no reason";
  }
  return ran.output;
}

function openState(options: QueueOptions, pr: PullRequest, value: unknown): Left | "queued" {
  if (field(value, "isInMergeQueue") === true || field(value, "autoMergeRequest") !== null) {
    return "queued";
  }
  return left(`${pr.url} left the merge queue without merging: ${removedReason(options, pr)}.`);
}

function stateIn(options: QueueOptions, pr: PullRequest, value: unknown): Left | "queued" {
  const state = field(value, "state");
  if (state === MERGED) {
    return { kind: "landed", sha: text(field(field(value, "mergeCommit"), "oid")) ?? "" };
  }
  if (state === CLOSED) {
    return left(`${pr.url} was closed without merging.`);
  }
  return openState(options, pr, value);
}

function stateOf(options: QueueOptions, pr: PullRequest): Left | "queued" {
  const viewed = gh(options, "pr", "view", String(pr.number), "--json", PR_STATE);
  const value = parseJson(viewed.output);
  if (!viewed.ok || typeof field(value, "state") !== "string") {
    return stop(`Could not read ${pr.url}: gh pr view\n${tail(viewed.output)}`);
  }
  return stateIn(options, pr, value);
}

function awaitPullRequest(options: QueueOptions, pr: PullRequest, waited: number): Left {
  const state = stateOf(options, pr);
  if (state !== "queued") {
    return state;
  }
  if (waited >= options.polls) {
    return stop(`${pr.url} was still waiting to merge after ${options.polls} waits.`);
  }
  options.log(`${pr.url} is waiting to merge: waiting (${waited + NEXT} of ${options.polls}).`);
  options.sleep();
  return awaitPullRequest(options, pr, waited + NEXT);
}

function queueRunIn(value: unknown): readonly QueueRun[] {
  const branch = field(value, "headBranch");
  const runNumber = field(value, "databaseId");
  if (typeof branch !== "string" || typeof runNumber !== "number") {
    return [];
  }
  return [{ branch, kind: "run", runNumber, sha: text(field(value, "headSha")) ?? "" }];
}

function queueRunOf(options: QueueOptions, { after, pr }: Waiting): QueueRun | "none" {
  const listed = gh(options, ...QUEUE_RUNS, "--json", "databaseId,headBranch,headSha");
  const prefix = `gh-readonly-queue/${BASE}/pr-${pr.number}-`;
  return (
    (list(parseJson(listed.output)) ?? [])
      .flatMap((value) => queueRunIn(value))
      .find((queueRun) => queueRun.branch.startsWith(prefix) && queueRun.runNumber > after) ?? "none"
  );
}

function queueRunOrState(options: QueueOptions, settle: Waiting): Left | QueueRun | "queued" {
  const found = queueRunOf(options, settle);
  if (found !== "none") {
    return found;
  }
  return stateOf(options, settle.pr);
}

function awaitQueueRun(options: QueueOptions, settle: Waiting, waited: number): Left | QueueRun {
  const found = queueRunOrState(options, settle);
  if (found !== "queued") {
    return found;
  }
  if (waited >= options.appear) {
    return stop(`${settle.pr.url} is queued, but its merge queue Check run never started.`);
  }
  options.log(`${settle.pr.url} has no merge queue Check run yet: waiting (${waited + NEXT} of ${options.appear}).`);
  options.sleep();
  return awaitQueueRun(options, settle, waited + NEXT);
}

function gate(options: QueueOptions, { pr, queueRun, rerunRed }: Gating): Left {
  options.log(`Watching the merge queue's Check run of ${queueRun.branch}, run ${queueRun.runNumber}.`);
  const gated = ciGreen({
    ...options,
    args: ["--branch", queueRun.branch, "--commit", queueRun.sha],
    base: [],
    event: MERGE_GROUP,
    rerunRed,
    subject: queueRun.branch,
    vouchedBy: "",
  });
  if (gated.kind === "stopped") {
    return gated;
  }
  const outcome = awaitPullRequest(options, pr, NONE);
  if (outcome.kind === "left") {
    return { ...outcome, greenRun: queueRun.runNumber };
  }
  return outcome;
}

function queued(options: QueueOptions, pr: PullRequest, { after, rerunRed }: Entry): Left {
  if (!options.required) {
    return awaitPullRequest(options, pr, NONE);
  }
  const queueRun = awaitQueueRun(options, { after, pr }, NONE);
  if (queueRun.kind !== "run") {
    return queueRun;
  }
  return gate(options, { pr, queueRun, rerunRed });
}

function landedOrStopped(outcome: Left): Landed | Stopped {
  if (outcome.kind === "left") {
    return stop(outcome.reason);
  }
  return outcome;
}

function enqueuedPullRequest(options: QueueOptions, landing: Landing): PullRequest | Stopped {
  const pr = pullRequestOf(options, landing);
  if ("kind" in pr) {
    return pr;
  }
  const enqueued = enqueue(options, pr, landing);
  if (enqueued.kind === "stopped") {
    return enqueued;
  }
  return pr;
}

function enqueueAgain(options: QueueOptions, { first, landing, pr }: Again): Landed | Stopped {
  options.log(`${first.reason}\nIts merge queue run went green on its rerun: enqueuing ${pr.url} again.`);
  const again = enqueue(options, pr, landing);
  if (again.kind === "stopped") {
    return again;
  }
  return landedOrStopped(queued(options, pr, { after: first.greenRun, rerunRed: false }));
}

function landThroughQueue({
  landing,
  options,
}: {
  readonly landing: Landing;
  readonly options: QueueOptions;
}): Landed | Stopped {
  const pr = enqueuedPullRequest(options, landing);
  if ("kind" in pr) {
    return pr;
  }
  const first = queued(options, pr, { after: NONE, rerunRed: true });
  if (first.kind !== "left" || first.greenRun === NONE) {
    return landedOrStopped(first);
  }
  return enqueueAgain(options, { first, landing, pr });
}

export type { Landed, Landing } from "./merge-queue-types.ts";
export { landThroughQueue, queueRequired };
