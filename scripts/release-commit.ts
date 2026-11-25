import { DateTime } from "effect";
import type { Outcome } from "./lib/tools.ts";
import { appendFileSync } from "node:fs";
import { fail } from "./lib/tools.ts";
import { parseArgs } from "node:util";
import { releaseChoice } from "./lib/release-commit.ts";
import { releaseGo } from "./lib/release-go.ts";
import { spawnSync } from "node:child_process";

const SCRIPT = "release-commit";
const EXIT_SUCCESS = 0;
const TIMEOUT_MS = 60_000;

const { values } = parseArgs({
  options: {
    event: { type: "string" },
    output: { type: "string" },
    "run-id": { type: "string" },
    summary: { type: "string" },
  },
});

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

const seams = { gh: command("gh"), git: command("git") };
const { lines, outcome } = releaseChoice(seams);
for (const line of lines) {
  console.log(`${SCRIPT}: ${line}`);
}
appendTo(values.summary, `### The commit to release\n\n${lines.map((line) => `- ${line}`).join("\n")}\n\n`);
function released(sha: string): void {
  const go = releaseGo({
    asked: {
      event: values.event ?? "workflow_dispatch",
      nowMillis: DateTime.toEpochMillis(DateTime.nowUnsafe()),
      sha,
      thisRun: values["run-id"] ?? "",
    },
    ...seams,
  });
  if (go.ok) {
    console.log(`${SCRIPT}: ${go.value.line}`);
    appendTo(values.summary, `${go.value.line}\n`);
    appendTo(values.output, `sha=${sha}\ngo=${String(go.value.go)}\n`);
    return;
  }
  appendTo(values.summary, `Nothing released: ${go.reason}\n`);
  fail(SCRIPT, go.reason);
}

if (outcome.ok) {
  released(outcome.value);
} else {
  appendTo(values.summary, `Nothing released: ${outcome.reason}\n`);
  fail(SCRIPT, outcome.reason);
}
