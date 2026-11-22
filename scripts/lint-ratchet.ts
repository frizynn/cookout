import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import { counts, field, list, parseJson, text } from "./lib/json.ts";
import { type Diagnostic, describe, fail, oxlint, unwrap } from "./lib/tools.ts";

type Counts = Readonly<Record<string, number>>;

const SCRIPT = "lint-ratchet";
const BASELINE = "lint-baseline.json";
const args = process.argv.slice(2);
const files = args.filter((arg) => !arg.startsWith("--"));
const writing = args.includes("--write");
const base = args.find((arg) => arg.startsWith("--base="))?.slice("--base=".length) ?? "HEAD";

const keyOf = (diagnostic: Diagnostic) => `${diagnostic.filename} ${diagnostic.code}`;

const tally = (diagnostics: ReadonlyArray<Diagnostic>): Counts => {
  const totals = new Map<string, number>();
  for (const diagnostic of diagnostics) totals.set(keyOf(diagnostic), (totals.get(keyOf(diagnostic)) ?? 0) + 1);
  return Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)));
};

const ignorePatterns = (): ReadonlyArray<string> => {
  const patterns = list(field(parseJson(readFileSync(".oxlintrc.json", "utf8")), "ignorePatterns"));
  return (
    patterns?.flatMap((pattern) => text(pattern) ?? []) ?? fail(SCRIPT, ".oxlintrc.json has no ignorePatterns list")
  );
};

const readCounts = (source: string, where: string): Counts =>
  counts(parseJson(source)) ?? fail(SCRIPT, `${where} is not a JSON object of counts`);

const git = (gitArgs: ReadonlyArray<string>) => spawnSync("git", gitArgs, { encoding: "utf8" });

const baselineAtBase = (): Counts => {
  if (git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).status !== 0)
    fail(SCRIPT, `base ref ${base} is missing (a shallow checkout?). Fetch it, or pass --base=<ref>.`);
  const shown = git(["show", `${base}:${BASELINE}`]);
  return shown.status === 0 ? readCounts(shown.stdout, `${BASELINE} at ${base}`) : {};
};

const above = (current: Counts, limit: Counts) =>
  Object.entries(current).filter(([key, count]) => count > (limit[key] ?? 0));

if (writing && files.length > 0) fail(SCRIPT, "--write needs a whole-repo run, with no files");

const ignored = ignorePatterns();
const targets = files.filter((file) => !ignored.some((pattern) => matchesGlob(file, pattern)));
if (files.length > 0 && targets.length === 0) process.exit(0);

const diagnostics = unwrap(SCRIPT, oxlint(["--disable-nested-config", ...targets]));
const current = tally(diagnostics);

if (writing) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  process.exit(0);
}

if (!existsSync(BASELINE)) fail(SCRIPT, `${BASELINE} is missing. Restore it from git; it is never deleted.`);
const baseline = readCounts(readFileSync(BASELINE, "utf8"), BASELINE);

const raised = above(baseline, baselineAtBase());
for (const [key, count] of raised)
  console.error(`${BASELINE} raises ${key} to ${count} over ${base}. Fix the code instead.`);

const grown = above(current, baseline);
const grownKeys = new Set(grown.map(([key]) => key));
for (const diagnostic of diagnostics.filter((d) => grownKeys.has(keyOf(d)))) console.error(describe(diagnostic));
for (const [key, count] of grown) console.error(`${key}: ${count}, baseline ${baseline[key] ?? 0}`);

process.exitCode = raised.length + grown.length > 0 ? 1 : 0;
