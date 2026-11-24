import type { SqlDatabase } from "./adapters/sql-database.ts";
import { sqlChannels } from "./channels.ts";
import { sqlMessages } from "./messages-sqlite.ts";
import { sqlReactions } from "./reactions-sqlite.ts";

type SqlMessageSections = ReturnType<typeof sqlChannels> &
  ReturnType<typeof sqlMessages> &
  ReturnType<typeof sqlReactions>;

function sqlMessageSections(db: SqlDatabase): SqlMessageSections {
  return { ...sqlChannels(db), ...sqlMessages(db), ...sqlReactions(db) };
}

export { sqlMessageSections };
