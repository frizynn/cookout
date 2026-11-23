import { Array as Arr, Effect, String as Str, pipe } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  identityFixture as identity,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Layer } from "effect";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ANN = { author: { name: "ann" }, mentions: ["bob"] } as const;
const PEOPLE = [
  ["ann", "a"],
  ["bob", "b"],
] as const;

function storeWithPeople<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Storage["Service"], Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* createPeople() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    yield* pipe(
      PEOPLE,
      Effect.forEach(
        ([name, letter]) => storage.createIdentity(identity(name), tokenHash(Str.repeat(HASH_LENGTH)(letter))),
        ONE_AT_A_TIME,
      ),
    );
    return storage;
  });
}

function idsIn(items: readonly { readonly message: Message }[]): readonly MessageId[] {
  return Arr.map(items, (item) => item.message.id);
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): the inbox after a message ID holds only the items posted after it",
  ({ layer }) =>
    Effect.gen(function* inboxAfter() {
      const storage = yield* storeWithPeople(layer);
      const append = appendTo(storage);
      const first = yield* append(newMessage("grill", "@bob one", ANN));
      const second = yield* append(newMessage("grill", "@bob two", ANN));
      const third = yield* append(newMessage("grill", "@bob three", ANN));
      const after = yield* storage.listInboxAfter(nameOf("bob"), first.id);
      const afterAll = yield* storage.listInboxAfter(nameOf("bob"), third.id);

      expect(idsIn(after)).toStrictEqual([second.id, third.id]);
      expect(afterAll).toStrictEqual([]);
    }),
);
