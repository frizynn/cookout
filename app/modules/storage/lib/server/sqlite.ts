import { Effect, FileSystem } from "effect";
import type { Scope } from "effect";
import type { StorageService } from "./service.ts";
import { StorageUnavailable } from "./errors.ts";
import { openMigrated } from "./migrations.ts";
import { sqliteAgentSessions } from "./agent-sessions-sqlite.ts";
import { sqliteChannels } from "./channels.ts";
import { sqliteCommands } from "./commands.ts";
import { sqliteHealth } from "./health.ts";
import { sqliteIdentitySections } from "./identity-sections.ts";
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
    const db = yield* openMigrated(path);
    return {
      ...sqliteHealth(db),
      ...sqliteIdentitySections(db),
      ...sqliteChannels(db),
      ...sqliteMessages(db),
      ...sqliteAgentSessions(db),
      ...sqliteCommands(db),
    };
  });
}

export { openSqliteStorage };
