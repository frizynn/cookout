import { slowArguments, slowRun } from "./lib/web-slow.ts";
import { spawnSync } from "node:child_process";

const FIRST_ARGUMENT = 2;
const EXIT_FAILURE = 1;
const PASSED = 0;

const parsed = slowArguments(process.argv.slice(FIRST_ARGUMENT));

if (parsed.ok) {
  const { status } = spawnSync("env", slowRun(parsed), { stdio: ["ignore", "inherit", "inherit"] });
  if (status === PASSED) {
    console.log("RESULT: PASS");
  } else {
    console.log(`RESULT: FAIL (web tests with every view call delayed ${String(parsed.delayMs)} ms)`);
    process.exitCode = EXIT_FAILURE;
  }
} else {
  console.error("usage: pnpm web:slow [ms, default 700] <web test files...>");
  console.log("RESULT: FAIL (usage)");
  process.exitCode = EXIT_FAILURE;
}
