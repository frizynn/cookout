import { field, list, parseJson, text } from "./json.ts";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import type { FileTiming } from "./slowest-files.ts";
import type { Outcome } from "./tools.ts";
import path from "node:path";
import { readTimings } from "./slowest-files.ts";
import { tmpdir } from "node:os";

type Gh = (args: readonly string[]) => Outcome<string>;

interface Splitting {
  readonly files: readonly string[];
  readonly shard: string;
  readonly timings: readonly FileTiming[];
}

interface Split {
  readonly files: readonly string[];
  readonly seconds: number;
}

interface Fetching {
  readonly gh: Gh;
  readonly run: string;
}

interface Recorded {
  readonly run: string;
  readonly timings: readonly FileTiming[];
}

interface Artifact {
  readonly createdAt: string;
  readonly name: string;
  readonly run: string;
}

interface Shard {
  readonly index: number;
  readonly total: number;
}

interface Planning extends Fetching {
  readonly files: Outcome<readonly string[]>;
  readonly shard: string;
}

interface Plan {
  readonly args: readonly string[];
  readonly line: string;
}

const BROWSER_TESTS = "app/modules/routes/tests/browser";
const ARTIFACT_PREFIX = "test-timings-browser-";
const FIRST_ARTIFACT = `${ARTIFACT_PREFIX}1`;
const REPORT = "browser.json";
const SHARD = /^(?<index>\d+)\/(?<total>\d+)$/v;
const FIRST = 1;
const NONE = 0;
const DECIMALS = 1;
const EMPTY: Split = { files: [], seconds: NONE };

function boundsOf(label: string): Shard {
  const [, index = "", total = ""] = SHARD.exec(label) ?? [];
  return { index: Number(index), total: Number(total) };
}

function shardOf(label: string): Outcome<Shard> {
  const shard = boundsOf(label);
  if (shard.index < FIRST || shard.index > shard.total) {
    return { ok: false, reason: `${label} isn't a shard such as 1/3` };
  }
  return { ok: true, value: shard };
}

function recordedSeconds(files: readonly string[], timings: readonly FileTiming[]): ReadonlyMap<string, number> {
  const recorded = new Map<string, number>();
  for (const { file, seconds } of timings.filter((timing) => files.includes(timing.file))) {
    recorded.set(file, (recorded.get(file) ?? NONE) + seconds);
  }
  return recorded;
}

function sum(values: readonly number[]): number {
  let total = NONE;
  for (const value of values) {
    total += value;
  }
  return total;
}

function weighed(files: readonly string[], recorded: ReadonlyMap<string, number>): readonly FileTiming[] {
  const average = sum([...recorded.values()]) / recorded.size;
  return files
    .map((file): FileTiming => ({ file, seconds: recorded.get(file) ?? average }))
    .toSorted((left, right) => right.seconds - left.seconds || left.file.localeCompare(right.file));
}

function withFile(shards: readonly Split[], { file, seconds }: FileTiming): readonly Split[] {
  const least = Math.min(...shards.map((shard) => shard.seconds));
  const at = shards.findIndex((shard) => shard.seconds === least);
  return shards.map((shard, index) => {
    if (index !== at) {
      return shard;
    }
    return { files: [...shard.files, file], seconds: shard.seconds + seconds };
  });
}

function split(weights: readonly FileTiming[], { index, total }: Shard): Split {
  let shards: readonly Split[] = Array.from({ length: total }, () => EMPTY);
  for (const weight of weights) {
    shards = withFile(shards, weight);
  }
  const { files, seconds } = shards[index - FIRST] ?? EMPTY;
  return { files: files.toSorted(), seconds };
}

function shardByTime({ files, shard, timings }: Splitting): Outcome<Split> {
  const parsed = shardOf(shard);
  if (!parsed.ok) {
    return parsed;
  }
  const recorded = recordedSeconds(files, timings);
  if (recorded.size === NONE) {
    return { ok: false, reason: "no browser test file has a recorded time" };
  }
  return { ok: true, value: split(weighed(files, recorded), parsed.value) };
}

function textIn(json: unknown, key: string): string {
  return text(field(json, key)) ?? "";
}

function artifactOf(artifact: unknown): readonly Artifact[] {
  const run = field(field(artifact, "workflow_run"), "id");
  const [createdAt, name] = [textIn(artifact, "created_at"), textIn(artifact, "name")];
  if (field(artifact, "expired") !== false || typeof run !== "number" || createdAt === "") {
    return [];
  }
  return [{ createdAt, name, run: String(run) }];
}

