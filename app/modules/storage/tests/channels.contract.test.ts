import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { channelFixture as channel, channelName as nameOf, openStore, storageLayers } from "../../testing/server.ts";

for (const [adapter, layer] of Object.entries(storageLayers)) {
  it.effect(`storage contract (${adapter}): a new store has no channels`, () =>
    Effect.gen(function* () {
      const { storage } = yield* openStore(layer);
      expect(yield* storage.listChannels()).toEqual([]);
    }),
  );

  it.effect(
    `storage contract (${adapter}): a channel is created with or without a description and listed by name`,
    () =>
      Effect.gen(function* () {
        const { storage } = yield* openStore(layer);
        expect(yield* storage.createChannel(channel("zed", { description: "Last" }))).toBe("created");
        expect(yield* storage.createChannel(channel("alpha"))).toBe("created");
        expect(yield* storage.listChannels()).toEqual([channel("alpha"), channel("zed", { description: "Last" })]);
      }),
  );

  it.effect(`storage contract (${adapter}): a channel name can be used only once`, () =>
    Effect.gen(function* () {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill", { description: "first" }));
      expect(yield* storage.createChannel(channel("grill"))).toBe("name_taken");
      expect(yield* storage.listChannels()).toEqual([channel("grill", { description: "first" })]);
    }),
  );

  it.effect(`storage contract (${adapter}): a channel is found by name`, () =>
    Effect.gen(function* () {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill", { description: "d" }));
      expect(yield* storage.findChannel(nameOf("grill"))).toEqual(channel("grill", { description: "d" }));
      expect(yield* storage.findChannel(nameOf("nowhere"))).toBeUndefined();
    }),
  );

  it.effect(
    `storage contract (${adapter}): only one channel is created when one name is asked for many times at once`,
    () =>
      Effect.gen(function* () {
        const { storage } = yield* openStore(layer);
        const results = yield* Effect.all(
          Array.from({ length: 10 }, () => storage.createChannel(channel("grill"))),
          { concurrency: "unbounded" },
        );
        expect(results.filter((result) => result === "created")).toHaveLength(1);
        expect(yield* storage.listChannels()).toEqual([channel("grill")]);
      }),
  );

  it.effect(`storage contract (${adapter}): channels cannot be used in a closed store`, () =>
    Effect.gen(function* () {
      const { storage, close } = yield* openStore(layer);
      yield* close;
      for (const attempt of [
        Effect.asVoid(storage.listChannels()),
        Effect.asVoid(storage.createChannel(channel("late"))),
        Effect.asVoid(storage.findChannel(nameOf("late"))),
      ]) {
        expect((yield* Effect.flip(attempt))._tag).toBe("StorageUnavailable");
      }
    }),
  );
}
