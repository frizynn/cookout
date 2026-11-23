import type { ErrorCode, SchemaProblem } from "../../http/index.ts";
import { isSchemaProblems } from "./generated/validators.js";

declare const brand: unique symbol;

type UnknownErrorCode = string & { readonly [brand]: "UnknownErrorCode" };

type CookoutErrorCode = ErrorCode | "bad_response" | "url_missing" | UnknownErrorCode;

interface CookoutErrorOptions {
  readonly code: CookoutErrorCode;
  readonly details?: unknown;
  readonly message: string;
  readonly status: number;
}

function isServerErrorCode(code: string): code is ErrorCode | UnknownErrorCode {
  return code !== "";
}

const NO_PROBLEMS: readonly SchemaProblem[] = [];

function schemaProblemsIn({ code, details }: CookoutErrorOptions): readonly SchemaProblem[] {
  if (code === "invalid_request" && isSchemaProblems(details)) {
    return details;
  }
  return NO_PROBLEMS;
}

class CookoutError extends Error {
  public override readonly name = "CookoutError";
  public readonly status: number;
  public readonly code: CookoutErrorCode;
  public readonly details: unknown;
  public readonly schemaProblems: readonly SchemaProblem[];

  public constructor(options: CookoutErrorOptions) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.schemaProblems = schemaProblemsIn(options);
  }
}

interface Refusal {
  readonly code: CookoutErrorCode | "unreachable";
  readonly message: string;
}

function refusalOf(error: unknown): Refusal {
  if (error instanceof CookoutError) {
    return { code: error.code, message: error.message };
  }
  return { code: "unreachable", message: String(error) };
}

export { CookoutError, type CookoutErrorCode, type Refusal, type UnknownErrorCode, isServerErrorCode, refusalOf };
