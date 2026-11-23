import { Array as Arr, Effect, String as Str, pipe } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  identityFixture as identity,
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
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ANN = { author: { name: "ann" } } as const;
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
    yield* storage.createChannel(channel("ops"));
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

interface AnnsInbox {
  readonly parent: Message;
  readonly reply: Message;
  readonly mention: Message;
  readonly newest: Message;
  readonly later: Message;
}

function inboxOfAnn(storage: Storage["Service"]): Effect.Effect<AnnsInbox, StorageUnavailable> {
  return Effect.gen(function* postToAnn() {
    const append = appendTo(storage);
    yield* storage.subscribeChannel(nameOf("ann"), channelName("ops"));
    const parent = yield* append(newMessage("grill", "parent", ANN));
    const reply = yield* append(newMessage("grill", "reply", { ...BOB, replyTo: parent.id }));
    const mention = yield* append(newMessage("grill", "@ann", { ...BOB, mentions: ["ann"] }));
    yield* append(newMessage("ops", "first", BOB));
    const newest = yield* append(newMessage("ops", "second", BOB));
    const later = yield* append(newMessage("ops", "later", BOB));
    return { later, mention, newest, parent, reply };
  });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): acking the inbox up to a message reads every item up to it, and none after",
  ({ layer }) =>
    Effect.gen(function* ackInboxUpTo() {
      const storage = yield* storeWithPeople(layer);
      const { later, mention, newest, parent, reply } = yield* inboxOfAnn(storage);

      const moved = yield* storage.ackInbox(nameOf("ann"), newest.id);
      const left = yield* storage.listInbox(nameOf("ann"));
      const again = yield* storage.ackInbox(nameOf("ann"), newest.id);

      expect({ again, left: Arr.map(left, (item) => item.message.id), moved }).toStrictEqual({
        again: [],
        left: [later.id],
        moved: [
          { channel: "grill", messageId: reply.id, thread: parent.id },
          { channel: "grill", messageId: mention.id, thread: null },
          { channel: "ops", messageId: newest.id, thread: null },
        ],
      });
    }),
);
