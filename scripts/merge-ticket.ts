import type { MergeOptions, MergeRules, Merged } from "./lib/merge-ticket.ts";
import { continueMerge, mergeTicket } from "./lib/merge-ticket.ts";
import { ciGreen } from "./lib/ci-gate.ts";
import { fail } from "./lib/tools.ts";
import { spawnSync } from "node:child_process";

const SCRIPT = "merge-ticket";
const ATTEMPTS = 5;
const NONE = 0;
const EXIT_SUCCESS = 0;
const ARGUMENT = 2;
const argument = process.argv.at(ARGUMENT) ?? "";
const resuming = process.argv.includes("--continue");
const fixesRedV1 = process.argv.includes("--fixes-red-v1");
const WAIT_MS = 30_000;
const WAITS = 40;
const SLEEP_SLOT = 0;

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

function sleep(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)), SLEEP_SLOT, SLEEP_SLOT, WAIT_MS);
}

function requireGreen(subject: string, args: readonly string[], advice: string): void {
  const step = ciGreen({ args, cwd: process.cwd(), gh: ["gh"], log, polls: WAITS, sleep, subject });
  if (step.kind === "stopped") {
    fail(SCRIPT, `${step.reason}\nNothing was merged. ${advice}`);
  }
}

function ticketHead(): string {
  const head = spawnSync("git", ["rev-parse", `ticket-${ticket}`], { encoding: "utf8" });
  if (head.status !== EXIT_SUCCESS) {
    return fail(SCRIPT, `git rev-parse ticket-${ticket} failed: ${head.stderr}`);
  }
  return head.stdout.trim();
}

if (fixesRedV1) {
  log(
    "WARNING: --fixes-red-v1 skips the check of v1's latest Check run. Use it only for the ticket that fixes a red v1.",
  );
} else {
  requireGreen(
    "v1",
    ["--branch", "v1"],
    `If ticket-${ticket} is the fix for that red, run pnpm merge-ticket ${ticket} --fixes-red-v1.`,
  );
}
requireGreen(
  `ticket-${ticket}`,
  ["--branch", `ticket-${ticket}`, "--commit", ticketHead()],
  `Push ticket-${ticket} and wait until every job of its Check run passes.`,
);

const merged: Merged = run({
  attempts: ATTEMPTS,
  check: ["pnpm", "check"],
  cwd: process.cwd(),
  install: ["pnpm", "install"],
  log,
  rules,
  ticket,
  title: titleOf(ticket),
});

if (merged.ok) {
  console.log(`${SCRIPT}: merged ticket-${ticket} into v1 at ${merged.sha}`);
  console.log(merged.sha);
} else {
  fail(SCRIPT, merged.reason);
}
