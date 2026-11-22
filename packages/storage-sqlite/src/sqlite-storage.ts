import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { MessageId, StorageAdapter } from "@ai-hero/cookout-protocol";
import { messageIdSchema } from "@ai-hero/cookout-protocol";
import { migrate } from "./migrations.ts";

export type SqliteStorageOptions = {
  /** The database file. Its `-wal` and `-shm` files sit next to it. */
  path: string;
};

const nextIdRow = z.object({ last_id: messageIdSchema });
const healthRow = z.object({ ok: z.literal(1) });

/**
 * Opens (or creates) the database at `path` and brings its schema up to date.
 * Call it at server start.
 */
export function openSqliteStorage(options: SqliteStorageOptions): StorageAdapter {
  const db = new DatabaseSync(options.path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const takeNextId = db.prepare(
    "UPDATE message_id_sequence SET last_id = last_id + 1 WHERE only_row = 1 RETURNING last_id",
  );
  const selectOne = db.prepare("SELECT 1 AS ok");
  let closed = false;

  function assertOpen(): void {
    if (closed) throw new Error("The SQLite store is closed.");
  }

  return {
    async nextMessageId(): Promise<MessageId> {
      assertOpen();
      return nextIdRow.parse(takeNextId.get()).last_id;
    },
    async checkHealth(): Promise<void> {
      assertOpen();
      healthRow.parse(selectOne.get());
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
