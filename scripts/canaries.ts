import { readdirSync } from "node:fs";
import { field, list, parseJson, text } from "./lib/json.ts";
import { fail, oxlint, tool, unwrap } from "./lib/tools.ts";

type Canary = { readonly check: string; readonly code: string; readonly file: string };

const SCRIPT = "canaries";
const ROOT = "lint/canary";
const MODULE = `${ROOT}/app/modules/canary`;

const localRuleFile = (rule: string) => {
  if (rule === "effect-errors") return `${MODULE}/lib/server/${rule}.ts`;
  if (rule === "no-pass-through") return `${MODULE}/index.ts`;
  return `${MODULE}/lib/${rule}.ts`;
};

const localRules = readdirSync("lint/rules")
  .filter((file) => file.endsWith(".js"))
  .map((file) => file.slice(0, -".js".length));

const nativeRules: ReadonlyArray<readonly [string, string]> = [
  ["typescript(no-explicit-any)", "no-explicit-any"],
  ["typescript(no-non-null-assertion)", "no-non-null-assertion"],
  ["typescript(no-unsafe-argument)", "no-unsafe-argument"],
  ["typescript(no-unsafe-assignment)", "no-unsafe-assignment"],
  ["typescript(no-unsafe-call)", "no-unsafe-call"],
  ["typescript(no-unsafe-member-access)", "no-unsafe-member-access"],
  ["typescript(no-unsafe-return)", "no-unsafe-return"],
  ["typescript(switch-exhaustiveness-check)", "switch-exhaustiveness-check"],
  ["eslint(complexity)", "complexity"],
  ["typescript(ban-ts-comment)", "ban-ts-comment"],
  ["eslint(no-restricted-globals)", "no-restricted-globals"],
  ["eslint(no-restricted-properties)", "no-restricted-properties"],
  ["eslint(no-restricted-imports)", "no-restricted-imports.effect"],
  ["eslint(no-restricted-imports)", "no-restricted-imports.sqlite"],
];

const lintCanaries: ReadonlyArray<Canary> = [
  ...localRules.map((rule) => ({ check: "oxlint", code: `local(${rule})`, file: localRuleFile(rule) })),
  ...nativeRules.map(([code, name]) => ({ check: "oxlint", code, file: `${MODULE}/lib/${name}.ts` })),
];

const tscCanaries: ReadonlyArray<Canary> = [
  { check: "tsc", code: "TS2322", file: `${ROOT}/tsc/assignability.ts` },
  { check: "tsc", code: "TS2322", file: `${ROOT}/tsc/unchecked-index.ts` },
];

const seamCanaries: ReadonlyArray<Canary> = [
  { check: "dependency-cruiser", code: "entry-points-only-from-app", file: `${ROOT}/seams/deep-import.ts` },
  { check: "dependency-cruiser", code: "sqlite-only-in-storage-adapter", file: `${ROOT}/seams/sqlite.ts` },
];

const key = (code: string, file: string) => `${code} ${file}`;

const lintCaught = (): ReadonlySet<string> => {
  const diagnostics = unwrap(SCRIPT, oxlint(["-c", `${ROOT}/.oxlintrc.json`, `${ROOT}/app`]));
  return new Set(diagnostics.map((diagnostic) => key(diagnostic.code, diagnostic.filename)));
};

const tscCaught = (): ReadonlySet<string> => {
  const run = unwrap(SCRIPT, tool("tsc", ["-p", `${ROOT}/tsc/tsconfig.json`, "--noEmit", "--pretty", "false"]));
  const errors = [...run.stdout.matchAll(/^(\S+)\(\d+,\d+\): error (TS\d+):/gm)];
  return new Set(errors.map(([, file = "", code = ""]) => key(code, file)));
};

const violation = (entry: unknown) => {
  const rule = text(field(field(entry, "rule"), "name"));
  const from = text(field(entry, "from"));
  return rule && from ? [key(rule, from)] : [];
};

const seamsCaught = (): ReadonlySet<string> => {
  const run = unwrap(SCRIPT, tool("depcruise", [`${ROOT}/seams`, "--output-type", "json"]));
  const violations = list(field(field(parseJson(run.stdout), "summary"), "violations"));
  if (!violations) fail(SCRIPT, `dependency-cruiser produced no JSON report: ${run.stderr.trim()}`);
  return new Set((violations ?? []).flatMap(violation));
};

const missing = (canaries: ReadonlyArray<Canary>, caught: ReadonlySet<string>) =>
  canaries.filter((canary) => !caught.has(key(canary.code, canary.file)));

const escaped = [
  ...missing(lintCanaries, lintCaught()),
  ...missing(tscCanaries, tscCaught()),
  ...missing(seamCanaries, seamsCaught()),
];
for (const canary of escaped)
  console.error(`${SCRIPT}: ${canary.check} did not report ${canary.code} for its planted violation in ${canary.file}`);
process.exitCode = escaped.length > 0 ? 1 : 0;
