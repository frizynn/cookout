import { Array as Arr, Effect, Order } from "effect";
import type {
  NewMessage,
  SearchPageRequest,
  SearchQuery,
  Storage,
  StorageUnavailable,
} from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  isoTime,
  newMessageFixture,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Layer } from "effect";
import type { MessageId } from "../../../messages/index.ts";
import { parseQuery } from "../../../search/index.ts";

const EVERY = 50;
const PAGE_OF_TWO = 2;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const MONDAY = isoTime("2026-01-05T00:00:00.000Z");
const TUESDAY = isoTime("2026-01-06T00:00:00.000Z");
const WEDNESDAY = isoTime("2026-01-07T00:00:00.000Z");
const THURSDAY = isoTime("2026-01-08T00:00:00.000Z");
const FRIDAY = isoTime("2026-01-09T00:00:00.000Z");
const START = 0;

const TEXTS = [
  [MONDAY, "flaky flaky flaky"],
  [TUESDAY, "the login test is flaky again and nobody knows why it keeps failing on the runners"],
  [WEDNESDAY, "flaky deploy"],
  [THURSDAY, "nothing to see"],
  [FRIDAY, "is the flaky test fixed, or is it still flaky on the main branch?"],
] as const;

type Ids = readonly MessageId[];

function queryOf(text: string): SearchQuery {
  const parsed = parseQuery(text);
  return { authors: [], channels: [], words: parsed.words };
}

function newMessage(at: NewMessage["createdAt"], text: string): NewMessage {
  return { ...newMessageFixture("grill", text), createdAt: at };
}

interface Searcher {
  readonly ids: (query: SearchQuery, page: SearchPageRequest) => Effect.Effect<Ids, StorageUnavailable>;
  readonly bestPages: (query: SearchQuery) => Effect.Effect<Ids, StorageUnavailable>;
}

function searcherOf(storage: Storage["Service"]): Searcher {
  function ids(query: SearchQuery, page: SearchPageRequest): Effect.Effect<Ids, StorageUnavailable> {
    return Effect.map(storage.searchMessages(query, page), ({ results }) =>
      Arr.map(results, ({ message }) => message.id),
    );
  }
  function pagesFrom(query: SearchQuery, offset: number): Effect.Effect<Ids, StorageUnavailable> {
    return Effect.flatMap(storage.searchMessages(query, { limit: PAGE_OF_TWO, offset, sort: "best" }), (page) => {
      const found = Arr.map(page.results, ({ message }) => message.id);
      if (!page.hasMore) {
        return Effect.succeed(found);
      }
      return Effect.map(pagesFrom(query, offset + PAGE_OF_TWO), (rest) => [...found, ...rest]);
    });
  }
  return { bestPages: (query) => pagesFrom(query, START), ids };
}

function aBoard<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Searcher, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* openBoard() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    const append = appendTo(storage);
    yield* Effect.forEach(TEXTS, ([at, text]) => append(newMessage(at, text)), ONE_AT_A_TIME);
    return searcherOf(storage);
  });
}

const byId = Order.mapInput(Order.Number, (id: MessageId) => id);

it.effect.each(storageLayers)(
  "storage contract ($adapter): best match returns the same results as newest, in a stable order across pages",
  ({ layer }) =>
    Effect.gen(function* bestMatchPages() {
      const { bestPages, ids } = yield* aBoard(layer);
      const flaky = queryOf("flak");
      const newest = yield* ids(flaky, { limit: EVERY });
      const best = yield* ids(flaky, { limit: EVERY, offset: START, sort: "best" });
      const paged = yield* bestPages(flaky);
      const again = yield* ids(flaky, { limit: EVERY, offset: START, sort: "best" });

      expect({ again, paged, same: Arr.sort(best, byId) }).toStrictEqual({
        again: best,
        paged: best,
        same: Arr.sort(newest, byId),
      });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): best match of a query with no words lists its matches newest first",
  ({ layer }) =>
    Effect.gen(function* bestMatchNoWords() {
      const { bestPages, ids } = yield* aBoard(layer);
      const everything = queryOf("");
      const newest = yield* ids(everything, { limit: EVERY });
      const best = yield* bestPages(everything);

      expect({ best, count: newest.length }).toStrictEqual({ best: newest, count: TEXTS.length });
    }),
);
