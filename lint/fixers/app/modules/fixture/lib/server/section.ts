import type { Effect } from "effect";

export type Section = {
  readonly check: () => Effect.Effect<void>;
};
