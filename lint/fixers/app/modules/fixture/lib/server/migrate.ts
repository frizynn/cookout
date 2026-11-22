import { Effect } from "effect";

export const migrate = (steps: number) =>
  Effect.gen(function* () {
    yield* Effect.log(steps);
  });
