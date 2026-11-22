import { Effect, Ref, type Scope } from "effect";
import { StorageUnavailable } from "./errors.ts";

export type MemoryState = {
  readonly ensureOpen: Effect.Effect<void, StorageUnavailable>;
};

export const openMemoryState: Effect.Effect<MemoryState, never, Scope.Scope> = Effect.gen(function* () {
  const closed = yield* Effect.acquireRelease(Ref.make(false), (ref) => Ref.set(ref, true));
  const ensureOpen = Ref.get(closed).pipe(
    Effect.flatMap((isClosed) =>
      isClosed ? Effect.fail(new StorageUnavailable({ message: "The in-memory store is closed." })) : Effect.void,
    ),
  );
  return { ensureOpen };
});
