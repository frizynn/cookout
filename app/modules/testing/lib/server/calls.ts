import { Cause, Effect } from "effect";
import { CookoutError } from "../../../sdk/index.ts";

function isCookoutError(error: unknown): error is CookoutError {
  return error instanceof CookoutError;
}

function answer<Answer>(call: () => Promise<Answer>): Effect.Effect<Answer> {
  return Effect.promise(call);
}

function refusal(call: () => Promise<unknown>): Effect.Effect<CookoutError> {
  return Effect.promise(call).pipe(
    Effect.sandbox,
    Effect.flip,
    Effect.map(Cause.squash),
    Effect.filterOrFail(isCookoutError),
    Effect.orDie,
  );
}

export { answer, refusal };
