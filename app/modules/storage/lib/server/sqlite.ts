import { Effect } from "effect";
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

function openSqliteStorage(path: string): Effect.Effect<OpenedStorage, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const db = yield* openMigrated(path);
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

export { openSqliteStorage };
