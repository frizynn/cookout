import { Array as Arr, Effect, String as Str, pipe } from "effect";
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
import type { Message } from "../../../messages/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ALL = { limit: 50 } as const;
const ANN = { author: { name: "ann" } } as const;
const BOB = { author: { name: "bob" } } as const;
const PEOPLE = [
  ["ann", "a"],
  ["bob", "b"],
] as const;

interface ListedItem {
  readonly message: Message;
  readonly reasons: readonly string[];
  readonly read: boolean;
}

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

function storeWithAnnSubscribed<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Storage["Service"], Failure | StorageUnavailable, Needs> {
  return Effect.tap(storeWithPeople(layer), (storage) => storage.subscribeChannel(nameOf("ann"), channelName("grill")));
}

function listed(items: readonly ListedItem[]): unknown {
  return Arr.map(items, (item) => [item.message.id, item.reasons, item.read]);
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): the inbox history lists read and unread items newest first, never one's own",
  ({ layer }) =>
    Effect.gen(function* historyListsReadAndUnread() {
      const storage = yield* storeWithAnnSubscribed(layer);
      const append = appendTo(storage);
      const first = yield* append(newMessage("grill", "first", BOB));
      yield* append(newMessage("grill", "own", ANN));
      const mention = yield* append(newMessage("grill", "@ann look", { ...BOB, mentions: ["ann"] }));
      const before = yield* storage.listInboxHistory(nameOf("ann"), ALL);
      yield* storage.ackMessage(nameOf("ann"), mention.id, fixtureTime);
      const after = yield* storage.listInboxHistory(nameOf("ann"), ALL);
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect([before.hasMore, listed(before.items), listed(after.items), inbox]).toStrictEqual([
        false,
        [
          [mention.id, ["mention", "subscribed-channel"], false],
          [first.id, ["subscribed-channel"], true],
        ],
        [
          [mention.id, ["mention", "subscribed-channel"], true],
          [first.id, ["subscribed-channel"], true],
        ],
        [],
      ]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): the inbox history pages back by message ID", ({ layer }) =>
  Effect.gen(function* historyPages() {
    const storage = yield* storeWithPeople(layer);
    const append = appendTo(storage);
    const mentionAnn = { ...BOB, mentions: ["ann"] };
    const first = yield* append(newMessage("grill", "@ann one", mentionAnn));
    const second = yield* append(newMessage("grill", "@ann two", mentionAnn));
    const third = yield* append(newMessage("grill", "@ann three", mentionAnn));
    const newest = yield* storage.listInboxHistory(nameOf("ann"), { limit: 2 });
    const older = yield* storage.listInboxHistory(nameOf("ann"), { before: second.id, limit: 2 });

    expect([listed(newest.items), newest.hasMore]).toStrictEqual([
      [
        [third.id, ["mention"], false],
        [second.id, ["mention"], false],
      ],
      true,
    ]);
    expect([listed(older.items), older.hasMore]).toStrictEqual([[[first.id, ["mention"], false]], false]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): unsubscribing and unfollowing drop items from the inbox history unless another reason keeps them",
  ({ layer }) =>
    Effect.gen(function* historyFollowsCurrentState() {
      const storage = yield* storeWithAnnSubscribed(layer);
      const append = appendTo(storage);
      const plain = yield* append(newMessage("grill", "plain", BOB));
      const mention = yield* append(newMessage("grill", "@ann look", { ...BOB, mentions: ["ann"] }));
      const reply = yield* append(newMessage("grill", "reply", { ...BOB, replyTo: mention.id }));
      const before = yield* storage.listInboxHistory(nameOf("ann"), ALL);
      yield* storage.unsubscribeChannel(nameOf("ann"), channelName("grill"));
      yield* storage.unfollowThread(nameOf("ann"), mention.id);
      const after = yield* storage.listInboxHistory(nameOf("ann"), ALL);

      expect([listed(before.items), listed(after.items)]).toStrictEqual([
        [
          [reply.id, ["followed-thread"], false],
          [mention.id, ["mention", "subscribed-channel"], false],
          [plain.id, ["subscribed-channel"], false],
        ],
        [[mention.id, ["mention"], false]],
      ]);
    }),
);

function bobAndAnnReact(storage: Storage["Service"]): Effect.Effect<Message, StorageUnavailable> {
  return Effect.gen(function* reactToAnn() {
    const append = appendTo(storage);
    const reacted = yield* append(newMessage("grill", "ship it?", ANN));
    const selfReacted = yield* append(newMessage("grill", "own", ANN));
    const reaction = { reactedAt: fixtureTime, reaction: "thumbs_up" } as const;
    yield* storage.addReaction({ ...reaction, identity: nameOf("bob"), messageId: reacted.id, notifiesAuthor: true });
    yield* storage.addReaction({
      ...reaction,
      identity: nameOf("ann"),
      messageId: selfReacted.id,
      notifiesAuthor: false,
    });
    return reacted;
  });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): the inbox history lists one's own message another identity reacted to, read once seen",
  ({ layer }) =>
    Effect.gen(function* historyListsReactionItems() {
      const storage = yield* storeWithAnnSubscribed(layer);
      const reacted = yield* bobAndAnnReact(storage);
      const before = yield* storage.listInboxHistory(nameOf("ann"), ALL);
      yield* storage.markReactionsSeen(nameOf("ann"), [reacted.id]);
      const after = yield* storage.listInboxHistory(nameOf("ann"), ALL);
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect([listed(before.items), listed(after.items), inbox]).toStrictEqual([
        [[reacted.id, ["reaction"], false]],
        [[reacted.id, ["reaction"], true]],
        [],
      ]);
    }),
);
