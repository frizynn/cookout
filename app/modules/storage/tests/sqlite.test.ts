import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { tokenHash } from "../../identities/index.ts";
import { freshDatabasePath, identityFixture, identityName, openStore } from "../../testing/server.ts";
import { sqliteStorage } from "../server.ts";

it.effect("an existing database opens again without losing its data", () =>
  Effect.gen(function* () {
    const path = yield* freshDatabasePath;
    for (const _ of [1, 2, 3]) {
      const { storage, close } = yield* openStore(sqliteStorage(path));
      yield* storage.checkHealth();
      yield* close;
    }
    const { storage } = yield* openStore(sqliteStorage(path));
    yield* storage.checkHealth();
  }),
);

it.effect("identities and token hashes are kept after the database is reopened", () =>
  Effect.gen(function* () {
    const path = yield* freshDatabasePath;
    const identity = identityFixture("auth-griller", { owner: "matt" });
    const [hashA, hashB] = [tokenHash("a".repeat(64)), tokenHash("b".repeat(64))];
    const first = yield* openStore(sqliteStorage(path));
    yield* first.storage.createIdentity(identity, hashA);
    yield* first.storage.replaceToken(identityName("auth-griller"), hashB);
    yield* first.close;

    const { storage } = yield* openStore(sqliteStorage(path));
    expect(yield* storage.listIdentities()).toEqual([identity]);
    expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
    expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({ status: "active", identity });
  }),
);
