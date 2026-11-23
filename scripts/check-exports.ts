import { field, list, parseJson, text } from "./lib/json.ts";
import buildConfigs from "../tsdown.config.ts";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

interface BuildEntry {
  readonly declarations: boolean;
  readonly name: string;
  readonly source: string;
}

const SCRIPT = "exports";
const PUBLISHED_RULE = "published-entries-ship-no-test-code";
const SHIPPED_FILES = ["dist", "docs/agents.md", "skills"];
const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const NONE = 0;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  if (isRecord(value)) {
    return value;
  }
  return {};
}

function when(condition: boolean, message: string): readonly string[] {
  if (condition) {
    return [message];
  }
  return [];
}

function relative(path: string): string {
  return path.replace(/^\.\//u, "");
}

function textOr(value: unknown): string {
  return text(value) ?? "";
}

function entriesOfConfig(entry: unknown, declarations: boolean): readonly BuildEntry[] {
  const found: BuildEntry[] = [];
  for (const [name, source] of Object.entries(recordOf(entry))) {
    if (typeof source === "string") {
      found.push({ declarations, name, source: relative(source) });
    }
  }
  return found;
}

function allBuildEntries(): readonly BuildEntry[] {
  const found: BuildEntry[] = [];
  for (const config of buildConfigs) {
    found.push(...entriesOfConfig(config.entry, config.dts === true));
  }
  return found;
}

function unescape(pattern: string): string {
  return pattern.replace(/^\^/u, "").replace(/\$$/u, "").replaceAll(String.raw`\.`, ".");
}

const buildEntries = allBuildEntries();
const manifest = parseJson(readFileSync("package.json", "utf8"));
const exportsMap = recordOf(field(manifest, "exports"));
const publishedExports = recordOf(field(field(manifest, "publishConfig"), "exports"));
const bins = recordOf(field(manifest, "bin"));
const files = list(field(manifest, "files")) ?? [];
const knipConfig = parseJson(readFileSync("knip.json", "utf8"));
const knipRoot = field(field(knipConfig, "workspaces"), ".");
const knipEntries = new Set((list(field(knipRoot, "entry")) ?? []).map((entry) => textOr(entry)));
const depcruiseConfig: unknown = createRequire(import.meta.url)("../.dependency-cruiser.cjs");
const publishedRules = (list(field(depcruiseConfig, "forbidden")) ?? []).filter(
  (rule) => field(rule, "name") === PUBLISHED_RULE,
);
const publishedFrom = publishedRules.flatMap((rule) => list(field(field(rule, "from"), "path")) ?? []);
const depcruiseEntries = new Set(publishedFrom.map((pattern) => unescape(textOr(pattern))));

function entriesFor(source: string): readonly BuildEntry[] {
  return buildEntries.filter((entry) => entry.source === source);
}

function builtJs(entry: BuildEntry): string {
  return `./dist/${entry.name}.js`;
}

function builtTypes(entry: BuildEntry): string {
  return `./dist/${entry.name}.d.ts`;
}

function publishedFailures(subpath: string, entry: BuildEntry): readonly string[] {
  const expected = JSON.stringify(
    Object.fromEntries([
      ["types", builtTypes(entry)],
      ["default", builtJs(entry)],
    ]),
  );
  const published = JSON.stringify(field(publishedExports, subpath));
  return when(
    published !== expected,
    `publishConfig.exports["${subpath}"] must be ${expected}, the build of ${entry.source}.`,
  );
}

function declarationFailures(entry: BuildEntry): readonly string[] {
  return when(!entry.declarations, `tsdown.config.ts builds ${entry.source} without declarations, but it is exported.`);
}

function exportFailures([subpath, target]: readonly [string, unknown]): readonly string[] {
  const matches = entriesFor(relative(textOr(target)));
  const found = [
    ...when(
      matches.length === NONE,
      `exports["${subpath}"] is ${String(target)}, which no build entry in tsdown.config.ts builds.`,
    ),
  ];
  for (const entry of matches) {
    found.push(...publishedFailures(subpath, entry), ...declarationFailures(entry));
  }
  return found;
}

function binFailures([name, target]: readonly [string, unknown]): readonly string[] {
  return when(
    !buildEntries.some((entry) => builtJs(entry) === target),
    `bin.${name} is ${String(target)}, which no build entry in tsdown.config.ts writes.`,
  );
}

function isShipped(entry: BuildEntry): boolean {
  return (
    Object.values(bins).includes(builtJs(entry)) ||
    Object.values(exportsMap).some((target) => relative(textOr(target)) === entry.source)
  );
}

function entryFailures(entry: BuildEntry): readonly string[] {
  return [
    ...when(!isShipped(entry), `tsdown.config.ts builds ${entry.source}, but no bin or export ships it.`),
    ...when(!knipEntries.has(`${entry.source}!`), `knip.json has no production entry "${entry.source}!".`),
    ...when(
      !depcruiseEntries.has(entry.source),
      `.dependency-cruiser.cjs rule ${PUBLISHED_RULE} doesn't start from ${entry.source}.`,
    ),
  ];
}

const extraDepcruiseEntries = [...depcruiseEntries]
  .filter((source) => entriesFor(source).length === NONE)
  .map((source) => `.dependency-cruiser.cjs rule ${PUBLISHED_RULE} starts from ${source}, which nothing builds.`);
const subpathFailures = [
  ...Object.keys(publishedExports)
    .filter((subpath) => !(subpath in exportsMap))
    .map((subpath) => `publishConfig.exports["${subpath}"] has no exports["${subpath}"] for workspace consumers.`),
  ...when("." in exportsMap, 'exports["."] must not exist: the package ships the bin and ./sdk only.'),
];
const failures = [
  ...Object.entries(exportsMap).flatMap((entry: readonly [string, unknown]) => exportFailures(entry)),
  ...Object.entries(bins).flatMap((entry: readonly [string, unknown]) => binFailures(entry)),
  ...buildEntries.flatMap((entry) => entryFailures(entry)),
  ...extraDepcruiseEntries,
  ...subpathFailures,
  ...when(JSON.stringify(files) !== JSON.stringify(SHIPPED_FILES), `files must be ${JSON.stringify(SHIPPED_FILES)}.`),
  ...when(publishedRules.length === NONE, `.dependency-cruiser.cjs has no rule ${PUBLISHED_RULE}.`),
];

for (const failure of failures) {
  console.error(`${SCRIPT}: ${failure}`);
}
process.exitCode = EXIT_SUCCESS;
if (failures.length > NONE) {
  process.exitCode = EXIT_FAILURE;
}
