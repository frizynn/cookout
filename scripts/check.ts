import { spawn } from "node:child_process";

type Check = {
  readonly name: string;
  readonly job: string;
  readonly script: ReadonlyArray<string>;
  readonly budget: number;
  readonly afterTests?: true;
};
type Outcome = Check & { readonly code: number; readonly output: string; readonly seconds: number };

const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(`--${name}=`.length);
const job = option("job");
const shard = option("shard");
const base = option("base");

const testScript = (): ReadonlyArray<string> => {
  if (shard) return ["test:shard", `--shard=${shard}`];
  return process.argv.includes("--merge") ? ["test:merge"] : ["test"];
};

const checks: ReadonlyArray<Check> = [
  { name: "lint", job: "lint", script: base ? ["lint", `--base=${base}`] : ["lint"], budget: 8 },
  { name: "canaries", job: "lint", script: ["canaries"], budget: 9 },
  { name: "types", job: "types", script: ["typecheck"], budget: 5 },
  { name: "seams", job: "seams", script: ["seams"], budget: 4 },
  { name: "tests", job: "tests", script: testScript(), budget: 13 },
  { name: "knip", job: "knip", script: ["knip"], budget: 5 },
  { name: "validators", job: "drift", script: ["validators:check"], budget: 5 },
  { name: "hygiene", job: "drift", script: ["hygiene"], budget: 3 },
  { name: "docs", job: "drift", script: ["docs"], budget: 3 },
  { name: "format", job: "format", script: ["format:check"], budget: 3, afterTests: true },
];

const run = (check: Check): Promise<Outcome> =>
  new Promise((resolve) => {
    const started = performance.now();
    const child = spawn("pnpm", ["run", "--silent", ...check.script], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (error) => (output += error.message));
    child.on("close", (code) =>
      resolve({ ...check, code: code ?? 1, output, seconds: (performance.now() - started) / 1000 }),
    );
  });

const overBudget = (outcome: Outcome) => outcome.seconds > outcome.budget;
const passed = (outcome: Outcome) => outcome.code === 0 && !overBudget(outcome);

const statusOf = (outcome: Outcome) => {
  if (outcome.code !== 0) return "FAIL";
  return overBudget(outcome) ? "SLOW" : "ok  ";
};

const report = (outcome: Outcome) => {
  const status = statusOf(outcome);
  console.log(`${status} ${outcome.name} (${outcome.seconds.toFixed(1)}s, budget ${outcome.budget}s)`);
  if (outcome.code !== 0) console.log(outcome.output.trimEnd().replace(/^/gm, "     "));
  if (overBudget(outcome)) console.log(`     ${outcome.name} took longer than its ${outcome.budget}s budget.`);
};

const selected = checks.filter((check) => job === undefined || check.job === job);
if (selected.length === 0) {
  console.error(`check: no checks in job ${job}. Jobs: ${[...new Set(checks.map((check) => check.job))].join(", ")}`);
  process.exit(1);
}

const outcomes = await Promise.all(selected.filter((check) => !check.afterTests).map(run));
outcomes.push(...(await Promise.all(selected.filter((check) => check.afterTests).map(run))));
outcomes.forEach(report);
process.exitCode = outcomes.every(passed) ? 0 : 1;
