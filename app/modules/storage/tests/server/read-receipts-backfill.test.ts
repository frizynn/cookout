import { Array as Arr, Effect, FileSystem, Option, String as Str } from "effect";
import type { Message, MessageId } from "../../../messages/index.ts";
import type { Storage, StorageUnavailable } from "../../server.ts";
import {
  appendTo,
  channelFixture,
  fixtureTime,
  freshDatabasePath,
  identityFixture,
  identityName,
  newMessageFixture,
  openStore,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";
import { sqliteStorage } from "../../server.ts";
import { tokenHash } from "../../../identities/index.ts";

type OnDisk<Value> = Effect.Effect<Value, StorageUnavailable, FileSystem.FileSystem>;

const HASH_LENGTH = 64;
const FIRST = 0;
const SECOND = 1;
const ONE_VERSION = 1;
const SCHEMA_VERSION_OFFSET = 60;
const RECEIPTS_TABLE = "read_receipts";
const SET_ASIDE_TABLE = "old_receipts_";

interface Posted {
  readonly mention: Message;
  readonly reply: Message;
}

function asText(bytes: Iterable<number>): string {
  return Arr.join(
    Arr.map(Arr.fromIterable(bytes), (byte) => String.fromCodePoint(byte)),
    "",
  );
}

function asBytes(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => Option.getOrElse(Str.codePointAt(FIRST)(char), () => FIRST));
}

function receiptsSetAside(bytes: Iterable<number>): Uint8Array {
  const text = asText(bytes);
  return asBytes(Str.replaceAll(RECEIPTS_TABLE, SET_ASIDE_TABLE)(text));
}

function fromBeforeReceipts(path: string): OnDisk<void> {
  return Effect.gen(function* rewriteFile() {
    const fs = yield* FileSystem.FileSystem;
    const before = yield* fs.readFile(path);
    const file = receiptsSetAside(before);
    const header = new DataView(file.buffer);
    header.setInt32(SCHEMA_VERSION_OFFSET, header.getInt32(SCHEMA_VERSION_OFFSET) - ONE_VERSION);
    yield* fs.writeFile(path, file);
  }).pipe(Effect.catchTag("PlatformError", Effect.die));
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
    yield* fromBeforeReceipts(path);
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
