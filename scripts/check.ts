import { browserTestsFor, ciBrowserShard } from "./lib/browser-selection.ts";
import { changedLines, unchangedSince } from "./lib/changed-lines.ts";
import { checkPlan, reasonLines } from "./lib/check-plan.ts";
import { ciUnitShard, unitTestsFor } from "./lib/test-selection.ts";
import { fetchedCoverageMap, ghCli } from "./lib/coverage-map-fetch.ts";
import { loadReport, osReading } from "./lib/machine-load.ts";
import type { BrowserTests } from "./lib/browser-selection.ts";
import { SUITE_LOCK_FILE } from "./lib/machine-lock.ts";
import type { UnitTests } from "./lib/test-selection.ts";
import { changedFiles } from "./lib/changed-files.ts";
import { ciGreenAtHead } from "./lib/ci-green.ts";
import { runChecks } from "./lib/check-runner.ts";

function option(name: string): string {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix)) ?? "";
  return found.slice(prefix.length);
}

const load = loadReport(osReading);
console.log(load.line);
if (load.warning !== "") {
  console.error(load.warning);
}

const job = option("job");
const shard = option("shard");
const base = option("base");
const inCi = process.argv.includes("--ci");
const all = process.argv.includes("--all");

const V1 = "origin/v1";
const EXIT_SUCCESS = 0;
const EVERYTHING: UnitTests & BrowserTests = { all: true, reason: "" };

const ciGreen = ciGreenAtHead({ asked: !inCi && job === "" && !all, cwd: process.cwd(), gh: ghCli(process.cwd()) });
const local = !inCi && job === "" && !all && !ciGreen.skip;
const changed = changedFiles({ base: V1, cwd: process.cwd() });

function selectedUnitTests(): UnitTests {
  if (!local) {
    return EVERYTHING;
  }
  return unitTestsFor(changed);
}

function selectedBrowserTests(): BrowserTests {
  if (!local) {
    return EVERYTHING;
  }
  const cwd = process.cwd();
  return browserTestsFor({
    changed,
    coverage: () => fetchedCoverageMap({ base: V1, cwd, gh: ghCli(cwd) }),
    cwd,
    history: {
      changedLines: (file) => changedLines({ base: V1, cwd, file }),
      unchangedSince: (commit, file) => unchangedSince({ base: V1, commit, cwd, file }),
    },
  });
}

const unitTests = selectedUnitTests();
const browserTests = selectedBrowserTests();

function ciShard(): typeof ciBrowserShard | null {
  if (!inCi || shard === "") {
    return null;
  }
  if (job === "browser") {
    return ciBrowserShard;
  }
  if (job === "tests") {
    return ciUnitShard;
  }
  return null;
}

function shardArgs(): readonly string[] {
  const planned = ciShard();
  if (planned === null) {
    return [`--shard=${shard}`];
  }
  const shardPlan = planned({ cwd: process.cwd(), gh: ghCli(process.cwd()), run: option("run"), shard });
  console.log(shardPlan.line);
  return shardPlan.args;
}

const plan = checkPlan({
  base,
  browser: browserTests,
  inCi,
  local,
  merge: process.argv.includes("--merge"),
  shard,
  shardArgs: shardArgs(),
  unit: unitTests,
});

function printReasons(): void {
  for (const line of [ciGreen.line, ...reasonLines({ browser: browserTests, unit: unitTests })]) {
    if (line !== "") {
      console.error(line);
    }
  }
}

async function exitCode(): Promise<number> {
  if (ciGreen.skip) {
    console.log(ciGreen.line);
    return EXIT_SUCCESS;
  }
  printReasons();
  const code = await runChecks({
    checks: plan.checks,
    ciOnly: plan.skipped,
    inCi,
    job,
    lockFile: SUITE_LOCK_FILE,
  });
  return code;
}

process.exitCode = await exitCode();
