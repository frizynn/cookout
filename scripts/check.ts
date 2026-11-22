import { spawn } from "node:child_process";

type Check = { readonly name: string; readonly script: string };
type Outcome = Check & { readonly code: number; readonly output: string; readonly seconds: number };

const parallel: ReadonlyArray<Check> = [
  { name: "types", script: "typecheck" },
  { name: "lint", script: "lint" },
  { name: "seams", script: "seams" },
  { name: "knip", script: "knip" },
  { name: "validators", script: "validators:check" },
  { name: "tests", script: "test" },
];
const afterTests: ReadonlyArray<Check> = [{ name: "format", script: "format:check" }];

const run = (check: Check): Promise<Outcome> =>
  new Promise((resolve) => {
    const started = performance.now();
    const child = spawn("pnpm", ["run", "--silent", check.script], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (error) => (output += error.message));
    child.on("close", (code) =>
      resolve({ ...check, code: code ?? 1, output, seconds: (performance.now() - started) / 1000 }),
    );
  });

const report = (outcome: Outcome) => {
  const status = outcome.code === 0 ? "ok  " : "FAIL";
  console.log(`${status} ${outcome.name} (${outcome.seconds.toFixed(1)}s)`);
  if (outcome.code !== 0) console.log(outcome.output.trimEnd().replace(/^/gm, "     "));
};

const outcomes = await Promise.all(parallel.map(run));
outcomes.push(...(await Promise.all(afterTests.map(run))));
outcomes.forEach(report);
process.exitCode = outcomes.every((outcome) => outcome.code === 0) ? 0 : 1;
