import { Effect, Schema } from "effect";
import type { Scope } from "effect";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { StorageUnavailable } from "./errors.ts";
import { openSqlite } from "./adapters/sqlite.ts";

const migrations: readonly string[] = [
  `CREATE TABLE message_id_sequence (
     only_row INTEGER PRIMARY KEY CHECK (only_row = 1),
     last_id INTEGER NOT NULL
   ) STRICT;
   INSERT INTO message_id_sequence (only_row, last_id) VALUES (1, 0);`,
  `CREATE TABLE identities (
     name TEXT PRIMARY KEY,
     owner TEXT,
     admin INTEGER NOT NULL CHECK (admin IN (0, 1)),
     created_at TEXT NOT NULL
   ) STRICT;
   CREATE TABLE tokens (
     token_hash TEXT PRIMARY KEY,
     identity_name TEXT NOT NULL,
     revoked INTEGER NOT NULL CHECK (revoked IN (0, 1))
   ) STRICT;
   CREATE INDEX tokens_by_identity ON tokens (identity_name) WHERE revoked = 0;`,
  `CREATE TABLE channels (
     name TEXT PRIMARY KEY,
     description TEXT,
     created_at TEXT NOT NULL
   ) STRICT;
   CREATE TABLE messages (
     id INTEGER PRIMARY KEY,
     channel TEXT NOT NULL REFERENCES channels (name),
     author_name TEXT NOT NULL,
     author_owner TEXT,
     text TEXT NOT NULL,
     data TEXT,
     reply_to INTEGER REFERENCES messages (id),
     mentions TEXT NOT NULL,
     created_at TEXT NOT NULL
   ) STRICT;
   CREATE INDEX top_level_messages_by_channel ON messages (channel, id) WHERE reply_to IS NULL;
   CREATE INDEX replies_by_thread ON messages (reply_to, id) WHERE reply_to IS NOT NULL;`,
  `CREATE TABLE leases (
     identity_name TEXT PRIMARY KEY REFERENCES identities (name) ON DELETE CASCADE,
     lease_id TEXT NOT NULL,
     expires_at TEXT NOT NULL
   ) STRICT;`,
  `CREATE TABLE message_mentions (
     identity_name TEXT NOT NULL,
     message_id INTEGER NOT NULL REFERENCES messages (id),
     PRIMARY KEY (identity_name, message_id)
   ) STRICT, WITHOUT ROWID;
   CREATE TABLE follows (
     identity_name TEXT NOT NULL,
     thread_id INTEGER NOT NULL REFERENCES messages (id),
     PRIMARY KEY (identity_name, thread_id)
   ) STRICT, WITHOUT ROWID;
   CREATE TABLE subscriptions (
     identity_name TEXT NOT NULL,
     channel TEXT NOT NULL REFERENCES channels (name),
     PRIMARY KEY (identity_name, channel)
   ) STRICT, WITHOUT ROWID;
   CREATE TABLE channel_read_positions (
     identity_name TEXT NOT NULL,
     channel TEXT NOT NULL REFERENCES channels (name),
     message_id INTEGER NOT NULL,
     PRIMARY KEY (identity_name, channel)
   ) STRICT, WITHOUT ROWID;
   CREATE TABLE thread_read_positions (
     identity_name TEXT NOT NULL,
     thread_id INTEGER NOT NULL REFERENCES messages (id),
     message_id INTEGER NOT NULL,
     PRIMARY KEY (identity_name, thread_id)
   ) STRICT, WITHOUT ROWID;`,
  `ALTER TABLE identities ADD COLUMN kind TEXT NOT NULL DEFAULT 'agent'
     CHECK (kind IN ('human', 'agent') AND (kind = 'agent' OR owner IS NULL));
   UPDATE identities SET kind = 'human' WHERE admin = 1 AND owner IS NULL;
   CREATE TRIGGER identity_kind_never_changes BEFORE UPDATE OF kind ON identities
   BEGIN
     SELECT RAISE(ABORT, 'An identity keeps its kind.');
   END;`,
  `CREATE TABLE commands (
     name TEXT PRIMARY KEY,
     url TEXT NOT NULL,
     schema TEXT NOT NULL,
     description TEXT,
     handler_name TEXT NOT NULL,
     secret TEXT NOT NULL,
     created_at TEXT NOT NULL
   ) STRICT;`,
  `CREATE TABLE command_tokens (
     hash TEXT PRIMARY KEY,
     handler_name TEXT NOT NULL,
     thread_id INTEGER NOT NULL REFERENCES messages (id),
     expires_at TEXT NOT NULL
   ) STRICT, WITHOUT ROWID;`,
  `CREATE TABLE deliveries (
     call_id TEXT PRIMARY KEY,
     command TEXT NOT NULL REFERENCES commands (name),
     channel TEXT NOT NULL,
     thread_id INTEGER NOT NULL REFERENCES messages (id),
     data TEXT NOT NULL,
     attempts INTEGER NOT NULL CHECK (attempts >= 0),
     next_attempt_at TEXT NOT NULL,
     outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'delivered', 'failed'))
   ) STRICT;
   CREATE INDEX deliveries_pending ON deliveries (outcome) WHERE outcome = 'pending';`,
  "ALTER TABLE messages ADD COLUMN agent_tool TEXT;",
  `ALTER TABLE identities ADD COLUMN display_name TEXT;`,
];

const UserVersionRow = Schema.Struct({ user_version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)) });

const decodeUserVersion = (row: unknown) =>
  Schema.decodeUnknownEffect(UserVersionRow)(row).pipe(
    Effect.mapError(() => new StorageUnavailable({ message: "The database has no readable schema version." })),
  );

const tooNew = (current: number) =>
  new StorageUnavailable({
    message: `The database is at schema version ${current}, newer than this cookout (${migrations.length}). Upgrade cookout.`,
  });

const apply = (db: SqliteDatabase, sql: string, version: number) =>
  db.transaction(db.exec(`${sql}\nPRAGMA user_version = ${version};`));

const migrate = (db: SqliteDatabase): Effect.Effect<void, StorageUnavailable> =>
  Effect.gen(function* () {
    const { user_version: current } = yield* db.get("PRAGMA user_version").pipe(Effect.flatMap(decodeUserVersion));
    if (current > migrations.length) {
      return yield* tooNew(current);
    }
    for (const [index, sql] of migrations.entries()) {
      if (index + 1 > current) {
        yield* apply(db, sql, index + 1);
      }
    }
  });

export function openMigrated(path: string): Effect.Effect<SqliteDatabase, StorageUnavailable, Scope.Scope> {
  return Effect.tap(openSqlite(path), migrate);
}
