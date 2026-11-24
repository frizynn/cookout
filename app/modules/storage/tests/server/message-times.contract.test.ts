import { Array as Arr, Effect } from "effect";
import type { NewMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  identityName,
  isoTime,
  newMessageFixture,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { MessageId } from "../../../messages/index.ts";
import type { NewMessageOptions } from "../../../testing/server.ts";

const LATER = isoTime("2026-01-05T00:00:00.108Z");
const STEPPED_BACK = isoTime("2026-01-05T00:00:00.000Z");
const AFTER_THAT = isoTime("2026-01-05T00:00:01.000Z");
const ALL = { all: true, limit: 10 } as const;
const PAGE = { limit: 10 } as const;

function at(createdAt: NewMessage["createdAt"], text: string, options: NewMessageOptions = {}): NewMessage {
  return { ...newMessageFixture("grill", text, options), createdAt };
}

function openIds(storage: Storage["Service"]): Effect.Effect<readonly MessageId[], StorageUnavailable> {
  return Effect.map(storage.listOpenThreads(identityName("ada"), ALL), ({ threads }) =>
    Arr.map(threads, ({ message }) => message.id),
  );
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a message stamped earlier than the latest one takes the latest time",
  ({ layer }) =>
    Effect.gen(function* neverBackwards() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const append = appendTo(storage);
      const first = yield* append(at(LATER, "first"));
      const second = yield* append(at(STEPPED_BACK, "second"));
      const third = yield* append(at(AFTER_THAT, "third"));

      expect(Arr.map([first, second, third], ({ createdAt }) => createdAt)).toStrictEqual([LATER, LATER, AFTER_THAT]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): after the clock steps back, lists keep posting order",
  ({ layer }) =>
    Effect.gen(function* postingOrder() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const first = yield* appendTo(storage)(at(LATER, "first"));
      const second = yield* appendTo(storage)(at(STEPPED_BACK, "second"));
      const before = yield* openIds(storage);
      yield* appendTo(storage)(at(AFTER_THAT, "bump", { replyTo: first.id }));
      const after = yield* openIds(storage);
      const page = yield* storage.listChannelMessages(channel("grill").name, PAGE);

      expect([before, after]).toStrictEqual([
        [first.id, second.id],
        [second.id, first.id],
      ]);
      expect(page).toMatchObject({ messages: [{ id: first.id }, { id: second.id }] });
    }),
);
