import type { SearchSection } from "./search.ts";
import type { SqlDatabase } from "./adapters/sql-database.ts";
import type { StorageService } from "./service.ts";
import { sqlAgentSessionSections } from "./agent-join-requests-sqlite.ts";
import { sqlCommands } from "./commands.ts";
import { sqlHealth } from "./health.ts";
import { sqlIdentitySections } from "./identity-sections.ts";
import { sqlMessageSections } from "./sql-message-sections.ts";
import { sqlScheduledMessages } from "./scheduled-messages-sqlite.ts";

type SqlStorage = Omit<StorageService, keyof SearchSection>;

function sqlStorage(db: SqlDatabase): SqlStorage {
  return {
    ...sqlHealth(db),
    ...sqlIdentitySections(db),
    ...sqlMessageSections(db),
    ...sqlAgentSessionSections(db),
    ...sqlCommands(db),
    ...sqlScheduledMessages(db),
  };
}

export { sqlStorage };
