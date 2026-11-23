import { Array as Arr, Effect, Predicate, String as Str, pipe } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  identityFixture as identity,
  messageId,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Layer } from "effect";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const MISSING = 999_999;
const ONE_REPLY = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ANN = { author: { name: "ann" } } as const;
const BOB = { author: { name: "bob" } } as const;
const PEOPLE = [
  ["ann", "a"],
  ["bob", "b"],
  ["cat", "c"],
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

function idsIn(items: readonly { readonly message: Message }[]): readonly MessageId[] {
  return Arr.map(items, (item) => item.message.id);
}

function reasonsIn(items: readonly { readonly message: Message; readonly reasons: readonly string[] }[]): unknown {
  return Arr.map(items, (item) => [item.message.id, item.reasons]);
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a mention keeps only names of existing identities",
  ({ layer }) =>
    Effect.gen(function* mentionsKnownOnly() {
      const storage = yield* storeWithPeople(layer);
      const posted = yield* appendTo(storage)(
        newMessage("grill", "@bob @nobody", { ...ANN, mentions: ["bob", "nobody"] }),
      );
      const thread = yield* storage.getThread(posted.id);

      expect(posted.mentions).toStrictEqual(["bob"]);
      expect(thread).toMatchObject({ parent: { mentions: ["bob"] } });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a reply in a followed thread is unread until acked, and never one's own",
  ({ layer }) =>
    Effect.gen(function* followedReplies() {
      const storage = yield* storeWithPeople(layer);
      const parent = yield* appendTo(storage)(newMessage("grill", "parent", ANN));
      const reply = yield* appendTo(storage)(newMessage("grill", "reply", { ...BOB, replyTo: parent.id }));
      const [before, again, own] = yield* Effect.all(
        [storage.listInbox(nameOf("ann")), storage.listInbox(nameOf("ann")), storage.listInbox(nameOf("bob"))],
        ONE_AT_A_TIME,
      );
      const position = yield* storage.ackMessage(nameOf("ann"), reply.id);
      const after = yield* storage.listInbox(nameOf("ann"));
      const current = { ...parent, latestReplyId: reply.id, replyCount: ONE_REPLY };

      expect(before).toStrictEqual([{ message: reply, parent: current, reasons: ["followed-thread"] }]);
      expect([again, own]).toStrictEqual([before, []]);
      expect([position, after]).toStrictEqual([{ channel: "grill", messageId: reply.id, thread: parent.id }, []]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an ack never moves a read position backwards and clears only its own scope",
  ({ layer }) =>
    Effect.gen(function* ackForwardOnly() {
      const storage = yield* storeWithPeople(layer);
      yield* storage.subscribeChannel(nameOf("ann"), channelName("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent", BOB));
      yield* storage.followThread(nameOf("ann"), parent.id);
      const first = yield* appendTo(storage)(newMessage("grill", "first", { ...BOB, replyTo: parent.id }));
      const second = yield* appendTo(storage)(newMessage("grill", "second", { ...BOB, replyTo: parent.id }));
      const [newer, older] = yield* Effect.all(
        [storage.ackMessage(nameOf("ann"), second.id), storage.ackMessage(nameOf("ann"), first.id)],
        ONE_AT_A_TIME,
      );
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect(newer).toStrictEqual(older);
      expect(idsIn(inbox)).toStrictEqual([parent.id]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a mention in a followed thread is listed once with both reasons, and the mentioned follow",
  ({ layer }) =>
    Effect.gen(function* mentionAndFollow() {
      const storage = yield* storeWithPeople(layer);
      const parent = yield* appendTo(storage)(newMessage("grill", "@bob look", { ...ANN, mentions: ["bob"] }));
      const mention = yield* appendTo(storage)(
        newMessage("grill", "@ann here", { ...BOB, mentions: ["ann"], replyTo: parent.id }),
      );
      const later = yield* appendTo(storage)(
        newMessage("grill", "later", { author: { name: "cat" }, replyTo: parent.id }),
      );
      const ann = yield* storage.listInbox(nameOf("ann"));
      const bob = yield* storage.listInbox(nameOf("bob"));

      expect(reasonsIn(ann)).toStrictEqual([
        [mention.id, ["followed-thread", "mention"]],
        [later.id, ["followed-thread"]],
      ]);
      expect(reasonsIn(bob)).toStrictEqual([
        [parent.id, ["mention"]],
        [later.id, ["followed-thread"]],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a subscribed channel's top-level messages are in the inbox, not its replies",
  ({ layer }) =>
    Effect.gen(function* subscribedChannel() {
      const storage = yield* storeWithPeople(layer);
      const subscribed = yield* storage.subscribeChannel(nameOf("ann"), channelName("ops"));
      const parent = yield* appendTo(storage)(newMessage("ops", "deploy", BOB));
      const reply = yield* appendTo(storage)(newMessage("ops", "done", { ...BOB, replyTo: parent.id }));
      yield* appendTo(storage)(newMessage("grill", "elsewhere", BOB));
      const inbox = yield* storage.listInbox(nameOf("ann"));
      const current = { ...parent, latestReplyId: reply.id, replyCount: ONE_REPLY };

      expect([subscribed, inbox]).toStrictEqual([
        true,
        [{ message: current, parent: current, reasons: ["subscribed-channel"] }],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): after unsubscribing, a channel's top-level messages stay out of the inbox",
  ({ layer }) =>
    Effect.gen(function* unsubscribedChannel() {
      const storage = yield* storeWithPeople(layer);
      yield* storage.subscribeChannel(nameOf("ann"), channelName("ops"));
      const unsubscribed = yield* storage.unsubscribeChannel(nameOf("ann"), channelName("ops"));
      yield* appendTo(storage)(newMessage("ops", "deploy", BOB));
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect([unsubscribed, inbox]).toStrictEqual([true, []]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): posting marks the author's own scope as read",
  ({ layer }) =>
    Effect.gen(function* postingReads() {
      const storage = yield* storeWithPeople(layer);
      const parent = yield* appendTo(storage)(newMessage("grill", "parent", ANN));
      yield* appendTo(storage)(newMessage("grill", "question", { ...BOB, replyTo: parent.id }));
      yield* appendTo(storage)(newMessage("grill", "answer", { ...ANN, replyTo: parent.id }));
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect(inbox).toStrictEqual([]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): unfollowing lasts until the next mention or reply",
  ({ layer }) =>
    Effect.gen(function* unfollowUntil() {
      const storage = yield* storeWithPeople(layer);
      const parent = yield* appendTo(storage)(newMessage("grill", "parent", ANN));
      const unfollowed = yield* storage.unfollowThread(nameOf("ann"), parent.id);
      const quiet = yield* appendTo(storage)(newMessage("grill", "quiet", { ...BOB, replyTo: parent.id }));
      const whileUnfollowed = yield* storage.listInbox(nameOf("ann"));
      const back = yield* appendTo(storage)(
        newMessage("grill", "@ann back", { ...BOB, mentions: ["ann"], replyTo: parent.id }),
      );
      const loud = yield* appendTo(storage)(newMessage("grill", "loud", { ...BOB, replyTo: parent.id }));
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect([unfollowed, whileUnfollowed]).toStrictEqual([parent.id, []]);
      expect(reasonsIn(inbox)).toStrictEqual([
        [quiet.id, ["followed-thread"]],
        [back.id, ["followed-thread", "mention"]],
        [loud.id, ["followed-thread"]],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): following by hand takes the thread of any message in it",
  ({ layer }) =>
    Effect.gen(function* followByHand() {
      const storage = yield* storeWithPeople(layer);
      const parent = yield* appendTo(storage)(newMessage("grill", "parent", BOB));
      const first = yield* appendTo(storage)(newMessage("grill", "first", { ...BOB, replyTo: parent.id }));
      const thread = yield* storage.followThread(nameOf("ann"), first.id);
      const reply = yield* appendTo(storage)(newMessage("grill", "second", { ...BOB, replyTo: parent.id }));
      const inbox = yield* storage.listInbox(nameOf("ann"));

      expect(thread).toBe(parent.id);
      expect(idsIn(inbox)).toStrictEqual([first.id, reply.id]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): following, acking or subscribing to what doesn't exist finds nothing",
  ({ layer }) =>
    Effect.gen(function* missingTargets() {
      const storage = yield* storeWithPeople(layer);
      const found = yield* Effect.all(
        [
          storage.followThread(nameOf("ann"), messageId(MISSING)),
          storage.unfollowThread(nameOf("ann"), messageId(MISSING)),
          storage.ackMessage(nameOf("ann"), messageId(MISSING)),
        ],
        ONE_AT_A_TIME,
      );
      const subscribed = yield* storage.subscribeChannel(nameOf("ann"), channelName("nowhere"));
      const unsubscribed = yield* storage.unsubscribeChannel(nameOf("ann"), channelName("nowhere"));

      expect(Arr.filter(found, Predicate.isNotUndefined)).toStrictEqual([]);
      expect([subscribed, unsubscribed]).toStrictEqual([false, false]);
    }),
);
