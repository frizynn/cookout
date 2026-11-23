import { Array as Arr, Effect, String as Str, pipe } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  fixtureTime,
  identityFixture as identity,
  messageId,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Layer } from "effect";
import type { Message } from "../../../messages/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const MISSING = 999_999;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const BOB = { author: { name: "bob" } } as const;
const PEOPLE = [
  ["ann", "a"],
  ["bob", "b"],
] as const;

interface Posted {
  readonly storage: Storage["Service"];
  readonly first: Message;
  readonly second: Message;
  readonly reply: Message;
  readonly later: Message;
}

function postedToAnn<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Posted, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* postToAnn() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    yield* pipe(
      PEOPLE,
      Effect.forEach(
        ([name, letter]) => storage.createIdentity(identity(name), tokenHash(Str.repeat(HASH_LENGTH)(letter))),
        ONE_AT_A_TIME,
      ),
    );
    yield* storage.subscribeChannel(nameOf("ann"), channelName("grill"));
    const append = appendTo(storage);
    const first = yield* append(newMessage("grill", "first", BOB));
    const second = yield* append(newMessage("grill", "second", BOB));
    const reply = yield* append(newMessage("grill", "@ann reply", { ...BOB, mentions: ["ann"], replyTo: first.id }));
    const later = yield* append(newMessage("grill", "later", BOB));
    return { first, later, reply, second, storage };
  });
}

function unreadIds(storage: Storage["Service"]): Effect.Effect<readonly number[], StorageUnavailable> {
  return Effect.map(storage.listInbox(nameOf("ann")), (items) => Arr.map(items, (item) => item.message.id));
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): moving a read position back to before a message makes it and every later one unread",
  ({ layer }) =>
    Effect.gen(function* moveBack() {
      const { first, later, reply, second, storage } = yield* postedToAnn(layer);
      yield* storage.ackMessage(nameOf("ann"), later.id, fixtureTime);

      const moved = yield* storage.moveReadPositionBack(nameOf("ann"), second.id);
      const unread = yield* unreadIds(storage);

      expect({ moved, unread }).toStrictEqual({
        moved: { channel: "grill", messageId: first.id, thread: null },
        unread: [second.id, reply.id, later.id],
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an ack after moving a read position back moves it forward again",
  ({ layer }) =>
    Effect.gen(function* ackAfterMovingBack() {
      const { later, reply, second, storage } = yield* postedToAnn(layer);
      yield* storage.ackMessage(nameOf("ann"), later.id, fixtureTime);
      yield* storage.moveReadPositionBack(nameOf("ann"), second.id);

      const acked = yield* storage.ackMessage(nameOf("ann"), later.id, fixtureTime);
      const unread = yield* unreadIds(storage);

      expect({ acked, unread }).toStrictEqual({
        acked: { readPosition: { channel: "grill", messageId: later.id, thread: null }, receipts: [] },
        unread: [reply.id],
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): moving a thread's read position back before its first reply leaves its top-level message",
  ({ layer }) =>
    Effect.gen(function* moveThreadBack() {
      const { first, reply, storage } = yield* postedToAnn(layer);
      yield* storage.ackMessage(nameOf("ann"), reply.id, fixtureTime);

      const moved = yield* storage.moveReadPositionBack(nameOf("ann"), reply.id);
      const unread = yield* unreadIds(storage);

      expect({ moved, unread: Arr.contains(unread, reply.id) }).toStrictEqual({
        moved: { channel: "grill", messageId: first.id, thread: first.id },
        unread: true,
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): moving a channel's read position back before its first message leaves none there",
  ({ layer }) =>
    Effect.gen(function* moveToNothing() {
      const { first, storage } = yield* postedToAnn(layer);
      yield* storage.ackMessage(nameOf("ann"), first.id, fixtureTime);

      const moved = yield* storage.moveReadPositionBack(nameOf("ann"), first.id);
      const positions = yield* storage.listReadPositions(nameOf("ann"));

      expect({ moved, positions }).toStrictEqual({
        moved: { channel: "grill", messageId: null, thread: null },
        positions: [],
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): moving a read position back never marks anything read",
  ({ layer }) =>
    Effect.gen(function* neverForward() {
      const { first, later, storage } = yield* postedToAnn(layer);
      yield* storage.ackMessage(nameOf("ann"), first.id, fixtureTime);

      const behind = yield* storage.moveReadPositionBack(nameOf("ann"), later.id);
      const missing = yield* storage.moveReadPositionBack(nameOf("ann"), messageId(MISSING));

      expect(behind).toStrictEqual({ channel: "grill", messageId: first.id, thread: null });
      expect(missing).toBeUndefined();
    }),
);
