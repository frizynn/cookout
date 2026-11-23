import { Effect, FileSystem } from "effect";
import type { Scope } from "effect";
import type { StorageService } from "./service.ts";
import { StorageUnavailable } from "./errors.ts";
import { migrate } from "./migrations.ts";
import { openSqlite } from "./adapters/sqlite.ts";
import { sqliteChannels } from "./channels.ts";
import { sqliteHealth } from "./health.ts";
import { sqliteIdentities } from "./identities.ts";
import { sqliteLeases } from "./leases-sqlite.ts";
import { sqliteMessages } from "./messages-sqlite.ts";

const OWNER_ONLY = 0o600;

function unavailable({ message }: { readonly message: string }): StorageUnavailable {
  return StorageUnavailable.make({ message });
}

function createOwnerOnly(path: string): Effect.Effect<void, StorageUnavailable, FileSystem.FileSystem> {
  return Effect.gen(function* createDatabaseFile() {
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.scoped(fs.open(path, { flag: "a", mode: OWNER_ONLY }));
  }).pipe(Effect.mapError(unavailable));
}

function openSqliteStorage(
  path: string,
): Effect.Effect<StorageService, StorageUnavailable, FileSystem.FileSystem | Scope.Scope> {
  return Effect.gen(function* openStorage() {
    yield* createOwnerOnly(path);
    const db = yield* openSqlite(path);
    yield* migrate(db);
    return {
      ...sqliteHealth(db),
      ...sqliteIdentities(db),
      ...sqliteChannels(db),
      ...sqliteMessages(db),
      ...sqliteLeases(db),
    };
  });
}

export { openSqliteStorage };
