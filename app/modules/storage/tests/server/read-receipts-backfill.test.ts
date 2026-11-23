import { Effect, String as Str } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { Storage, StorageUnavailable } from "../../server.ts";
import {
  appendTo,
  backfillReadReceiptsAgain,
  channelFixture,
  fixtureTime,
  freshDatabasePath,
  identityFixture,
  identityName,
  newMessageFixture,
  openStore,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { FileSystem } from "effect";
import { NodeServices } from "@effect/platform-node";
import { sqliteStorage } from "../../server.ts";
import { tokenHash } from "../../../identities/index.ts";

type OnDisk<Value> = Effect.Effect<Value, StorageUnavailable, FileSystem.FileSystem>;

const HASH_LENGTH = 64;
const FIRST = 0;
const SECOND = 1;

interface Posted {
  readonly mention: Message;
  readonly reply: Message;
}

function postMentionAndReply(storage: Storage["Service"]): Effect.Effect<Posted, StorageUnavailable> {
  return Effect.gen(function* postBoth() {
    yield* storage.createIdentity(identityFixture("ann", { kind: "human" }), tokenHash(Str.repeat(HASH_LENGTH)("a")));
    yield* storage.createIdentity(identityFixture("bob", { kind: "human" }), tokenHash(Str.repeat(HASH_LENGTH)("b")));
    yield* storage.createChannel(channelFixture("grill"));
    const mention = yield* appendTo(storage)(
      newMessageFixture("grill", "@bob look", { author: { name: "ann" }, mentions: ["bob"] }),
    );
    const reply = yield* appendTo(storage)(
      newMessageFixture("grill", "an answer", { author: { name: "bob" }, replyTo: mention.id }),
    );
    return { mention, reply };
  });
}

function ackedBeforeReceipts(path: string): OnDisk<readonly MessageId[]> {
  return Effect.gen(function* postAckAndForget() {
    const { close, storage } = yield* openStore(sqliteStorage(path));
    const { mention, reply } = yield* postMentionAndReply(storage);
    yield* storage.ackMessage(identityName("bob"), mention.id, fixtureTime);
    yield* storage.ackMessage(identityName("ann"), reply.id, fixtureTime);
    yield* close;
    yield* backfillReadReceiptsAgain(path);
    return [mention.id, reply.id];
  });
}

it.effect("the read receipts backfill marks the messages read positions already passed as seen, with no time", () =>
  Effect.gen(function* backfill() {
    const path = yield* freshDatabasePath;
    const ids = yield* ackedBeforeReceipts(path);
    const { storage } = yield* openStore(sqliteStorage(path));

    const receipts = yield* storage.listReadReceipts(ids);

    expect(receipts).toStrictEqual([
      { identity: "bob", messageId: ids[FIRST], seen: true },
      { identity: "ann", messageId: ids[SECOND], seen: true },
    ]);
  }).pipe(Effect.provide(NodeServices.layer)),
);
