import { fail } from "./lib/tools.ts";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { waitForCi } from "./lib/ci-wait.ts";

const SCRIPT = "ci:wait";
const EXIT_SUCCESS = 0;
const NONE = 0;
const SHORT_SHA = 12;

const { values } = parseArgs({ options: { branch: { type: "string" }, sha: { type: "string" } } });

function head(): string {
  const ran = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (ran.status !== EXIT_SUCCESS) {
    return fail(SCRIPT, `git rev-parse HEAD failed: ${ran.stderr}`);
  }
  return ran.stdout.trim();
}

const sha = values.sha ?? head();

function branchFilter(): readonly string[] {
  if (typeof values.branch !== "string") {
    return [];
  }
  return ["--branch", values.branch];
}

const step = waitForCi({
  args: [...branchFilter(), "--commit", sha],
  base: [],
  log: (line) => {
    console.log(`${SCRIPT}: ${line}`);
  },
  subject: sha.slice(NONE, SHORT_SHA),
});

if (step.kind === "stopped") {
  fail(SCRIPT, step.reason);
}
