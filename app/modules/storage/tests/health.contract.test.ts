import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { openStore, storageLayers } from "../../testing/server.ts";

for (const [name, layer] of Object.entries(storageLayers)) {
  describe(`storage contract (${name})`, () => {
    describe("health", () => {
      it.effect("an open store is healthy", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.checkHealth();
        }),
      );

      it.effect("a closed store is not healthy", () =>
        Effect.gen(function* () {
          const { storage, close } = yield* openStore(layer);
          yield* close;
          const error = yield* Effect.flip(storage.checkHealth());
          expect(error._tag).toBe("StorageUnavailable");
        }),
      );

      it.effect("closing twice is fine", () =>
        Effect.gen(function* () {
          const { close } = yield* openStore(layer);
          yield* close;
          yield* close;
        }),
      );
    });
  });
}
