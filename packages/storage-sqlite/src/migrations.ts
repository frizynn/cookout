import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

/**
 * Schema changes, in order. Never edit or reorder one that has shipped; add a
 * new one at the end. Migration N (1-based) brings the database to
 * `PRAGMA user_version = N`.
 */
const migrations: readonly string[] = [
  // 1: the one increasing message-ID sequence for the whole server.
  `CREATE TABLE message_id_sequence (
     only_row INTEGER PRIMARY KEY CHECK (only_row = 1),
     last_id INTEGER NOT NULL
   ) STRICT;
   INSERT INTO message_id_sequence (only_row, last_id) VALUES (1, 0);`,
];

const userVersionRow = z.object({ user_version: z.number().int().nonnegative() });

/**
 * Brings the database up to date. Runs when the adapter opens, which happens
 * at server start (never during a build), so it can reach the data volume.
 */
export function migrate(db: DatabaseSync): void {
  const { user_version: current } = userVersionRow.parse(db.prepare("PRAGMA user_version").get());
  if (current > migrations.length) {
    throw new Error(
      `The database is at schema version ${current}, newer than this cookout (${migrations.length}). Upgrade cookout.`,
    );
  }
  for (let version = current + 1; version <= migrations.length; version++) {
    const sql = migrations[version - 1];
    if (sql === undefined) throw new Error(`Missing migration ${version}.`);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
