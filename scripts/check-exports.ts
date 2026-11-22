import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import buildConfigs from "../tsdown.config.ts";
import { field, list, parseJson, text } from "./lib/json.ts";

type BuildEntry = { readonly name: string; readonly source: string; readonly declarations: boolean };

const SCRIPT = "exports";
const PUBLISHED_RULE = "published-entries-ship-no-test-code";
const DIST_ONLY = ["dist"];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): Readonly<Record<string, unknown>> => (isRecord(value) ? value : {});

const relative = (path: string) => path.replace(/^\.\//u, "");

const buildEntries: ReadonlyArray<BuildEntry> = buildConfigs.flatMap((config) =>
  Object.entries(recordOf(config.entry)).flatMap(([name, source]) =>
    typeof source === "string" ? [{ name, source: relative(source), declarations: config.dts === true }] : [],
  ),
);

const manifest = parseJson(readFileSync("package.json", "utf8"));
const exportsMap = recordOf(field(manifest, "exports"));
const publishedExports = recordOf(field(field(manifest, "publishConfig"), "exports"));
const bins = recordOf(field(manifest, "bin"));
const files = list(field(manifest, "files")) ?? [];

const knipEntries = new Set(
  (list(field(parseJson(readFileSync("knip.json", "utf8")), "entry")) ?? []).map((entry) => text(entry) ?? ""),
);

const depcruiseConfig: unknown = createRequire(import.meta.url)("../.dependency-cruiser.cjs");
const publishedRule = (list(field(depcruiseConfig, "forbidden")) ?? []).find(
  (rule) => field(rule, "name") === PUBLISHED_RULE,
);
const unescape = (pattern: string) => pattern.replace(/^\^/u, "").replace(/\$$/u, "").replaceAll("\\.", ".");
const depcruiseEntries = new Set(
  (list(field(field(publishedRule, "from"), "path")) ?? []).map((pattern) => unescape(text(pattern) ?? "")),
);

const entryFor = (source: string) => buildEntries.find((entry) => entry.source === source);
const builtJs = (entry: BuildEntry) => `./dist/${entry.name}.js`;
const builtTypes = (entry: BuildEntry) => `./dist/${entry.name}.d.ts`;

const publishedFailures = (subpath: string, entry: BuildEntry): ReadonlyArray<string> => {
  const expected = { types: builtTypes(entry), default: builtJs(entry) };
  const published = JSON.stringify(field(publishedExports, subpath));
  return published === JSON.stringify(expected)
    ? []
    : [`publishConfig.exports["${subpath}"] must be ${JSON.stringify(expected)}, the build of ${entry.source}.`];
};

const declarationFailures = (entry: BuildEntry): ReadonlyArray<string> =>
  entry.declarations ? [] : [`tsdown.config.ts builds ${entry.source} without declarations, but it is exported.`];

const exportFailures = (subpath: string, target: unknown): ReadonlyArray<string> => {
  const source = relative(text(target) ?? "");
  const entry = entryFor(source);
  if (entry === undefined)
    return [`exports["${subpath}"] is ${String(target)}, which no build entry in tsdown.config.ts builds.`];
  return [...publishedFailures(subpath, entry), ...declarationFailures(entry)];
};

const binFailures = (name: string, target: unknown): ReadonlyArray<string> =>
  buildEntries.some((entry) => builtJs(entry) === target)
    ? []
    : [`bin.${name} is ${String(target)}, which no build entry in tsdown.config.ts writes.`];

const isShipped = (entry: BuildEntry) =>
  Object.values(bins).includes(builtJs(entry)) ||
  Object.values(exportsMap).some((target) => relative(text(target) ?? "") === entry.source);

const entryFailures = (entry: BuildEntry): ReadonlyArray<string> => [
  ...(isShipped(entry) ? [] : [`tsdown.config.ts builds ${entry.source}, but no bin or export ships it.`]),
  ...(knipEntries.has(`${entry.source}!`) ? [] : [`knip.json has no production entry "${entry.source}!".`]),
  ...(depcruiseEntries.has(entry.source)
    ? []
    : [`.dependency-cruiser.cjs rule ${PUBLISHED_RULE} doesn't start from ${entry.source}.`]),
];

const extraDepcruiseEntries = [...depcruiseEntries]
  .filter((source) => entryFor(source) === undefined)
  .map((source) => `.dependency-cruiser.cjs rule ${PUBLISHED_RULE} starts from ${source}, which nothing builds.`);

const subpathFailures = [
  ...Object.keys(publishedExports)
    .filter((subpath) => !(subpath in exportsMap))
    .map((subpath) => `publishConfig.exports["${subpath}"] has no exports["${subpath}"] for workspace consumers.`),
  ...("." in exportsMap ? ['exports["."] must not exist: the package ships the bin and ./sdk only.'] : []),
];

const filesFailures =
  JSON.stringify(files) === JSON.stringify(DIST_ONLY) ? [] : [`files must be ${JSON.stringify(DIST_ONLY)}.`];

const failures = [
  ...Object.entries(exportsMap).flatMap(([subpath, target]) => exportFailures(subpath, target)),
  ...Object.entries(bins).flatMap(([name, target]) => binFailures(name, target)),
  ...buildEntries.flatMap(entryFailures),
  ...extraDepcruiseEntries,
  ...subpathFailures,
  ...filesFailures,
  ...(publishedRule === undefined ? [`.dependency-cruiser.cjs has no rule ${PUBLISHED_RULE}.`] : []),
];
for (const failure of failures) console.error(`${SCRIPT}: ${failure}`);
process.exitCode = failures.length > 0 ? 1 : 0;
