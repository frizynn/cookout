import type { ErrorCode } from "../../http/index.ts";

export type CookoutErrorCode = ErrorCode | "bad_response";

export class CookoutError extends Error {
  override readonly name = "CookoutError";
  readonly status: number;
  readonly code: CookoutErrorCode;
  readonly details: unknown;

  constructor(options: { status: number; code: CookoutErrorCode; message: string; details?: unknown }) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}
