import { Array as Arr, Effect, Order, pipe } from "effect";
import {
  appendTo,
  channelFixture as channel,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { isMessageId } from "../../../messages/index.ts";

const FIVE = 5;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

it.effect.each(storageLayers)("storage contract ($adapter): message IDs are positive whole numbers", ({ layer }) =>
  Effect.gen(function* positiveIds() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const { id } = yield* appendTo(storage)(newMessage("grill", "hi"));

    expect(isMessageId(id)).toBe(true);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): message IDs increase with every message", ({ layer }) =>
  Effect.gen(function* increasingIds() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const messages = yield* pipe(
      Arr.makeBy(FIVE, (index) => newMessage("grill", `m${String(index)}`)),
      Effect.forEach((message) => appendTo(storage)(message), ONE_AT_A_TIME),
    );
    const ids = Arr.map(messages, ({ id }) => id);

    expect(Arr.dedupe(Arr.sort(ids, Order.Number))).toStrictEqual(ids);
    expect(ids).toHaveLength(FIVE);
  }),
);
