import { Effect, String as Str, pipe } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  fixtureTime,
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
const BOB = { author: { name: "bob" } } as const;
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
    yield* storage.createChannel(channel("bar"));
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

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity that has acked nothing has no read positions",
  ({ layer }) =>
    Effect.gen(function* noPositions() {
      const storage = yield* storeWithPeople(layer);
      yield* appendTo(storage)(newMessage("grill", "hello", BOB));

      const positions = yield* storage.listReadPositions(nameOf("ann"));

      expect(positions).toStrictEqual([]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): read positions list every scope, by channel then channel before its threads",
  ({ layer }) =>
    Effect.gen(function* everyScope() {
      const storage = yield* storeWithPeople(layer);
      const append = appendTo(storage);
      const parent = yield* append(newMessage("grill", "parent", BOB));
      const reply = yield* append(newMessage("grill", "reply", { ...BOB, replyTo: parent.id }));
      const later = yield* append(newMessage("grill", "later", BOB));
      const elsewhere = yield* append(newMessage("bar", "elsewhere", BOB));
      yield* Effect.forEach(
        [reply.id, later.id, elsewhere.id, parent.id],
        (id) => storage.ackMessage(nameOf("ann"), id, fixtureTime),
        ONE_AT_A_TIME,
      );
      const positions = yield* storage.listReadPositions(nameOf("ann"));

      expect(positions).toStrictEqual([
        { channel: channelName("bar"), messageId: elsewhere.id, thread: null },
        { channel: channelName("grill"), messageId: later.id, thread: null },
        { channel: channelName("grill"), messageId: reply.id, thread: parent.id },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): posting moves the author's read position, which only the author sees",
  ({ layer }) =>
    Effect.gen(function* authorsOwn() {
      const storage = yield* storeWithPeople(layer);
      const posted = yield* appendTo(storage)(newMessage("grill", "hello", BOB));
      const positions = yield* Effect.all(
        [storage.listReadPositions(nameOf("bob")), storage.listReadPositions(nameOf("ann"))],
        ONE_AT_A_TIME,
      );

      expect(positions).toStrictEqual([[{ channel: channelName("grill"), messageId: posted.id, thread: null }], []]);
    }),
);
