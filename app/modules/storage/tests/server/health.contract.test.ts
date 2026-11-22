import { Effect, Exit } from "effect";
import { expect, it } from "@effect/vitest";
import { openStore, storageLayers } from "../../../testing/server.ts";

it.effect.each(storageLayers)("storage contract ($adapter): an open store is healthy", ({ layer }) =>
  Effect.gen(function* openStoreIsHealthy() {
    const { storage } = yield* openStore(layer);
    const health = yield* Effect.exit(storage.checkHealth());

    expect(Exit.isSuccess(health)).toBe(true);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a closed store is not healthy", ({ layer }) =>
  Effect.gen(function* closedStoreIsUnhealthy() {
    const { close, storage } = yield* openStore(layer);
    yield* close;
    const error = yield* Effect.flip(storage.checkHealth());

    expect(error).toMatchObject({ _tag: "StorageUnavailable" });
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): closing twice is fine", ({ layer }) =>
  Effect.gen(function* closeTwice() {
    const { close } = yield* openStore(layer);
    yield* close;
    const second = yield* Effect.exit(close);

    expect(Exit.isSuccess(second)).toBe(true);
  }),
);
