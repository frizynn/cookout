import { Effect, identity } from "effect";
import type { StorageService } from "./service.ts";
import { openMigrated } from "./migrations.ts";
import { sqlChannels } from "./channels.ts";
import { sqlHealth } from "./health.ts";
import { sqlReactions } from "./reactions-sqlite.ts";
import { sqliteAgentSessionSections } from "./agent-join-requests-sqlite.ts";
import { sqliteCommands } from "./commands.ts";
import { sqliteIdentitySections } from "./identity-sections.ts";
import { sqliteMessages } from "./sqlite-messages.ts";

type Opened = ReturnType<typeof openMigrated>;

interface OpenedStorage {
  readonly db: Effect.Success<Opened>;
  readonly storage: StorageService;
}

interface SqliteOpening {
  readonly path: string;
  readonly watch?: (db: Effect.Success<Opened>) => Effect.Success<Opened>;
}

function openSqliteStorage({
  path,
  watch = identity,
}: SqliteOpening): Effect.Effect<OpenedStorage, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const migrated = yield* openMigrated(path);
    const db = watch(migrated);
    const storage: StorageService = {
      ...sqlHealth(db),
      ...sqliteIdentitySections(db),
      ...sqlChannels(db),
      ...sqliteMessages(db),
      ...sqlReactions(db),
      ...sqliteAgentSessionSections(db),
      ...sqliteCommands(db),
    };
    return { db, storage };
  });
}

export { openSqliteStorage, type SqliteOpening };
