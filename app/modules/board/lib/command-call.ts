import { CookoutError } from "../../sdk/index.ts";
import type { JsonValue } from "../../sdk/index.ts";
import { failure } from "./failure.ts";

interface SchemaProblem {
  readonly message: string;
  readonly path: readonly (string | number)[];
}

interface CallFailure {
  readonly status: "failed";
  readonly command: string;
  readonly code: string;
  readonly message: string;
  readonly problems: readonly SchemaProblem[];
}

type CallState =
  | { readonly status: "idle" }
  | { readonly status: "calling"; readonly command: string }
  | { readonly status: "called"; readonly command: string }
  | CallFailure;

type ParsedData = { readonly status: "json"; readonly data: JsonValue } | { readonly status: "not-json" };

interface Refused {
  readonly command: string;
  readonly error: unknown;
}

const NOT_JSON: ParsedData = { status: "not-json" };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primitiveOf(value: unknown): string | number | boolean | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return null;
}

function toJson(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => toJson(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]: readonly [string, unknown]) => [key, toJson(item)]),
    );
  }
  return primitiveOf(value);
}

function parseData(text: string): ParsedData {
  try {
    const json: unknown = JSON.parse(text);
    return { data: toJson(json), status: "json" };
  } catch {
    return NOT_JSON;
  }
}

function notJson(command: string): CallFailure {
  return { code: "invalid_json", command, message: "The data isn't JSON.", problems: [], status: "failed" };
}

function isPathPart(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function isSchemaProblem(value: unknown): value is SchemaProblem {
  return (
    isRecord(value) &&
    typeof value["message"] === "string" &&
    Array.isArray(value["path"]) &&
    value["path"].every((part: unknown) => isPathPart(part))
  );
}

function problemsIn(error: unknown): readonly SchemaProblem[] {
  if (error instanceof CookoutError && Array.isArray(error.details)) {
    return error.details.filter((detail: unknown) => isSchemaProblem(detail));
  }
  return [];
}

function callFailure(refused: Refused): CallFailure {
  const { code, message } = failure(refused.error);
  return { code, command: refused.command, message, problems: problemsIn(refused.error), status: "failed" };
}

export { type CallState, type SchemaProblem, callFailure, notJson, parseData };
