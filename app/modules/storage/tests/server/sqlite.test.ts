import { Array as Arr, Effect, Exit, Option, String as Str, pipe } from "effect";
import type { MessageId, ThreadResponse } from "../../../messages/index.ts";
import {
  appendTo,
  channelFixture,
  freshDatabasePath,
  identityFixture,
  identityName,
  newMessageFixture,
  openStore,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { StorageUnavailable } from "../../server.ts";
import { sqliteStorage } from "../../server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const REOPENS = 3;
const ONE_REPLY = 1;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const griller = identityFixture("auth-griller", { owner: "matt" });

function openAndClose(path: string): Effect.Effect<void, StorageUnavailable> {
  return Effect.gen(function* openCheckClose() {
    const { close, storage } = yield* openStore(sqliteStorage(path));
    yield* storage.checkHealth();
    yield* close;
  });
}

function createThenRotate(path: string): Effect.Effect<void, StorageUnavailable> {
  return Effect.gen(function* seedAndClose() {
    const { close, storage } = yield* openStore(sqliteStorage(path));
    yield* storage.createIdentity(griller, hashA);
    yield* storage.replaceToken(identityName("auth-griller"), hashB);
    yield* close;
  });
}

function postTwo(path: string): Effect.Effect<MessageId, StorageUnavailable> {
  return Effect.gen(function* postTwoAndClose() {
    const { close, storage } = yield* openStore(sqliteStorage(path));
    yield* storage.createChannel(channelFixture("grill"));
    yield* appendTo(storage)(newMessageFixture("grill", "first"));
    const last = yield* appendTo(storage)(newMessageFixture("grill", "second"));
    yield* close;
    return last.id;
  });
}

function postThread(path: string): Effect.Effect<ThreadResponse | undefined, StorageUnavailable> {
  return Effect.gen(function* postAndClose() {
    const { close, storage } = yield* openStore(sqliteStorage(path));
    yield* storage.createChannel(channelFixture("grill", { description: "d" }));
    const parent = yield* appendTo(storage)(newMessageFixture("grill", "p", { author: { name: "a" }, data: null }));
    yield* appendTo(storage)(
      newMessageFixture("grill", "r", { author: { name: "b", owner: "matt" }, replyTo: parent.id }),
    );
    const thread = yield* storage.getThread(parent.id);
    yield* close;
    return thread;
  });
}

it.effect("message IDs keep increasing after the database is reopened", () =>
  Effect.gen(function* idsAfterReopen() {
    const path = yield* freshDatabasePath;
    const lastBeforeClose = yield* postTwo(path);
    const { storage } = yield* openStore(sqliteStorage(path));
    const next = yield* appendTo(storage)(newMessageFixture("grill", "third"));

    expect(next.id).toBeGreaterThan(lastBeforeClose);
  }),
);

it.effect("channels, messages and threads are kept after the database is reopened", () =>
  Effect.gen(function* threadsAfterReopen() {
    const path = yield* freshDatabasePath;
    const before = yield* postThread(path);
    const { storage } = yield* openStore(sqliteStorage(path));
    const channels = yield* storage.listChannels();
    const after = yield* storage.getThread(Option.getOrThrow(Option.fromNullishOr(before)).parent.id);

    expect(channels).toStrictEqual([channelFixture("grill", { description: "d" })]);
    expect(after).toStrictEqual(before);
    expect(after).toMatchObject({ parent: { data: null, replyCount: ONE_REPLY }, replies: [{ text: "r" }] });
  }),
);

it.effect("an existing database opens again without losing its data", () =>
  Effect.gen(function* reopenDatabase() {
    const path = yield* freshDatabasePath;
    yield* pipe(
      Arr.makeBy(REOPENS, () => path),
      Effect.forEach(openAndClose, { concurrency: 1 }),
    );
    const { storage } = yield* openStore(sqliteStorage(path));
    const health = yield* Effect.exit(storage.checkHealth());

    expect(Exit.isSuccess(health)).toBe(true);
  }),
);

it.effect("identities and token hashes are kept after the database is reopened", () =>
  Effect.gen(function* keptAfterReopen() {
    const path = yield* freshDatabasePath;
    yield* createThenRotate(path);
    const { storage } = yield* openStore(sqliteStorage(path));
    const identities = yield* storage.listIdentities();
    const oldHash = yield* storage.findIdentityByTokenHash(hashA);
    const newHash = yield* storage.findIdentityByTokenHash(hashB);

    expect(identities).toStrictEqual([griller]);
    expect(oldHash).toStrictEqual({ status: "revoked" });
    expect(newHash).toStrictEqual({ identity: griller, status: "active" });
  }),
);