function artifactsBefore(listing: string, createdAt: string): readonly Artifact[] {
  return (list(field(parseJson(listing), "artifacts")) ?? [])
    .flatMap((artifact) => artifactOf(artifact))
    .filter((artifact) => artifact.createdAt < createdAt)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function timingsIn(dir: string): readonly FileTiming[] {
  return readdirSync(dir, { encoding: "utf8", recursive: true })
    .filter((file) => path.basename(file) === REPORT)
    .flatMap((file) => readTimings({ base: BROWSER_TESTS, file: path.join(dir, file), runner: "playwright" }));
}

function downloaded(gh: Gh, artifacts: readonly Artifact[]): Outcome<readonly FileTiming[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "browser-timings-"));
  try {
    for (const { name, run } of artifacts) {
      const ran = gh(["run", "download", run, "--name", name, "--dir", path.join(dir, name)]);
      if (!ran.ok) {
        return ran;
      }
    }
    return { ok: true, value: timingsIn(dir) };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

interface Newest {
  readonly createdAt: string;
  readonly run: string;
}

function askedAt(gh: Gh, run: string): Outcome<string> {
  const asking = gh(["api", `repos/{owner}/{repo}/actions/runs/${run}`]);
  if (!asking.ok) {
    return asking;
  }
  return { ok: true, value: textIn(parseJson(asking.value), "created_at") };
}

function newestBefore(gh: Gh, run: string): Outcome<Newest> {
  const createdAt = askedAt(gh, run);
  if (!createdAt.ok) {
    return createdAt;
  }
  const listing = gh(["api", `repos/{owner}/{repo}/actions/artifacts?name=${FIRST_ARTIFACT}&per_page=100`]);
  if (!listing.ok) {
    return listing;
  }
  const found = artifactsBefore(listing.value, createdAt.value).map(
    (artifact): Outcome<Newest> => ({
      ok: true,
      value: { createdAt: createdAt.value, run: artifact.run },
    }),
  );
  return found[NONE] ?? { ok: false, reason: `no Check run recorded browser timings before run ${run}` };
}

function runArtifacts(gh: Gh, run: string, createdAt: string): Outcome<readonly Artifact[]> {
  const listing = gh(["api", `repos/{owner}/{repo}/actions/runs/${run}/artifacts?per_page=100`]);
  if (!listing.ok) {
    return listing;
  }
  const artifacts = artifactsBefore(listing.value, createdAt);
  return { ok: true, value: artifacts.filter((artifact) => artifact.name.startsWith(ARTIFACT_PREFIX)) };
}

function recordedBrowserTimings({ gh, run }: Fetching): Outcome<Recorded> {
  const newest = newestBefore(gh, run);
  if (!newest.ok) {
    return newest;
  }
  const artifacts = runArtifacts(gh, newest.value.run, newest.value.createdAt);
  if (!artifacts.ok) {
    return artifacts;
  }
  const timings = downloaded(gh, artifacts.value);
  if (!timings.ok) {
    return timings;
  }
  return { ok: true, value: { run: newest.value.run, timings: timings.value } };
}

interface Timed {
  readonly all: readonly string[];
  readonly recorded: Recorded;
}

function recordedFor({ files, gh, run }: Planning): Outcome<Timed> {
  if (!files.ok) {
    return files;
  }
  if (run === "") {
    return { ok: false, reason: "this isn't a GitHub Actions run" };
  }
  const recorded = recordedBrowserTimings({ gh, run });
  if (!recorded.ok) {
    return recorded;
  }
  return { ok: true, value: { all: files.value, recorded: recorded.value } };
}

function timedPlan(planning: Planning): Outcome<Plan> {
  const found = recordedFor(planning);
  if (!found.ok) {
    return found;
  }
  const { all, recorded } = found.value;
  const timed = shardByTime({ files: all, shard: planning.shard, timings: recorded.timings });
  if (!timed.ok) {
    return timed;
  }
  const { files, seconds } = timed.value;
  const line = `browser shard ${planning.shard}: ${String(files.length)} of ${String(all.length)} files, ${seconds.toFixed(DECIMALS)}s of test time as run ${recorded.run} recorded it`;
  return { ok: true, value: { args: [`--record-shard=${planning.shard}`, ...files], line } };
}

function browserShardPlan(planning: Planning): Plan {
  const timed = timedPlan(planning);
  if (timed.ok) {
    return timed.value;
  }
  return {
    args: [`--shard=${planning.shard}`],
    line: `browser shard ${planning.shard}: split by test count, since ${timed.reason}`,
  };
}

export type { Plan };
export { browserShardPlan };
