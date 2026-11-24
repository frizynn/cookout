import { Array as Arr, Effect, String as Str } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { NewMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  identityFixture,
  identityName,
  isoTime,
  newMessageFixture,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Layer } from "effect";
import type { NewMessageOptions } from "../../../testing/server.ts";
import { tokenHash } from "../../../identities/index.ts";

const ADA = identityName("ada");
const ALL = { all: true, limit: 10 } as const;
const MINE = { all: false, limit: 10 } as const;
const PAGE_OF_TWO = 2;
const EXPECTED_OPEN = 3;
const HASH_LENGTH = 64;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const MONDAY = isoTime("2026-01-05T00:00:00.000Z");
const TUESDAY = isoTime("2026-01-06T00:00:00.000Z");
const FRIDAY = isoTime("2026-01-09T00:00:00.000Z");
const SATURDAY = isoTime("2026-01-10T00:00:00.000Z");
const SUNDAY = isoTime("2026-01-11T00:00:00.000Z");
const closing = { closedAt: FRIDAY, closedBy: ADA };
const BY_ADA = { author: { name: "ada" } } as const;
const MENTIONS_ADA = { mentions: ["ada"] } as const;

type Page = Effect.Success<ReturnType<Storage["Service"]["listOpenThreads"]>>;

interface Grill {
  readonly storage: Storage["Service"];
  readonly post: (at: NewMessage["createdAt"], text: string, options?: NewMessageOptions) => Effect.Effect<Message>;
  readonly reply: (parent: MessageId, options?: NewMessageOptions) => Effect.Effect<Message>;
}

function newMessage(at: NewMessage["createdAt"], text: string, options: NewMessageOptions = {}): NewMessage {
  return { ...newMessageFixture("grill", text, options), createdAt: at };
}

function grill<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Grill, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* openGrill() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    yield* storage.createIdentity(identityFixture("ada"), tokenHash(Str.repeat(HASH_LENGTH)("a")));
    const append = appendTo(storage);
    return {
      post: (at, text, options) => append(newMessage(at, text, options)),
      reply: (parent, options) => append(newMessage(MONDAY, "reply", { ...options, replyTo: parent })),
      storage,
    };
  });
}

function idsOf(page: Page): readonly number[] {
  return Arr.map(page.threads, (thread) => thread.message.id);
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): open threads list stalest first by last activity, leaving out closed ones",
  ({ layer }) =>
    Effect.gen(function* stalestFirst() {
      const { post, storage } = yield* grill(layer);
      const first = yield* post(MONDAY, "first");
      const second = yield* post(TUESDAY, "second");
      const closed = yield* post(TUESDAY, "closed");
      const sameDay = yield* post(TUESDAY, "same day");
      yield* post(FRIDAY, "reply", { replyTo: first.id });
      yield* storage.closeThread(closed.id, closing);
      const page = yield* storage.listOpenThreads(ADA, ALL);

      expect(page).toMatchObject({
        hasMore: false,
        threads: [
          { lastActivityAt: TUESDAY, message: { id: second.id } },
          { lastActivityAt: sameDay.createdAt, message: { id: sameDay.id } },
          { lastActivityAt: FRIDAY, message: { id: first.id, replyCount: 1 } },
        ],
      });
      expect(page.threads).toHaveLength(EXPECTED_OPEN);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a reopen later than the latest message is the thread's last activity",
  ({ layer }) =>
    Effect.gen(function* reopenCounts() {
      const { post, storage } = yield* grill(layer);
      const reopened = yield* post(MONDAY, "reopened");
      const quiet = yield* post(TUESDAY, "quiet");
      yield* storage.closeThread(reopened.id, closing);
      yield* storage.reopenThread(reopened.id, SATURDAY);
      yield* storage.reopenThread(reopened.id, SUNDAY);
      const page = yield* storage.listOpenThreads(ADA, ALL);

      expect(page.threads).toMatchObject([
        { lastActivityAt: TUESDAY, message: { id: quiet.id } },
        { lastActivityAt: SATURDAY, message: { id: reopened.id } },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): without all, only threads the identity started, replied in or is mentioned in",
  ({ layer }) =>
    Effect.gen(function* involving() {
      const { post, reply, storage } = yield* grill(layer);
      const started = yield* post(MONDAY, "mine", BY_ADA);
      const replied = yield* post(MONDAY, "replied");
      const mentioned = yield* post(MONDAY, "@ada look", MENTIONS_ADA);
      const mentionedInReply = yield* post(MONDAY, "mentioned in a reply");
      const other = yield* post(MONDAY, "not mine");
      yield* Effect.all([reply(replied.id, BY_ADA), reply(mentionedInReply.id, MENTIONS_ADA)], ONE_AT_A_TIME);
      const [mine, all] = yield* Effect.all(
        [storage.listOpenThreads(ADA, MINE), storage.listOpenThreads(ADA, ALL)],
        ONE_AT_A_TIME,
      );

      expect(idsOf(mine)).toStrictEqual([started.id, mentioned.id, replied.id, mentionedInReply.id]);
      expect(idsOf(all)).toContain(other.id);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a page starts after its cursor and says whether more remain",
  ({ layer }) =>
    Effect.gen(function* paging() {
      const { post, storage } = yield* grill(layer);
      const first = yield* post(MONDAY, "first");
      const second = yield* post(MONDAY, "second");
      const third = yield* post(TUESDAY, "third");
      const firstPage = yield* storage.listOpenThreads(ADA, { all: true, limit: PAGE_OF_TWO });
      const after = { id: second.id, lastActivityAt: second.createdAt };
      const lastPage = yield* storage.listOpenThreads(ADA, { after, all: true, limit: PAGE_OF_TWO });

      expect([idsOf(firstPage), firstPage.hasMore]).toStrictEqual([[first.id, second.id], true]);
      expect([idsOf(lastPage), lastPage.hasMore]).toStrictEqual([[third.id], false]);
    }),
);
