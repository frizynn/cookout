import { Array as Arr, Effect, Layer } from "effect";
import type { NewMessage, Storage, StorageUnavailable } from "../../server.ts";
import {
  appendTo,
  channelFixture as channel,
  freshDatabasePath,
  isoTime,
  newMessageFixture,
  openStore,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { memoryStorage, sqliteStorage } from "../../server.ts";
import type { MessageId } from "../../../messages/index.ts";
import { NodeServices } from "@effect/platform-node";
import { parseQuery } from "../../../search/index.ts";

const EVERY = { limit: 50, offset: 0, sort: "best" } as const;
const MONDAY = isoTime("2026-01-05T00:00:00.000Z");
const TUESDAY = isoTime("2026-01-06T00:00:00.000Z");

const SHORT = "Deploy: the deploy is a deploy";
const LONG =
  "Lunch is at noon, the coffee machine on the third floor is fixed, and the new starters arrive on " +
  "Monday; after all that, please deploy";

function newMessage(at: NewMessage["createdAt"], text: string): NewMessage {
  return { ...newMessageFixture("grill", text), createdAt: at };
}

interface Ranked {
  readonly found: readonly MessageId[];
  readonly short: MessageId;
  readonly long: MessageId;
}

function ranked<Failure>(layer: Layer.Layer<Storage, Failure>): Effect.Effect<Ranked, Failure | StorageUnavailable> {
  return Effect.gen(function* rankBoth() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const append = appendTo(storage);
    const short = yield* append(newMessage(MONDAY, SHORT));
    const long = yield* append(newMessage(TUESDAY, LONG));
    const page = yield* storage.searchMessages({ authors: [], channels: [], words: parseQuery("deploy").words }, EVERY);
    return { found: Arr.map(page.results, ({ message }) => message.id), long: long.id, short: short.id };
  });
}

const sqliteLayer = Layer.unwrap(Effect.map(freshDatabasePath, sqliteStorage)).pipe(Layer.provide(NodeServices.layer));

it.effect("on SQLite, a short message all about a word ranks above a newer long one that mentions it once", () =>
  Effect.gen(function* sqliteRank() {
    const { found, long, short } = yield* ranked(sqliteLayer);

    expect(found).toStrictEqual([short, long]);
  }),
);

it.effect("in memory, a short message all about a word ranks above a newer long one that mentions it once", () =>
  Effect.gen(function* memoryRank() {
    const { found, long, short } = yield* ranked(memoryStorage);

    expect(found).toStrictEqual([short, long]);
  }),
);
