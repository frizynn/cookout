import type { ErrorCode } from "../../http/index.ts";

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

class CookoutError extends Error {
  public override readonly name = "CookoutError";
  public readonly status: number;
  public readonly code: CookoutErrorCode;
  public readonly details: unknown;

  public constructor(options: CookoutErrorOptions) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export { CookoutError, type CookoutErrorCode, type UnknownErrorCode, isServerErrorCode };
