import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Identity, MessageId, StorageAdapter, TokenLookup } from "@ai-hero/cookout-protocol";
import { identitySchema, messageIdSchema } from "@ai-hero/cookout-protocol";
import { migrate } from "./migrations.ts";

export type SqliteStorageOptions = {
  /** The database file. Its `-wal` and `-shm` files sit next to it. */
  path: string;
};

const nextIdRow = z.object({ last_id: messageIdSchema });
const healthRow = z.object({ ok: z.literal(1) });
const identityRow = z
  .object({
    name: z.string(),
    owner: z.string().nullable(),
    admin: z.union([z.literal(0), z.literal(1)]),
    created_at: z.string(),
  })
  .transform((row): Identity => {
    const identity: Identity = { name: row.name, admin: row.admin === 1, createdAt: row.created_at };
    if (row.owner !== null) identity.owner = row.owner;
    return identitySchema.parse(identity);
  });
const tokenRow = z.object({ identity_name: z.string(), revoked: z.union([z.literal(0), z.literal(1)]) });
const countRow = z.object({ count: z.number().int() });

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
  const insertIdentity = db.prepare(
    "INSERT INTO identities (name, owner, admin, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (name) DO NOTHING",
  );
  const insertToken = db.prepare("INSERT INTO tokens (token_hash, identity_name, revoked) VALUES (?, ?, 0)");
  const countIdentities = db.prepare("SELECT count(*) AS count FROM identities");
  const selectIdentities = db.prepare("SELECT name, owner, admin, created_at FROM identities ORDER BY name");
  const selectIdentity = db.prepare("SELECT name, owner, admin, created_at FROM identities WHERE name = ?");
  const selectToken = db.prepare("SELECT identity_name, revoked FROM tokens WHERE token_hash = ?");
  const revokeTokens = db.prepare("UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0");
  const removeIdentity = db.prepare("DELETE FROM identities WHERE name = ?");
  let closed = false;

  function assertOpen(): void {
    if (closed) throw new Error("The SQLite store is closed.");
  }

  /** Runs `work` in one write transaction. */
  function inTransaction<T>(work: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function findIdentity(name: string): Identity | undefined {
    const row = selectIdentity.get(name);
    return row === undefined ? undefined : identityRow.parse(row);
  }

  /** Adds the identity and its token. Returns false if the name is taken. */
  function add(identity: Identity, tokenHash: string): boolean {
    const { changes } = insertIdentity.run(
      identity.name,
      identity.owner ?? null,
      identity.admin ? 1 : 0,
      identity.createdAt,
    );
    if (changes === 0) return false;
    insertToken.run(tokenHash, identity.name);
    return true;
  }

  return {
    async nextMessageId(): Promise<MessageId> {
      assertOpen();
      return nextIdRow.parse(takeNextId.get()).last_id;
    },
    async createIdentity(identity, tokenHash) {
      assertOpen();
      return inTransaction(() => (add(identity, tokenHash) ? "created" : "name_taken"));
    },
    async createIdentityIfNoneExist(identity, tokenHash) {
      assertOpen();
      return inTransaction(() => {
        if (countRow.parse(countIdentities.get()).count > 0) return false;
        return add(identity, tokenHash);
      });
    },
    async listIdentities() {
      assertOpen();
      return selectIdentities.all().map((row) => identityRow.parse(row));
    },
    async findIdentityByTokenHash(tokenHash): Promise<TokenLookup> {
      assertOpen();
      const row = selectToken.get(tokenHash);
      if (row === undefined) return { status: "unknown" };
      const token = tokenRow.parse(row);
      if (token.revoked === 1) return { status: "revoked" };
      const identity = findIdentity(token.identity_name);
      return identity === undefined ? { status: "revoked" } : { status: "active", identity };
    },
    async replaceToken(name, tokenHash) {
      assertOpen();
      return inTransaction(() => {
        const identity = findIdentity(name);
        if (identity === undefined) return undefined;
        revokeTokens.run(name);
        insertToken.run(tokenHash, name);
        return identity;
      });
    },
    async deleteIdentity(name) {
      assertOpen();
      return inTransaction(() => {
        const identity = findIdentity(name);
        if (identity === undefined) return undefined;
        revokeTokens.run(name);
        removeIdentity.run(name);
        return identity;
      });
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
