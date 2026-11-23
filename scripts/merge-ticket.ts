import type { MergeOptions, MergeRules, Merged } from "./lib/merge-ticket.ts";
import { continueMerge, mergeTicket } from "./lib/merge-ticket.ts";
import { fail } from "./lib/tools.ts";
import { spawnSync } from "node:child_process";

const SCRIPT = "merge-ticket";
const ATTEMPTS = 5;
const NONE = 0;
const EXIT_SUCCESS = 0;
const ARGUMENT = 2;
const argument = process.argv.at(ARGUMENT) ?? "";
const resuming = process.argv.includes("--continue");

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
  fail(SCRIPT, "usage: pnpm merge-ticket <N> [--continue], where ticket-N is a local branch.");
}

function run(options: MergeOptions): Merged {
  if (resuming) {
    return continueMerge(options);
  }
  return mergeTicket(options);
}

const merged: Merged = run({
  attempts: ATTEMPTS,
  check: ["pnpm", "check"],
  cwd: process.cwd(),
  install: ["pnpm", "install"],
  log: (line): void => {
    console.log(`${SCRIPT}: ${line}`);
  },
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
