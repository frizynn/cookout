import type { Refusal } from "../../sdk/index.ts";
import { refusalOf } from "../../sdk/index.ts";

type Failure = Refusal & { readonly status: "failed" };

type PostState = { readonly status: "idle" } | { readonly status: "posting" } | Failure;

function failure(error: unknown): Failure {
  return { ...refusalOf(error), status: "failed" };
}

export { type Failure, type PostState, failure };
