import { field, list, parseJson, text } from "./json.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Outcome } from "./tools.ts";
import { resolve } from "node:path";
import { tool } from "./tools.ts";

const CACHE = "node_modules/.cache/lint-ratchet";

const isOn = (setting: unknown) => {
  const severity = text(setting) ?? text(list(setting)?.[0]);
  return severity !== undefined && severity !== "off" && severity !== "allow";
};

const codeOf = (rule: string) => {
  const slash = rule.indexOf("/");
  return slash === -1 ? `eslint(${rule})` : `${rule.slice(0, slash)}(${rule.slice(slash + 1)})`;
};

const onIn = (rules: unknown): readonly string[] =>
  typeof rules === "object" && rules !== null
    ? Object.entries(rules).flatMap(([rule, setting]) => (isOn(setting) ? [codeOf(rule)] : []))
    : [];

const absolutePlugin = (plugin: unknown) => {
  const path = text(plugin);
  return path?.startsWith(".") ? resolve(path) : plugin;
};

const withAbsolutePlugins = (config: unknown) => {
  const plugins = list(field(config, "jsPlugins"));
  return plugins && typeof config === "object" ? { ...config, jsPlugins: plugins.map(absolutePlugin) } : config;
};

export const rulesOn = (source: string): Outcome<ReadonlySet<string>> => {
  const config = parseJson(source);
  if (config === undefined) {
    return { ok: false, reason: "the base .oxlintrc.json is not JSON" };
  }
  mkdirSync(CACHE, { recursive: true });
  const path = `${CACHE}/base.oxlintrc.json`;
  writeFileSync(path, JSON.stringify(withAbsolutePlugins(config)));
  const run = tool("effect-tsgo", ["oxlint", "--print-config", "-c", path]);
  if (!run.ok) {
    return run;
  }
  const printed = parseJson(run.value.stdout);
  if (printed === undefined) {
    return { ok: false, reason: `oxlint could not print the base config: ${run.value.stdout}${run.value.stderr}` };
  }
  const overrides = list(field(printed, "overrides")) ?? [];
  const codes = [field(printed, "rules"), ...overrides.map((override) => field(override, "rules"))].flatMap(onIn);
  return { ok: true, value: new Set(codes) };
};
