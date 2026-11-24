import { appenderOf, sqlMessageReader, sqlMessages } from "./messages-sqlite.ts";
import type { CommandCallsSection } from "./command-calls.ts";
import type { MessagesSection } from "./messages.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { sqliteCommandCalls } from "./command-calls.ts";
import { sqliteSearch } from "./search-sqlite.ts";

type SqliteMessagesSection = MessagesSection & ReturnType<typeof sqlMessages> & CommandCallsSection;

function sqliteMessages(db: SqliteDatabase): SqliteMessagesSection {
  return {
    ...sqlMessages(db),
    ...sqliteSearch({ db, reader: sqlMessageReader(db) }),
    ...sqliteCommandCalls({ appendMessage: appenderOf(db), db }),
  };
}

export { sqliteMessages };
