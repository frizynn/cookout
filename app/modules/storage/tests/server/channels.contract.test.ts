import { Array as Arr, Effect, pipe } from "effect";
import { channelFixture as channel, channelName as nameOf, openStore, storageLayers } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const AT_ONCE = 10;
const unavailable = { _tag: "StorageUnavailable" };

it.effect.each(storageLayers)("storage contract ($adapter): a new store has no channels", ({ layer }) =>
  Effect.gen(function* newStore() {
    const { storage } = yield* openStore(layer);
    const channels = yield* storage.listChannels();

    expect(channels).toStrictEqual([]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a channel is created with or without a description and listed by name",
  ({ layer }) =>
    Effect.gen(function* createAndList() {
      const { storage } = yield* openStore(layer);
      const withDescription = yield* storage.createChannel(channel("zed", { description: "Last" }));
      const withoutDescription = yield* storage.createChannel(channel("alpha"));
      const channels = yield* storage.listChannels();

      expect([withDescription, withoutDescription]).toStrictEqual(["created", "created"]);
      expect(channels).toStrictEqual([channel("alpha"), channel("zed", { description: "Last" })]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a channel name can be used only once", ({ layer }) =>
  Effect.gen(function* nameOnce() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill", { description: "first" }));
    const second = yield* storage.createChannel(channel("grill"));
    const channels = yield* storage.listChannels();

    expect(second).toBe("name_taken");
    expect(channels).toStrictEqual([channel("grill", { description: "first" })]);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a channel is found by name", ({ layer }) =>
  Effect.gen(function* findByName() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill", { description: "d" }));
    const found = yield* storage.findChannel(nameOf("grill"));
    const missing = yield* storage.findChannel(nameOf("nowhere"));

    expect(found).toStrictEqual(channel("grill", { description: "d" }));
    expect(missing).toBeUndefined();
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): only one channel is created when one name is asked for many times at once",
  ({ layer }) =>
    Effect.gen(function* createAtOnce() {
      const { storage } = yield* openStore(layer);
      const results = yield* pipe(
        Arr.makeBy(AT_ONCE, () => channel("grill")),
        Effect.forEach((wanted) => storage.createChannel(wanted), { concurrency: "unbounded" }),
      );
      const channels = yield* storage.listChannels();

      expect(Arr.filter(results, (result) => result === "created")).toStrictEqual(["created"]);
      expect(channels).toStrictEqual([channel("grill")]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): channels cannot be used in a closed store", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* close;
    const listed = yield* Effect.flip(storage.listChannels());
    const created = yield* Effect.flip(storage.createChannel(channel("late")));
    const found = yield* Effect.flip(storage.findChannel(nameOf("late")));

    expect([listed, created, found]).toMatchObject([unavailable, unavailable, unavailable]);
  }),
);
