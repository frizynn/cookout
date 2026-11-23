import { Effect } from "effect";
import type { StorageService } from "./service.ts";
import { openMigrated } from "./migrations.ts";
import { sqliteAgentSessionSections } from "./agent-join-requests-sqlite.ts";
import { sqliteChannels } from "./channels.ts";
import { sqliteCommands } from "./commands.ts";
import { sqliteHealth } from "./health.ts";
import { sqliteIdentitySections } from "./identity-sections.ts";
import { sqliteMessages } from "./messages-sqlite.ts";
import { sqliteReactions } from "./reactions-sqlite.ts";

type Opened = ReturnType<typeof openMigrated>;

interface OpenedStorage {
  readonly db: Effect.Success<Opened>;
  readonly storage: StorageService;
}

function openSqliteStorage(path: string): Effect.Effect<OpenedStorage, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const db = yield* openMigrated(path);
    const storage: StorageService = {
      ...sqliteHealth(db),
      ...sqliteIdentitySections(db),
      ...sqliteChannels(db),
      ...sqliteMessages(db),
      ...sqliteReactions(db),
      ...sqliteAgentSessionSections(db),
      ...sqliteCommands(db),
    };
    return { db, storage };
  });
}

export { openSqliteStorage };
