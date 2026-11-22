import { Cause, Effect, Exit } from "effect";
import { CookoutError } from "../../../sdk/index.ts";

function refusalIn(exit: Exit.Exit<unknown>): Effect.Effect<CookoutError> {
  if (Exit.isSuccess(exit)) {
    return Effect.die(new Error("The call should have been refused."));
  }
  const error = Cause.squash(exit.cause);
  if (error instanceof CookoutError) {
    return Effect.succeed(error);
  }
  return Effect.die(error);
}

function answer<Answer>(call: () => Promise<Answer>): Effect.Effect<Answer> {
  return Effect.promise(call);
}

function refusal(call: () => Promise<unknown>): Effect.Effect<CookoutError> {
  return Effect.exit(Effect.promise(call)).pipe(Effect.flatMap(refusalIn));
}

export { answer, refusal };
