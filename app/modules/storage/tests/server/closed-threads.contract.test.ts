import { Array as Arr, Effect, Option, Predicate } from "effect";
import {
  appendTo,
  channelFixture as channel,
  identityName,
  isoTime,
  messageId,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { StorageUnavailable } from "../../../storage/server.ts";

const MISSING = 999_999;
const GRILL = channel("grill").name;
const PAGE = { limit: 10 } as const;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const firstClosing = { closedAt: isoTime("2026-01-02T00:00:00.000Z"), closedBy: identityName("ada") };
const laterClosing = { closedAt: isoTime("2026-01-03T00:00:00.000Z"), closedBy: identityName("grace") };

function present<Value>(
  found: Effect.Effect<Value | undefined, StorageUnavailable>,
): Effect.Effect<Value, StorageUnavailable> {
  return Effect.map(found, (value) => Option.getOrThrow(Option.fromUndefinedOr(value)));
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a thread closed from a reply keeps its first closer and shows closed everywhere",
  ({ layer }) =>
    Effect.gen(function* closeKeepsFirst() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      const reply = yield* appendTo(storage)(newMessage("grill", "reply", { replyTo: parent.id }));
      const closed = yield* present(storage.closeThread(reply.id, firstClosing));
      const again = yield* storage.closeThread(parent.id, laterClosing);
      const [thread, page] = yield* Effect.all(
        [present(storage.getThread(parent.id)), present(storage.listChannelMessages(GRILL, PAGE))],
        ONE_AT_A_TIME,
      );

      expect(closed).toMatchObject({ changed: true, parent: { ...firstClosing, id: parent.id, replyCount: 1 } });
      expect(again).toStrictEqual({ changed: false, parent: closed.parent });
      expect([thread.parent, page.messages]).toStrictEqual([closed.parent, [closed.parent]]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): reopening clears the closer, and reopening an open thread changes nothing",
  ({ layer }) =>
    Effect.gen(function* reopenClears() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      yield* storage.closeThread(parent.id, firstClosing);
      const open = yield* present(storage.reopenThread(parent.id));
      const openAgain = yield* storage.reopenThread(parent.id);
      const thread = yield* present(storage.getThread(parent.id));

      expect(open).toStrictEqual({ changed: true, parent });
      expect([openAgain, thread.parent]).toStrictEqual([{ changed: false, parent }, parent]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a reply in a closed thread reopens it; the next reply reopens nothing",
  ({ layer }) =>
    Effect.gen(function* replyReopens() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      yield* storage.closeThread(parent.id, firstClosing);
      const reply = yield* storage.appendMessage(newMessage("grill", "reply", { replyTo: parent.id }));
      const [thread, second] = yield* Effect.all(
        [
          present(storage.getThread(parent.id)),
          storage.appendMessage(newMessage("grill", "second", { replyTo: parent.id })),
        ],
        ONE_AT_A_TIME,
      );

      expect(thread.parent).toMatchObject({ id: parent.id, replyCount: 1 });
      expect(thread.parent).not.toHaveProperty("closedAt");
      expect([reply, second]).toMatchObject([{ reopened: thread.parent, status: "appended" }, { status: "appended" }]);
      expect(second).not.toHaveProperty("reopened.id");
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): closing or reopening a missing message finds nothing",
  ({ layer }) =>
    Effect.gen(function* missingThread() {
      const { storage } = yield* openStore(layer);
      const missing = yield* Effect.all(
        [storage.closeThread(messageId(MISSING), firstClosing), storage.reopenThread(messageId(MISSING))],
        ONE_AT_A_TIME,
      );

      expect(Arr.filter(missing, Predicate.isNotUndefined)).toStrictEqual([]);
    }),
);
