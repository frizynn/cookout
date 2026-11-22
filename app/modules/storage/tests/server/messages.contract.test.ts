import { Array as Arr, Effect, Order, pipe } from "effect";
import {
  appendTo,
  channelFixture as channel,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const TWO_REPLIES = 2;
const ZERO = 0;
const ANSWER = 42;
const RICH_DATA = { done: true, tags: [ANSWER, null, "x"] };

it.effect.each(storageLayers)(
  "storage contract ($adapter): a top-level message is stored with its fields and no replies",
  ({ layer }) =>
    Effect.gen(function* storedTopLevel() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const message = yield* appendTo(storage)(newMessage("grill", "hi", { data: RICH_DATA }));
      const thread = yield* storage.getThread(message.id);

      expect(message).toStrictEqual({
        author: { name: "agent", owner: "matt" },
        channel: "grill",
        createdAt: "2026-01-01T00:00:00.000Z",
        data: RICH_DATA,
        id: message.id,
        kind: "top-level",
        latestReplyId: null,
        mentions: [],
        replyCount: ZERO,
        text: "hi",
      });
      expect(thread).toStrictEqual({ parent: message, replies: [] });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an author with no owner and a message with no data keep those fields absent",
  ({ layer }) =>
    Effect.gen(function* absentFields() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const message = yield* appendTo(storage)(newMessage("grill", "hi", { author: { name: "bot" } }));
      const thread = yield* storage.getThread(message.id);

      expect(message.author).toStrictEqual({ name: "bot" });
      expect(message).not.toHaveProperty("data");
      expect(thread).toStrictEqual({ parent: message, replies: [] });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): JSON data that is a plain string, number or null is kept as it is",
  ({ layer }) =>
    Effect.gen(function* plainData() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const kept = yield* pipe(
        ["text", ZERO, null, []] as const,
        Effect.forEach(
          (data) =>
            appendTo(storage)(newMessage("grill", "hi", { data })).pipe(
              Effect.flatMap((message) => storage.getThread(message.id)),
            ),
          { concurrency: 1 },
        ),
      );

      expect(kept).toMatchObject([
        { parent: { data: "text" } },
        { parent: { data: ZERO } },
        { parent: { data: null } },
        { parent: { data: [] } },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): message IDs strictly increase across channels",
  ({ layer }) =>
    Effect.gen(function* increaseAcross() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("one"));
      yield* storage.createChannel(channel("two"));
      const messages = yield* pipe(
        [newMessage("one", "a"), newMessage("two", "b"), newMessage("one", "c"), newMessage("two", "d")],
        Effect.forEach((message) => appendTo(storage)(message), { concurrency: 1 }),
      );
      const ids = Arr.map(messages, ({ id }) => id);

      expect(Arr.dedupe(Arr.sort(ids, Order.Number))).toStrictEqual(ids);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a reply is stored in its parent's thread and counted on the parent",
  ({ layer }) =>
    Effect.gen(function* storedReply() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      const first = yield* appendTo(storage)(newMessage("grill", "first", { replyTo: parent.id }));
      const second = yield* appendTo(storage)(newMessage("grill", "second", { replyTo: parent.id }));
      const thread = yield* storage.getThread(parent.id);

      expect(first).toStrictEqual({ ...newMessage("grill", "first"), id: first.id, kind: "reply", replyTo: parent.id });
      expect(thread).toStrictEqual({
        parent: { ...parent, latestReplyId: second.id, replyCount: TWO_REPLIES },
        replies: [first, second],
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a reply to a reply is stored on the top-level message's thread",
  ({ layer }) =>
    Effect.gen(function* nestedReply() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      const reply = yield* appendTo(storage)(newMessage("grill", "reply", { replyTo: parent.id }));
      const nested = yield* appendTo(storage)(newMessage("grill", "nested", { replyTo: reply.id }));
      const thread = yield* storage.getThread(parent.id);

      expect(nested).toMatchObject({ replyTo: parent.id });
      expect(thread).toMatchObject({ replies: [{ text: "reply" }, { text: "nested" }] });
    }),
);
