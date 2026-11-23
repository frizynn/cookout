import { Effect, String as Str, pipe } from "effect";
import type { Message, MessageId, Reaction } from "../../../messages/index.ts";
import type { NewMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
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
const ANN = { author: { name: "ann" } } as const;
const CAT = { author: { name: "cat" } } as const;
const PEOPLE = [
  ["ann", "a"],
  ["bob", "b"],
  ["cat", "c"],
] as const;

type Store = Storage["Service"];

function storeWithPeople<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Store, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* openWithPeople() {
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

interface Acking {
  readonly storage: Store;
  readonly older: NewMessage;
  readonly acked: NewMessage;
  readonly newer: NewMessage;
}

interface Acked {
  readonly last: Message;
  readonly unseen: readonly Reaction[];
}

function bobReactsThenAnnAcks({ acked, newer, older, storage }: Acking): Effect.Effect<Acked, StorageUnavailable> {
  return Effect.gen(function* reactThenAck() {
    const first = yield* appendTo(storage)(older);
    const middle = yield* appendTo(storage)(acked);
    const last = yield* appendTo(storage)(newer);
    yield* Effect.forEach(
      [first.id, last.id],
      (messageId: MessageId) =>
        storage.addReaction({
          identity: nameOf("bob"),
          messageId,
          notifiesAuthor: true,
          reactedAt: fixtureTime,
          reaction: "thumbs_up",
        }),
      ONE_AT_A_TIME,
    );
    yield* storage.ackMessage(nameOf("ann"), middle.id, fixtureTime);
    const unseen = yield* storage.listUnseenReactions(nameOf("ann"));
    return { last, unseen };
  });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): acking a message clears reactions on earlier messages in its channel, not later ones",
  ({ layer }) =>
    Effect.gen(function* ackInChannel() {
      const storage = yield* storeWithPeople(layer);
      const { last, unseen } = yield* bobReactsThenAnnAcks({
        acked: newMessage("grill", "cat's", CAT),
        newer: newMessage("grill", "after", ANN),
        older: newMessage("grill", "before", ANN),
        storage,
      });

      expect(unseen).toMatchObject([{ identity: "bob", messageId: last.id }]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): acking a reply clears reactions on earlier replies in its thread, not later ones",
  ({ layer }) =>
    Effect.gen(function* ackInThread() {
      const storage = yield* storeWithPeople(layer);
      const root = yield* appendTo(storage)(newMessage("grill", "question", CAT));
      const inThread = { replyTo: root.id };
      const { last, unseen } = yield* bobReactsThenAnnAcks({
        acked: newMessage("grill", "cat's", { ...CAT, ...inThread }),
        newer: newMessage("grill", "after", { ...ANN, ...inThread }),
        older: newMessage("grill", "before", { ...ANN, ...inThread }),
        storage,
      });

      expect(unseen).toMatchObject([{ identity: "bob", messageId: last.id }]);
    }),
);
