import { once } from "node:events";
import { spawn } from "node:child_process";

interface Check {
  readonly afterTests?: true;
  readonly budget: number;
  readonly job: string;
  readonly name: string;
  readonly script: readonly string[];
}

interface Outcome {
  readonly check: Check;
  readonly code: number;
  readonly output: string;
  readonly seconds: number;
}

interface Closed {
  readonly code: number;
  readonly error: string;
}

const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const NONE = 0;
const DECIMALS = 1;
const MS_PER_SECOND = 1000;

function option(name: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix)) ?? "";
  return found.slice(prefix.length);
}

const job = option("job");
const shard = option("shard");
const base = option("base");
const inCi = process.argv.includes("--ci");

function testScript(): readonly string[] {
  if (shard !== "") {
    return ["test:shard", `--shard=${shard}`];
  }
  if (process.argv.includes("--merge")) {
    return ["test:merge"];
  }
  return ["test"];
}

function lintScript(): readonly string[] {
  if (base !== "") {
    return ["lint", `--base=${base}`];
  }
  return ["lint"];
}

const checks: readonly Check[] = [
  { budget: 16, job: "lint", name: "lint", script: lintScript() },
  { budget: 18, job: "canaries", name: "canaries", script: ["canaries"] },
  { budget: 10, job: "types", name: "types", script: ["typecheck"] },
  { budget: 16, job: "fixers", name: "fixers", script: ["fixers"] },
  { budget: 8, job: "seams", name: "seams", script: ["seams"] },
  { budget: 26, job: "tests", name: "tests", script: testScript() },
  { budget: 10, job: "knip", name: "knip", script: ["knip"] },
  { budget: 10, job: "drift", name: "validators", script: ["validators:check"] },
  { budget: 6, job: "drift", name: "hygiene", script: ["hygiene"] },
  { budget: 6, job: "drift", name: "docs", script: ["docs"] },
  { budget: 10, job: "drift", name: "api", script: ["api"] },
  { budget: 6, job: "drift", name: "exports", script: ["exports"] },
  { afterTests: true, budget: 6, job: "format", name: "format", script: ["format:check"] },
];

async function closeOf(closing: Promise<readonly unknown[]>): Promise<Closed> {
  try {
    const [code] = await closing;
    if (typeof code === "number") {
      return { code, error: "" };
    }
    return { code: EXIT_FAILURE, error: "" };
  } catch (error) {
    return { code: EXIT_FAILURE, error: String(error instanceof Error && error.message) };
  }
}

async function run(check: Check): Promise<Outcome> {
  const started = performance.now();
  const child = spawn("pnpm", ["run", "--silent", ...check.script], { stdio: ["ignore", "pipe", "pipe"] });
  const chunks: string[] = [];
  child.stdout.on("data", (chunk: unknown) => {
    chunks.push(String(chunk));
  });
  child.stderr.on("data", (chunk: unknown) => {
    chunks.push(String(chunk));
  });
  const closed = await closeOf(once(child, "close"));
  return {
    check,
    code: closed.code,
    output: `${chunks.join("")}${closed.error}`,
    seconds: (performance.now() - started) / MS_PER_SECOND,
  };
}

function overBudget(outcome: Outcome): boolean {
  return outcome.seconds > outcome.check.budget;
}

function passed(outcome: Outcome): boolean {
  return outcome.code === EXIT_SUCCESS;
}

function statusOf(outcome: Outcome): string {
  if (outcome.code !== EXIT_SUCCESS) {
    return "FAIL";
  }
  if (overBudget(outcome)) {
    return "SLOW";
  }
  return "ok  ";
}

function warnOverBudget(outcome: Outcome): void {
  const { budget, name } = outcome.check;
  const warning = `${name} took ${outcome.seconds.toFixed(DECIMALS)}s, over its ${String(budget)}s budget. A time budget warns and never fails the run (ADR 0029).`;
  if (inCi) {
    console.log(`::warning title=${name} over its time budget::${warning}`);
    return;
  }
  console.error(`warning: ${warning}`);
}

function report(outcome: Outcome): void {
  const { budget, name } = outcome.check;
  console.log(`${statusOf(outcome)} ${name} (${outcome.seconds.toFixed(DECIMALS)}s, budget ${String(budget)}s)`);
  if (outcome.code !== EXIT_SUCCESS) {
    console.log(outcome.output.trimEnd().replaceAll(/^/gmu, "     "));
  }
  if (overBudget(outcome)) {
    warnOverBudget(outcome);
  }
}

async function runTogether(selected: readonly Check[]): Promise<readonly Outcome[]> {
  const pending: Promise<Outcome>[] = [];
  for (const check of selected) {
    pending.push(run(check));
  }
  const outcomes = await Promise.all(pending);
  return outcomes;
}

async function runSelected(selected: readonly Check[]): Promise<readonly Outcome[]> {
  const first = await runTogether(selected.filter((check) => check.afterTests !== true));
  const after = await runTogether(selected.filter((check) => check.afterTests === true));
  return [...first, ...after];
}

async function main(): Promise<number> {
  const selected = checks.filter((check) => job === "" || check.job === job);
  if (selected.length === NONE) {
    console.error(`check: no checks in job ${job}. Jobs: ${[...new Set(checks.map((check) => check.job))].join(", ")}`);
    return EXIT_FAILURE;
  }
  const final = await runSelected(selected);
  for (const outcome of final) {
    report(outcome);
  }
  if (final.every((outcome) => passed(outcome))) {
    return EXIT_SUCCESS;
  }
  return EXIT_FAILURE;
}

process.exitCode = await main();
