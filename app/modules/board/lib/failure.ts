import { CookoutError } from "../../sdk/index.ts";

interface Failure {
  readonly status: "failed";
  readonly code: string;
  readonly message: string;
}

function failure(error: unknown): Failure {
  if (error instanceof CookoutError) {
    return { code: error.code, message: error.message, status: "failed" };
  }
  return { code: "unreachable", message: String(error), status: "failed" };
}

export { type Failure, failure };
