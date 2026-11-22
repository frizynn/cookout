import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type {
  AppendMessageResult,
  Channel,
  DeleteIdentityResult,
  Identity,
  MessageId,
  ReleaseLeaseResult,
  RenewLeaseResult,
  Reply,
  StorageAdapter,
  StoredLease,
  TakeLeaseResult,
  TokenLookup,
  TopLevelMessage,
} from "@ai-hero/cookout-protocol";
import {
  channelSchema,
  identitySchema,
  messageIdSchema,
  replySchema,
  topLevelMessageSchema,
} from "@ai-hero/cookout-protocol";
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
const channelRow = z
  .object({ name: z.string(), description: z.string().nullable(), created_at: z.string() })
  .transform((row): Channel => {
    const channel: Channel = { name: row.name, createdAt: row.created_at };
    if (row.description !== null) channel.description = row.description;
    return channelSchema.parse(channel);
  });
const leaseRow = z
  .object({ identity_name: z.string(), lease_id: z.string(), expires_at: z.iso.datetime() })
  .transform((row): StoredLease => ({ identity: row.identity_name, leaseId: row.lease_id, expiresAt: row.expires_at }));
/** Where a message sits: enough to resolve a reply's thread. */
const placeRow = z.object({ id: messageIdSchema, channel: z.string(), reply_to: messageIdSchema.nullable() });
const messageColumns = z.object({
  id: messageIdSchema,
  channel: z.string(),
  author_name: z.string(),
  author_owner: z.string().nullable(),
  text: z.string(),
  data: z.string().nullable(),
  mentions: z.string(),
  created_at: z.string(),
});

/** The fields every message has, from its row. */
function messageFields(row: z.infer<typeof messageColumns>) {
  const fields = {
    id: row.id,
    channel: row.channel,
    author: row.author_owner === null ? { name: row.author_name } : { name: row.author_name, owner: row.author_owner },
    text: row.text,
    mentions: z.array(z.string()).parse(JSON.parse(row.mentions)),
    createdAt: row.created_at,
  };
  return row.data === null ? fields : { ...fields, data: z.json().parse(JSON.parse(row.data)) };
}

const topLevelRow = messageColumns
  .extend({ reply_count: z.number().int(), latest_reply_id: messageIdSchema.nullable() })
  .transform(
    (row): TopLevelMessage =>
      topLevelMessageSchema.parse({ ...messageFields(row), replyCount: row.reply_count, latestReplyId: row.latest_reply_id }),
  );
const replyRow = messageColumns
  .extend({ reply_to: messageIdSchema })
  .transform((row): Reply => replySchema.parse({ ...messageFields(row), replyTo: row.reply_to }));

const messageSelect =
  "SELECT id, channel, author_name, author_owner, text, data, mentions, created_at, reply_to FROM messages";
