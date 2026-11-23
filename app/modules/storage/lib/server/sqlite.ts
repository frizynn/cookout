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

function openSqliteStorage(path: string): Effect.Effect<StorageService, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const db = yield* openMigrated(path);
    return {
      ...sqliteHealth(db),
      ...sqliteIdentitySections(db),
      ...sqliteChannels(db),
      ...sqliteMessages(db),
      ...sqliteReactions(db),
      ...sqliteAgentSessionSections(db),
      ...sqliteCommands(db),
    };
  });
}

export { openSqliteStorage };
