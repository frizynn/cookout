import { COMPLETED, RUN, done, ghOnPath, view } from "./lib/fake-gh.ts";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { expect, it, onTestFinished } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";

const LAST = -1;
const EXECUTABLE = 0o755;
const PR = "https://github.com/o/r/pull/9";
const QUEUE_RUN = { databaseId: 50, headBranch: "gh-readonly-queue/v1/pr-9-abc", headSha: "abc" };
const GREEN = view({ jobs: [done("lint"), done("checked")], status: COMPLETED });
const EXIT_OK = 0;
const ENQUEUED = new RegExp(`^merge-ticket: Enqueued ${PR} in v1's merge queue at [0-9a-f]{40}\\.$`, "u");
const IDENTITY = [
  ["user.email", "test@example.com"],
  ["user.name", "Test"],
  ["commit.gpgsign", "false"],
] as const;
const MERGED = { autoMergeRequest: null, isInMergeQueue: false, mergeCommit: { oid: "m3rg3" }, state: "MERGED" };

function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function initRepos(): { readonly origin: string; readonly work: string } {
  const root = mkdtempSync(path.join(tmpdir(), "merge-queue-"));
  onTestFinished(() => {
    rmSync(root, { force: true, recursive: true });
  });
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "work");
  git(root, "init", "-q", "--bare", "-b", "v1", origin);
  git(root, "init", "-q", "-b", "v1", work);
  for (const [key, value] of IDENTITY) {
    git(work, "config", key, value);
  }
  git(work, "remote", "add", "origin", origin);
  return { origin, work };
}

function commitFile(work: string, file: string, message: string): void {
  writeFileSync(path.join(work, file), `${file}\n`);
  git(work, "add", file);
  git(work, "commit", "-q", "-m", message);
}

function ticketRepo(): { readonly origin: string; readonly work: string } {
  const repos = initRepos();
  commitFile(repos.work, "a.txt", "first");
  git(repos.work, "push", "-q", "origin", "v1");
  git(repos.work, "checkout", "-q", "-b", "ticket-7");
  commitFile(repos.work, "b.txt", "the ticket");
  git(repos.work, "fetch", "-q", "origin");
  return repos;
}

function stubbedBin(): string {
  const bin = ghOnPath({
    "api repos/{owner}/{repo}/rules/branches/v1": ["1"],
    "issue view": ["Add the c table"],
    list: [RUN, [QUEUE_RUN], [{ databaseId: 50 }]],
    "pr list": [[{ number: 9, url: PR }]],
    "pr merge": [""],
    "pr view": [MERGED],
    view: [GREEN],
  });
  writeFileSync(path.join(bin, "pnpm"), "#!/bin/sh\nexit 0\n");
  chmodSync(path.join(bin, "pnpm"), EXECUTABLE);
  return bin;
}

function mergeTicket(bin: string, work: string): { readonly lines: readonly string[]; readonly status: number | null } {
  const script = `PATH="$0:$PATH" node --import "$0/no-sleep.mjs" "$@" 2>&1`;
  const ran = spawnSync("sh", ["-c", script, bin, path.resolve("scripts/merge-ticket.ts"), "7", "--fixes-red-v1"], {
    cwd: work,
    encoding: "utf8",
  });
  return { lines: ran.stdout.trimEnd().split("\n"), status: ran.status };
}

it("lands a --fixes-red-v1 merge through the queue, printing the merge queue's run and v1's new SHA", {
  timeout: 20_000,
}, () => {
  expect.hasAssertions();

  const bin = stubbedBin();
  const { origin, work } = ticketRepo();
  const before = git(origin, "rev-parse", "v1");

  const { lines, status } = mergeTicket(bin, work);

  const calls = readFileSync(path.join(bin, "calls.log"), "utf8").trim().split("\n");

  expect([status, lines.at(LAST)]).toStrictEqual([EXIT_OK, "RESULT: MERGED m3rg3"]);
  expect(lines).toStrictEqual(
    expect.arrayContaining([
      "merge-ticket: v1 lands through the merge queue: its merge_group Check run is the gate, not merge-ticket-7's push run.",
      expect.stringMatching(ENQUEUED),
      "merge-ticket: Watching the merge queue's Check run of gh-readonly-queue/v1/pr-9-abc, run 50.",
      "merge-ticket: merged ticket-7 into v1 at m3rg3, through its pull request from merge-ticket-7.",
    ]),
  );
  expect(calls.filter((call) => call.includes("--branch v1"))).toStrictEqual([]);
  expect(git(origin, "rev-parse", "v1")).toBe(before);
});
