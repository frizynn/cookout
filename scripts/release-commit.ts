import type { Outcome } from "./lib/tools.ts";
import { appendFileSync } from "node:fs";
import { fail } from "./lib/tools.ts";
import { parseArgs } from "node:util";
import { releaseChoice } from "./lib/release-commit.ts";
import { spawnSync } from "node:child_process";

const SCRIPT = "release-commit";
const EXIT_SUCCESS = 0;
const TIMEOUT_MS = 60_000;

const { values } = parseArgs({ options: { output: { type: "string" }, summary: { type: "string" } } });

function command(name: string): (args: readonly string[]) => Outcome<string> {
  return (args) => {
    const ran = spawnSync(name, args, { encoding: "utf8", timeout: TIMEOUT_MS });
    if (ran.status !== EXIT_SUCCESS) {
      return {
        ok: false,
        reason: `${name} ${args.join(" ")} failed: ${`${ran.stderr}${String(ran.error ?? "")}`.trim()}`,
      };
    }
    return { ok: true, value: ran.stdout };
  };
}

function appendTo(file: string | undefined, content: string): void {
  if (typeof file === "string" && file !== "") {
    appendFileSync(file, content);
  }
}

const { lines, outcome } = releaseChoice({ gh: command("gh"), git: command("git") });
for (const line of lines) {
  console.log(`${SCRIPT}: ${line}`);
}
appendTo(values.summary, `### The commit to release\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n`);
if (outcome.ok) {
  appendTo(values.output, `sha=${outcome.value}\n`);
} else {
  appendTo(values.summary, `Nothing released: ${outcome.reason}\n`);
  fail(SCRIPT, outcome.reason);
}
