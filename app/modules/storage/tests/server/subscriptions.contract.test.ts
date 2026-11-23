import { Effect, String as Str } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  channelFixture as channel,
  channelName,
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const ONE_AT_A_TIME = { concurrency: 1, discard: true } as const;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));

function setUp(storage: Storage["Service"]): Effect.Effect<void, StorageUnavailable> {
  return Effect.all(
    [
      storage.createIdentity(identity("ann"), hashA),
      storage.createIdentity(identity("bob"), hashB),
      storage.createChannel(channel("ops", { description: "Ops talk" })),
      storage.createChannel(channel("grill")),
      storage.createChannel(channel("lounge")),
    ],
    ONE_AT_A_TIME,
  );
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity's subscribed channels are its own, sorted by name",
  ({ layer }) =>
    Effect.gen(function* ownSubscriptions() {
      const { storage } = yield* openStore(layer);
      yield* setUp(storage);
      yield* storage.subscribeChannel(nameOf("ann"), channelName("ops"));
      yield* storage.subscribeChannel(nameOf("ann"), channelName("grill"));
      yield* storage.subscribeChannel(nameOf("bob"), channelName("lounge"));

      const ann = yield* storage.listSubscribedChannels(nameOf("ann"));
      const bob = yield* storage.listSubscribedChannels(nameOf("bob"));

      expect([ann, bob]).toStrictEqual([
        [channel("grill"), channel("ops", { description: "Ops talk" })],
        [channel("lounge")],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): subscribed channels change with subscribe and unsubscribe",
  ({ layer }) =>
    Effect.gen(function* changing() {
      const { storage } = yield* openStore(layer);
      yield* setUp(storage);
      const before = yield* storage.listSubscribedChannels(nameOf("ann"));
      yield* storage.subscribeChannel(nameOf("ann"), channelName("lounge"));
      yield* storage.subscribeChannel(nameOf("ann"), channelName("lounge"));
      const subscribed = yield* storage.listSubscribedChannels(nameOf("ann"));
      yield* storage.unsubscribeChannel(nameOf("ann"), channelName("lounge"));
      const after = yield* storage.listSubscribedChannels(nameOf("ann"));

      expect([before, subscribed, after]).toStrictEqual([[], [channel("lounge")], []]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a deleted channel is no longer subscribed", ({ layer }) =>
  Effect.gen(function* deletedChannel() {
    const { storage } = yield* openStore(layer);
    yield* setUp(storage);
    yield* storage.subscribeChannel(nameOf("ann"), channelName("ops"));
    yield* storage.subscribeChannel(nameOf("ann"), channelName("lounge"));
    yield* storage.deleteChannel(channelName("ops"));
    yield* storage.createChannel(channel("ops"));

    const subscribed = yield* storage.listSubscribedChannels(nameOf("ann"));

    expect(subscribed).toStrictEqual([channel("lounge")]);
  }),
);
