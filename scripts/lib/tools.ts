import { spawnSync } from "node:child_process";
import { field, list, parseJson, text } from "./json.ts";

export type Run = { readonly status: number | null; readonly stdout: string; readonly stderr: string };
export type Diagnostic = {
  readonly code: string;
  readonly filename: string;
  readonly message: string;
  readonly line: number;
};
export type Outcome<A> = { readonly ok: true; readonly value: A } | { readonly ok: false; readonly reason: string };

export const fail = (script: string, reason: string): never => {
  console.error(`${script}: ${reason}`);
  process.exit(1);
};

export const unwrap = <A>(script: string, outcome: Outcome<A>): A =>
  outcome.ok ? outcome.value : fail(script, outcome.reason);

export const tool = (name: string, args: ReadonlyArray<string>): Outcome<Run> => {
  const run = spawnSync(`node_modules/.bin/${name}`, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (run.error) return { ok: false, reason: `${name} could not run (${run.error.message}). Run pnpm install.` };
  return { ok: true, value: { status: run.status, stdout: run.stdout, stderr: run.stderr } };
};

const line = (diagnostic: unknown) => {
  const value = field(field(list(field(diagnostic, "labels"))?.[0], "span"), "line");
  return typeof value === "number" ? value : 0;
};

const toDiagnostic = (diagnostic: unknown): ReadonlyArray<Diagnostic> => {
  const code = text(field(diagnostic, "code"));
  const filename = text(field(diagnostic, "filename"));
  const message = text(field(diagnostic, "message")) ?? "";
  return code && filename ? [{ code, filename, message, line: line(diagnostic) }] : [];
};

export const oxlint = (args: ReadonlyArray<string>): Outcome<ReadonlyArray<Diagnostic>> => {
  const run = tool("oxlint", ["--type-aware", "-f", "json", ...args]);
  if (!run.ok) return run;
  const diagnostics = list(field(parseJson(run.value.stdout), "diagnostics"));
  if (!diagnostics) {
    const output = `${run.value.stdout}${run.value.stderr}`.trim();
    return { ok: false, reason: `oxlint produced no JSON report (exit ${run.value.status}): ${output}` };
  }
  const parsed = diagnostics.flatMap(toDiagnostic);
  if (parsed.length !== diagnostics.length) return { ok: false, reason: "oxlint's JSON report has an unknown shape" };
  return { ok: true, value: parsed };
};

export const describe = (diagnostic: Diagnostic) =>
  `${diagnostic.filename}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`;
