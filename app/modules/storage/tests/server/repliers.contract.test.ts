import { Effect, Option, pipe } from "effect";
import type { MessageId, TopLevelMessage } from "../../../messages/index.ts";
import type { NewMessage, Storage } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  isoTime,
  channelName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { IsoTime } from "../../../time/index.ts";

const PAGE = 10;
const EARLY = isoTime("2026-01-01T00:01:00.000Z");
const LATE = isoTime("2026-01-01T00:05:00.000Z");
const LATEST = isoTime("2026-01-01T00:09:00.000Z");
const FIVE_REPLIERS = ["a", "b", "c", "d", "e"] as const;
const REPLIERS = [{ name: "ada" }, { name: "bot", owner: "matt" }];

interface Replying {
  readonly name: string;
  readonly owner?: string;
  readonly replyTo: MessageId;
  readonly at: IsoTime;
}

function replyOf({ at, name, owner, replyTo }: Replying): NewMessage {
  const author = Option.match(Option.fromUndefinedOr(owner), {
    onNone: () => ({ name }),
    onSome: (named) => ({ name, owner: named }),
  });
  return { ...newMessage("grill", "reply", { author, replyTo }), createdAt: at };
}

function parentOf(storage: Storage["Service"], id: MessageId): Effect.Effect<TopLevelMessage> {
  return storage.getThread(id).pipe(
    Effect.flatMap(Effect.fromNullishOr),
    Effect.map((thread) => thread.parent),
    Effect.orDie,
  );
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a top-level message names its repliers once each, latest first, and its latest reply's time",
  ({ layer }) =>
    Effect.gen(function* repliersLatestFirst() {
      const { storage } = yield* openStore(layer);
      const append = appendTo(storage);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* append(newMessage("grill", "parent"));
      const first = yield* append(replyOf({ at: EARLY, name: "ada", replyTo: parent.id }));
      yield* append(replyOf({ at: LATE, name: "bot", owner: "matt", replyTo: parent.id }));
      yield* append(replyOf({ at: LATEST, name: "ada", replyTo: first.id }));
      const [found, page] = yield* Effect.all(
        [parentOf(storage, parent.id), storage.listChannelMessages(nameOf("grill"), { limit: PAGE })],
        { concurrency: 1 },
      );

      expect(found).toMatchObject({ latestReplyAt: LATEST, repliers: REPLIERS });
      expect(page).toMatchObject({ messages: [{ latestReplyAt: LATEST, repliers: REPLIERS }] });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a top-level message with no replies has no repliers and no latest reply time",
  ({ layer }) =>
    Effect.gen(function* noRepliers() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* appendTo(storage)(newMessage("grill", "parent"));
      const found = yield* parentOf(storage, parent.id);

      expect([parent, found]).toMatchObject([
        { latestReplyAt: null, repliers: [] },
        { latestReplyAt: null, repliers: [] },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a top-level message names its four latest repliers",
  ({ layer }) =>
    Effect.gen(function* fourRepliers() {
      const { storage } = yield* openStore(layer);
      const append = appendTo(storage);
      yield* storage.createChannel(channel("grill"));
      const parent = yield* append(newMessage("grill", "parent"));
      yield* pipe(
        FIVE_REPLIERS,
        Effect.forEach((name) => append(replyOf({ at: LATE, name, replyTo: parent.id })), { concurrency: 1 }),
      );
      const { repliers } = yield* parentOf(storage, parent.id);

      expect(repliers).toStrictEqual([{ name: "e" }, { name: "d" }, { name: "c" }, { name: "b" }]);
    }),
);