const topLevelSelect = `SELECT m.id, m.channel, m.author_name, m.author_owner, m.text, m.data, m.mentions, m.created_at,
   (SELECT count(*) FROM messages r WHERE r.reply_to = m.id) AS reply_count,
   (SELECT max(r.id) FROM messages r WHERE r.reply_to = m.id) AS latest_reply_id
 FROM messages m`;

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
  const countAdmins = db.prepare("SELECT count(*) AS count FROM identities WHERE admin = 1");
  const selectIdentities = db.prepare("SELECT name, owner, admin, created_at FROM identities ORDER BY name");
  const selectIdentity = db.prepare("SELECT name, owner, admin, created_at FROM identities WHERE name = ?");
  const selectToken = db.prepare("SELECT identity_name, revoked FROM tokens WHERE token_hash = ?");
  const revokeTokens = db.prepare("UPDATE tokens SET revoked = 1 WHERE identity_name = ? AND revoked = 0");
  const removeIdentity = db.prepare("DELETE FROM identities WHERE name = ?");
  const insertChannel = db.prepare(
    "INSERT INTO channels (name, description, created_at) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING",
  );
  const selectChannels = db.prepare("SELECT name, description, created_at FROM channels ORDER BY name");
  const selectChannel = db.prepare("SELECT name, description, created_at FROM channels WHERE name = ?");
  const selectPlace = db.prepare("SELECT id, channel, reply_to FROM messages WHERE id = ?");
  const insertMessage = db.prepare(
    `INSERT INTO messages (id, channel, author_name, author_owner, text, data, reply_to, mentions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectTopLevel = db.prepare(`${topLevelSelect} WHERE m.id = ? AND m.reply_to IS NULL`);
  const selectReply = db.prepare(`${messageSelect} WHERE id = ? AND reply_to IS NOT NULL`);
  const selectReplies = db.prepare(`${messageSelect} WHERE reply_to = ? ORDER BY id`);
  const selectChannelPage = db.prepare(
    `${topLevelSelect} WHERE m.channel = ? AND m.reply_to IS NULL AND m.id < ? ORDER BY m.id DESC LIMIT ?`,
  );
  const selectLease = db.prepare("SELECT identity_name, lease_id, expires_at FROM leases WHERE identity_name = ?");
  const upsertLease = db.prepare(
    `INSERT INTO leases (identity_name, lease_id, expires_at) VALUES (?, ?, ?)
     ON CONFLICT (identity_name) DO UPDATE SET lease_id = excluded.lease_id, expires_at = excluded.expires_at`,
  );
  const deleteLease = db.prepare("DELETE FROM leases WHERE identity_name = ?");
  let closed = false;

  /** The identity's lease if it is still live at `now` (it ends at `expires_at`). */
  function liveLease(identity: string, now: string): StoredLease | undefined {
    const row = selectLease.get(identity);
    if (row === undefined) return undefined;
    const lease = leaseRow.parse(row);
    return Date.parse(lease.expiresAt) <= Date.parse(now) ? undefined : lease;
  }

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
      return inTransaction((): DeleteIdentityResult => {
        const identity = findIdentity(name);
        if (identity === undefined) return { status: "not_found" };
        if (identity.admin && countRow.parse(countAdmins.get()).count === 1) return { status: "last_admin" };
        revokeTokens.run(name);
        removeIdentity.run(name);
        return { status: "deleted", identity };
      });
    },
    async createChannel(channel) {
      assertOpen();
      const { changes } = insertChannel.run(channel.name, channel.description ?? null, channel.createdAt);
      return changes === 0 ? "name_taken" : "created";
    },
    async listChannels() {
      assertOpen();
      return selectChannels.all().map((row) => channelRow.parse(row));
    },
    async findChannel(name) {
      assertOpen();
      const row = selectChannel.get(name);
      return row === undefined ? undefined : channelRow.parse(row);
    },
    async appendMessage(message) {
      assertOpen();
      return inTransaction((): AppendMessageResult => {
        if (selectChannel.get(message.channel) === undefined) return { status: "channel_not_found" };
        let parentId: MessageId | null = null;
        if (message.replyTo !== undefined) {
          const row = selectPlace.get(message.replyTo);
          if (row === undefined) return { status: "reply_to_not_found" };
          const repliedTo = placeRow.parse(row);
          if (repliedTo.channel !== message.channel) return { status: "reply_in_other_channel" };
          parentId = repliedTo.reply_to ?? repliedTo.id;
        }
        const id = nextIdRow.parse(takeNextId.get()).last_id;
        insertMessage.run(
          id,
          message.channel,
          message.author.name,
          message.author.owner ?? null,
          message.text,
          "data" in message ? JSON.stringify(message.data) : null,
          parentId,
          JSON.stringify(message.mentions),
          message.createdAt,
        );
        const stored = parentId === null ? selectTopLevel.get(id) : selectReply.get(id);
        return {
          status: "appended",
          message: parentId === null ? topLevelRow.parse(stored) : replyRow.parse(stored),
        };
      });
    },
    async listChannelMessages(channel, page) {
      assertOpen();
      if (selectChannel.get(channel) === undefined) return undefined;
      const rows = selectChannelPage.all(channel, page.before ?? Number.MAX_SAFE_INTEGER, page.limit + 1);
      const newestFirst = rows.slice(0, page.limit).map((row) => topLevelRow.parse(row));
      return { messages: newestFirst.reverse(), hasMore: rows.length > page.limit };
    },
    async getThread(messageId) {
      assertOpen();
      const row = selectPlace.get(messageId);
      if (row === undefined) return undefined;
      const place = placeRow.parse(row);
      const parentId = place.reply_to ?? place.id;
      return {
        parent: topLevelRow.parse(selectTopLevel.get(parentId)),
        replies: selectReplies.all(parentId).map((reply) => replyRow.parse(reply)),
      };
    },
    async takeLease(request) {
      assertOpen();
      return inTransaction((): TakeLeaseResult => {
        const current = liveLease(request.identity, request.now);
        if (current !== undefined && !request.force) return { status: "held", heldUntil: current.expiresAt };
        upsertLease.run(request.identity, request.leaseId, request.expiresAt);
        return {
          status: "taken",
          lease: { identity: request.identity, leaseId: request.leaseId, expiresAt: request.expiresAt },
        };
      });
    },
    async renewLease(request) {
      assertOpen();
      return inTransaction((): RenewLeaseResult => {
        const current = liveLease(request.identity, request.now);
        if (current === undefined || current.leaseId !== request.leaseId) {
          return { status: "lost", heldUntil: current?.expiresAt ?? null };
        }
        upsertLease.run(request.identity, request.leaseId, request.expiresAt);
        return { status: "renewed", lease: { ...current, expiresAt: request.expiresAt } };
      });
    },
    async releaseLease(request) {
      assertOpen();
      return inTransaction((): ReleaseLeaseResult => {
        const current = liveLease(request.identity, request.now);
        if (current === undefined || current.leaseId !== request.leaseId) {
          return { status: "lost", heldUntil: current?.expiresAt ?? null };
        }
        deleteLease.run(request.identity);
        return { status: "released" };
      });
    },
    async findLease(identity, now) {
      assertOpen();
      return liveLease(identity, now);
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
