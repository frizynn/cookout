import { field, list, parseJson, text } from "./json.ts";
import type { Outcome } from "./tools.ts";

interface Published {
  readonly steps: readonly string[];
  readonly version: string;
}

interface OptOuts extends Published {
  readonly optOuts: unknown;
}

interface Field {
  readonly body: string;
  readonly name: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NO_REFUSALS = 0;

function textOf(optOut: unknown, key: string): string {
  return text(field(optOut, key)) ?? "";
}

function shapeRefusal(optOut: unknown, steps: readonly string[]): string | null {
  if (!steps.includes(textOf(optOut, "step"))) {
    return `names no step of the check (one of ${steps.join(", ")})`;
  }
  if (!DATE.test(textOf(optOut, "date"))) {
    return "needs a date (YYYY-MM-DD) for when it was reviewed";
  }
  if (textOf(optOut, "reason").trim() === "") {
    return "needs a reason: why this change breaks the published client on purpose";
  }
  return null;
}

function refusal(optOut: unknown, { steps, version }: Published): string | null {
  const refused = shapeRefusal(optOut, steps);
  if (refused !== null) {
    return refused;
  }
  const optedOutVersion = text(field(optOut, "version"));
  if (optedOutVersion !== version) {
    return `is for ${String(optedOutVersion)}, but ${version} is published now: remove it`;
  }
  return null;
}

function refusalLine(optOut: unknown, published: Published): readonly string[] {
  const why = refusal(optOut, published);
  if (why === null) {
    return [];
  }
  return [`the opt-out ${JSON.stringify(optOut)} ${why}.`];
}

function optedOutSteps({ optOuts, ...published }: OptOuts): Outcome<ReadonlySet<string>> {
  const entries = list(optOuts) ?? null;
  if (entries === null) {
    return { ok: false, reason: "the opt-outs are not a JSON list." };
  }
  const refusals = entries.flatMap((optOut) => refusalLine(optOut, published));
  if (refusals.length > NO_REFUSALS) {
    return { ok: false, reason: refusals.join("\n") };
  }
  return { ok: true, value: new Set(entries.map((optOut) => textOf(optOut, "step"))) };
}

function withoutField({ body, name }: Field): string {
  const parsed = parseJson(body);
  if (typeof parsed !== "object" || parsed === null) {
    return body;
  }
  const kept = Object.entries(parsed).filter(([key]: readonly [string, unknown]) => key !== name);
  return JSON.stringify(Object.fromEntries(kept));
}

export { optedOutSteps, withoutField };
