import { Array as Arr, Effect, Exit, String as Str, pipe } from "effect";
import { expect, it } from "@effect/vitest";
import { freshDatabasePath, identityFixture, identityName, openStore } from "../../../testing/server.ts";
import type { StorageUnavailable } from "../../server.ts";
import { sqliteStorage } from "../../server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const REOPENS = 3;
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
