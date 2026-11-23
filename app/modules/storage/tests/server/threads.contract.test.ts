import { Array as Arr, Effect, Option, pipe } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import {
  appendTo,
  channelFixture as channel,
  messageId,
  channelName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const MISSING = 999_999;
const FIRST = 1;
const PAGE = 2;
const LARGE_PAGE = 10;
const FOURTH = 3;
const SECOND = 1;
const THIRD = 2;
const unavailable = { _tag: "StorageUnavailable" };

interface PageBefore {
  readonly before: MessageId;
  readonly limit: number;
}

function pageBefore(posted: readonly Message[], index: number): PageBefore {
  return { before: Option.getOrThrow(Arr.get(posted, index)).id, limit: PAGE };
}

it.effect.each(storageLayers)("storage contract ($adapter): a thread is found from any message in it", ({ layer }) =>
  Effect.gen(function* threadFromAny() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
    const reply = yield* appendTo(storage)(newMessage("grill", "reply", { replyTo: parent.id }));
    const fromReply = yield* storage.getThread(reply.id);
    const fromParent = yield* storage.getThread(parent.id);
    const missing = yield* storage.getThread(messageId(MISSING));

    expect(fromReply).toStrictEqual(fromParent);
    expect(missing).toBeUndefined();
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): appending to a missing channel is refused and takes nothing",
  ({ layer }) =>
    Effect.gen(function* missingChannel() {
      const { storage } = yield* openStore(layer);
      const result = yield* storage.appendMessage(newMessage("nowhere", "hi"));
      const channels = yield* storage.listChannels();

      expect(result).toStrictEqual({ status: "channel_not_found" });
      expect(channels).toStrictEqual([]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): replying to a missing message is refused and stores nothing",
  ({ layer }) =>
    Effect.gen(function* missingParent() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const result = yield* storage.appendMessage(newMessage("grill", "hi", { replyTo: messageId(MISSING) }));
      const page = yield* storage.listChannelMessages(nameOf("grill"), { limit: LARGE_PAGE });

      expect(result).toStrictEqual({ status: "reply_to_not_found" });
      expect(page).toStrictEqual({ hasMore: false, messages: [] });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): replying to a message in another channel is refused and stores nothing",
  ({ layer }) =>
    Effect.gen(function* otherChannel() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("one"));
      yield* storage.createChannel(channel("two"));
      const parent = yield* appendTo(storage)(newMessage("one", "parent"));
      const result = yield* storage.appendMessage(newMessage("two", "hi", { replyTo: parent.id }));
      const thread = yield* storage.getThread(parent.id);

      expect(result).toStrictEqual({ status: "reply_in_other_channel" });
      expect(thread).toMatchObject({ replies: [] });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a channel page is its newest top-level messages, oldest first, with reply counts",
  ({ layer }) =>
    Effect.gen(function* channelPage() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      yield* storage.createChannel(channel("other"));
      const first = yield* appendTo(storage)(newMessage("grill", "a"));
      const reply = yield* appendTo(storage)(newMessage("grill", "reply", { replyTo: first.id }));
      yield* appendTo(storage)(newMessage("other", "elsewhere"));
      const second = yield* appendTo(storage)(newMessage("grill", "b"));
      const page = yield* storage.listChannelMessages(nameOf("grill"), { limit: LARGE_PAGE });

      expect(page).toStrictEqual({
        hasMore: false,
        messages: [
          {
            ...first,
            latestReplyAt: reply.createdAt,
            latestReplyId: reply.id,
            repliers: [reply.author],
            replyCount: FIRST,
          },
          second,
        ],
      });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a channel page goes back from a message ID", ({ layer }) =>
  Effect.gen(function* pageBack() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const posted = yield* pipe(
      ["m0", "m1", "m2", "m3", "m4"],
      Effect.forEach((text) => appendTo(storage)(newMessage("grill", text)), { concurrency: 1 }),
    );
    const pages = yield* pipe(
      [{ limit: PAGE }, ...Arr.map([FOURTH, SECOND, THIRD], (index) => pageBefore(posted, index))] as const,
      Effect.forEach((request) => storage.listChannelMessages(nameOf("grill"), request), { concurrency: 1 }),
    );

    expect(pages).toMatchObject([
      { hasMore: true, messages: [{ text: "m3" }, { text: "m4" }] },
      { hasMore: true, messages: [{ text: "m1" }, { text: "m2" }] },
      { hasMore: false, messages: [{ text: "m0" }] },
      { hasMore: false, messages: [{ text: "m0" }, { text: "m1" }] },
    ]);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): the page of a missing channel is undefined", ({ layer }) =>
  Effect.gen(function* missingPage() {
    const { storage } = yield* openStore(layer);
    const page = yield* storage.listChannelMessages(nameOf("nowhere"), { limit: LARGE_PAGE });

    expect(page).toBeUndefined();
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): messages cannot be used in a closed store", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    yield* close;
    const appended = yield* Effect.flip(storage.appendMessage(newMessage("grill", "hi")));
    const listed = yield* Effect.flip(storage.listChannelMessages(nameOf("grill"), { limit: LARGE_PAGE }));
    const thread = yield* Effect.flip(storage.getThread(messageId(FIRST)));

    expect([appended, listed, thread]).toMatchObject([unavailable, unavailable, unavailable]);
  }),
);
