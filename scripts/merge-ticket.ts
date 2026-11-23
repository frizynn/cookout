import type { MergeOptions, MergeRules, Merged } from "./lib/merge-ticket.ts";
import { continueMerge, mergeTicket } from "./lib/merge-ticket.ts";
import { fail } from "./lib/tools.ts";
import { spawnSync } from "node:child_process";
import { waitForCi } from "./lib/ci-wait.ts";

const SCRIPT = "merge-ticket";
const ATTEMPTS = 5;
const NONE = 0;
const EXIT_SUCCESS = 0;
const ARGUMENT = 2;
const argument = process.argv.at(ARGUMENT) ?? "";
const resuming = process.argv.includes("--continue");
const fixesRedV1 = process.argv.includes("--fixes-red-v1");

function pnpm(...args: readonly string[]): readonly string[] {
  return ["pnpm", "run", "--silent", ...args];
}

function titleOf(ticket: number): string {
  const issue = spawnSync("gh", ["issue", "view", String(ticket), "--json", "title", "--jq", ".title"], {
    encoding: "utf8",
  });
  if (issue.status !== EXIT_SUCCESS) {
    return fail(SCRIPT, `gh issue view ${ticket} failed: ${issue.stderr}`);
  }
  return issue.stdout.trim();
}

const rules: MergeRules = {
  adrs: "docs/adr",
  appendOnly: ["app/modules/storage/lib/server/migrations.ts"],
  hunks: [
    { file: "app/modules/storage/lib/server/migrations.ts", resolve: "append" },
    { file: "vitest.config.ts", resolve: "lower" },
  ],
  regenerate: [
    { command: pnpm("validators"), files: String.raw`^app/modules/sdk/lib/generated/` },
    { command: pnpm("api:write"), files: String.raw`^api/[^/]+\.api\.md$` },
    { command: pnpm("lint:baseline"), files: String.raw`^lint-baseline\.json$` },
  ],
};

const ticket = Number(argument);
if (!Number.isInteger(ticket) || ticket <= NONE) {
  fail(SCRIPT, "usage: pnpm merge-ticket <N> [--continue] [--fixes-red-v1], where ticket-N is a local branch.");
}

function run(options: MergeOptions): Merged {
  if (resuming) {
    return continueMerge(options);
  }
  return mergeTicket(options);
}

function log(line: string): void {
  console.log(`${SCRIPT}: ${line}`);
}

interface Gate {
  readonly advice: string;
  readonly args: readonly string[];
  readonly base: readonly string[];
  readonly subject: string;
}

function requireGreen({ advice, args, base, subject }: Gate): void {
  const step = waitForCi({ args, base, log, subject });
  if (step.kind === "stopped") {
    fail(SCRIPT, `${step.reason}\nNothing was merged. ${advice}`);
  }
}

function gitOutput(...args: readonly string[]): string {
  const ran = spawnSync("git", args, { encoding: "utf8" });
  if (ran.status !== EXIT_SUCCESS) {
    return fail(SCRIPT, `git ${args.join(" ")} failed: ${ran.stderr}`);
  }
  return ran.stdout.trim();
}

if (fixesRedV1) {
  log(
    "WARNING: --fixes-red-v1 skips the check of v1's latest Check run. Use it only for the ticket that fixes a red v1.",
  );
} else {
  requireGreen({
    advice: `If ticket-${ticket} is the fix for that red, run pnpm merge-ticket ${ticket} --fixes-red-v1.`,
    args: ["--branch", "v1"],
    base: [],
    subject: "v1",
  });
}
requireGreen({
  advice: `Push ticket-${ticket} and wait until every job of its Check run passes.`,
  args: ["--branch", `ticket-${ticket}`, "--commit", gitOutput("rev-parse", `ticket-${ticket}`)],
  base: ["--branch", "v1", "--commit", gitOutput("merge-base", `ticket-${ticket}`, "origin/v1")],
  subject: `ticket-${ticket}`,
});

const merged: Merged = run({
  attempts: ATTEMPTS,
  check: ["pnpm", "check"],
  cwd: process.cwd(),
  install: ["pnpm", "install", "--frozen-lockfile"],
  log,
  rules,
  ticket,
  title: titleOf(ticket),
});

function shaOf(outcome: Merged): string {
  if (outcome.ok) {
    return outcome.sha;
  }
  return fail(SCRIPT, outcome.reason);
}

const sha = shaOf(merged);
log(`merged ticket-${ticket} into v1 at ${sha}; waiting for its v1 Check run.`);
const watched = waitForCi({ args: ["--branch", "v1", "--commit", sha], base: [], log, subject: "v1's merge" });
if (watched.kind === "stopped") {
  fail(
    SCRIPT,
    `${watched.reason}\nticket-${ticket} is merged into v1 at ${sha}, but v1 is not green. Fix v1 before anything else merges.`,
  );
}
console.log(`${SCRIPT}: merged ticket-${ticket} into v1 at ${sha}, and its v1 Check run is green.`);
console.log(sha);
