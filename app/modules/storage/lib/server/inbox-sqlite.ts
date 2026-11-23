import { Array as Arr, Effect, Option, Predicate, Schema } from "effect";
import { CHANNEL_COLUMNS, toChannel } from "./channels.ts";
import type {
  HistoryPageRequest,
  InboxSection,
  Scope,
  StoredHistoryItem,
  StoredHistoryPage,
  StoredInboxItem,
} from "./inbox.ts";
import type { InboxReason, ReadPosition } from "../../../inbox/index.ts";
import type { Message, MessageId, TopLevelMessage } from "../../../messages/index.ts";
import { followersOf, reasonsIn, scopeOf } from "./inbox.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { inboxReasons } from "../../../inbox/index.ts";
import { isMessageId } from "../../../messages/index.ts";
import { readPositionsIn } from "./read-positions-sqlite.ts";
import { threadIdOf } from "./messages.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface MessageReader {
  readonly findMessage: (id: MessageId) => Fails<Message | undefined>;
  readonly toMessage: (row: unknown) => Fails<Message>;
  readonly columns: string;
}

interface Appended {
  readonly db: SqliteDatabase;
  readonly message: Message;
}

interface Moving {
  readonly identity: IdentityName;
  readonly message: Message;
  readonly scope: Scope;
}

interface InboxOn {
  readonly db: SqliteDatabase;
  readonly reader: MessageReader;
}

interface Reasoned {
  readonly message: Message;
  readonly read: boolean;
  readonly reasons: readonly InboxReason[];
}

const ONE_AT_A_TIME = { concurrency: 1 } as const;

const MessageIdColumn = Schema.Int.pipe(Schema.refine(isMessageId));
const READ = 1;
const UNREAD = 0;
const ALL_IDS = Number.MAX_SAFE_INTEGER;
const ONE_MORE = 1;
const ReasonRow = Schema.Struct({ read: Schema.Literals([UNREAD, READ]), reason: Schema.Literals(inboxReasons) });
const PositionRow = Schema.Struct({ message_id: MessageIdColumn });
const FOUND = 1;
const NOTHING_SEEN = 0;
const isFoundRow = Schema.is(Schema.Struct({ found: Schema.Literal(FOUND) }));

const MARKER = `coalesce(CASE WHEN messages.reply_to IS NULL
    THEN (SELECT c.message_id FROM channel_read_positions AS c
      WHERE c.identity_name = ?1 AND c.channel = messages.channel)
    ELSE (SELECT t.message_id FROM thread_read_positions AS t
      WHERE t.identity_name = ?1 AND t.thread_id = messages.reply_to) END, 0)`;

const REASONS = `SELECT m.id AS id, 'followed-thread' AS reason
    FROM follows AS f JOIN messages AS m ON m.reply_to = f.thread_id WHERE f.identity_name = ?1
  UNION ALL SELECT m.id, 'mention'
    FROM message_mentions AS mm JOIN messages AS m ON m.id = mm.message_id WHERE mm.identity_name = ?1
  UNION ALL SELECT m.id, 'subscribed-channel'
    FROM subscriptions AS s JOIN messages AS m ON m.channel = s.channel AND m.reply_to IS NULL
    WHERE s.identity_name = ?1`;

const MOVE_CHANNEL_POSITION = `INSERT INTO channel_read_positions (identity_name, channel, message_id) VALUES (?, ?, ?)
  ON CONFLICT (identity_name, channel) DO UPDATE SET message_id = max(message_id, excluded.message_id)
  RETURNING message_id`;

const MOVE_THREAD_POSITION = `INSERT INTO thread_read_positions (identity_name, thread_id, message_id) VALUES (?, ?, ?)
  ON CONFLICT (identity_name, thread_id) DO UPDATE SET message_id = max(message_id, excluded.message_id)
  RETURNING message_id`;

function inboxSql(columns: string): string {
  return `WITH reasons (id, reason) AS (${REASONS})
    SELECT ${columns}, reasons.reason AS reason, ${UNREAD} AS read FROM messages JOIN reasons USING (id)
    WHERE messages.author_name <> ?1 AND messages.id > ?2 AND messages.id > ${MARKER}
    ORDER BY messages.id, reasons.reason`;
}

function historySql(columns: string): string {
  return `WITH reasons (id, reason) AS (${REASONS}),
    page (id) AS (SELECT DISTINCT reasons.id FROM reasons JOIN messages USING (id)
      WHERE messages.author_name <> ?1 AND reasons.id < ?2 ORDER BY reasons.id DESC LIMIT ?3)
    SELECT ${columns}, reasons.reason AS reason, messages.id <= ${MARKER} AS read
    FROM messages JOIN page USING (id) JOIN reasons USING (id)
    ORDER BY messages.id DESC, reasons.reason`;
}

function positionRow(row: unknown): Fails<MessageId> {
  return Schema.decodeUnknownEffect(PositionRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: (decoded) => decoded.message_id }),
  );
}

function movePosition(db: SqliteDatabase, { identity, message, scope }: Moving): Fails<unknown> {
  if (Predicate.isNull(scope.thread)) {
    return db.get(MOVE_CHANNEL_POSITION, identity, scope.channel, message.id);
  }
  return db.get(MOVE_THREAD_POSITION, identity, scope.thread, message.id);
}

function moveReadPosition(db: SqliteDatabase, identity: IdentityName, message: Message): Fails<ReadPosition> {
  const scope = scopeOf(message);
  const moved = movePosition(db, { identity, message, scope });
  return Effect.map(Effect.flatMap(moved, positionRow), (messageId) => ({ ...scope, messageId }));
}

function recordAppended({ db, message }: Appended): Fails<void> {
  return Effect.gen(function* recordMentionsAndFollows() {
    const thread = threadIdOf(message);
    yield* Effect.forEach(
      message.mentions,
      (name) =>
        db.run("INSERT OR IGNORE INTO message_mentions (identity_name, message_id) VALUES (?, ?)", name, message.id),
      ONE_AT_A_TIME,
    );
    yield* Effect.forEach(
      followersOf(message),
      (name) => db.run("INSERT OR IGNORE INTO follows (identity_name, thread_id) VALUES (?, ?)", name, thread),
      ONE_AT_A_TIME,
    );
    yield* moveReadPosition(db, message.author.name, message);
  });
}

function reasonedRow(reader: MessageReader, row: unknown): Fails<Reasoned> {
  return Effect.gen(function* readReasonedRow() {
    const message = yield* reader.toMessage(row);
    const { read, reason } = yield* Schema.decodeUnknownEffect(ReasonRow)(row).pipe(Effect.mapError(unreadable));
    return { message, read: read === READ, reasons: [reason] };
  });
}

function grouped(rows: readonly Reasoned[]): readonly Reasoned[] {
  const ids = Arr.dedupe(Arr.map(rows, (row) => row.message.id));
  return Arr.flatMap(ids, (id) => {
    const same = Arr.filter(rows, (row) => row.message.id === id);
    const reasons = reasonsIn(Arr.flatMap(same, (row) => row.reasons));
    return Option.toArray(Option.map(Arr.head(same), ({ message, read }) => ({ message, read, reasons })));
  });
}

function withParent(reader: MessageReader, { message, read, reasons }: Reasoned): Fails<StoredHistoryItem> {
  return reader.findMessage(threadIdOf(message)).pipe(
    Effect.filterOrFail(
      (parent): parent is TopLevelMessage => Predicate.isNotUndefined(parent) && parent.kind === "top-level",
      unreadable,
    ),
    Effect.map((parent): StoredHistoryItem => {
      if (message.kind === "top-level") {
        return { message: parent, parent, read, reasons };
      }
      return { message, parent, read, reasons };
    }),
  );
}

function itemsOf(reader: MessageReader, rows: readonly unknown[]): Fails<readonly StoredHistoryItem[]> {
  return Effect.gen(function* readItems() {
    const reasoned = yield* Effect.forEach(rows, (row) => reasonedRow(reader, row), ONE_AT_A_TIME);
    return yield* Effect.forEach(grouped(reasoned), (item) => withParent(reader, item), ONE_AT_A_TIME);
  });
}

function inboxOf(
  { db, reader }: InboxOn,
  identity: IdentityName,
  after: MessageId | typeof NOTHING_SEEN,
): Fails<readonly StoredInboxItem[]> {
  return db.all(inboxSql(reader.columns), identity, after).pipe(
    Effect.flatMap((rows) => itemsOf(reader, rows)),
    Effect.map(Arr.map(({ message, parent, reasons }): StoredInboxItem => ({ message, parent, reasons }))),
  );
}

function historyOf(
  { db, reader }: InboxOn,
  identity: IdentityName,
  page: HistoryPageRequest,
): Fails<StoredHistoryPage> {
  return Effect.gen(function* readHistory() {
    const rows = yield* db.all(historySql(reader.columns), identity, page.before ?? ALL_IDS, page.limit + ONE_MORE);
    const items = yield* itemsOf(reader, rows);
    return { hasMore: items.length > page.limit, items: Arr.take(items, page.limit) };
  });
}

function changeFollow(db: SqliteDatabase, reader: MessageReader, sql: string) {
  return (identity: IdentityName, id: MessageId): Fails<MessageId | undefined> =>
    db.transaction(
      Effect.flatMap(reader.findMessage(id), (message) => {
        if (Predicate.isUndefined(message)) {
          return Effect.undefined;
        }
        const thread = threadIdOf(message);
        return Effect.as(db.run(sql, identity, thread), thread);
      }),
    );
}

function changeSubscription(db: SqliteDatabase, sql: string): InboxSection["subscribeChannel"] {
  return (identity, channel) =>
    db.transaction(
      Effect.flatMap(db.get("SELECT 1 AS found FROM channels WHERE name = ?", channel), (row) => {
        if (!isFoundRow(row)) {
          return Effect.succeed(false);
        }
        return Effect.as(db.run(sql, identity, channel), true);
      }),
    );
}

const SUBSCRIBED_CHANNELS = `SELECT ${CHANNEL_COLUMNS} FROM channels
  WHERE name IN (SELECT channel FROM subscriptions WHERE identity_name = ?) ORDER BY name`;

function sqliteInbox({ db, reader }: InboxOn): InboxSection {
  return {
    ackMessage: (identity, id) =>
      db.transaction(
        Effect.flatMap(reader.findMessage(id), (message) => {
          if (Predicate.isUndefined(message)) {
            return Effect.undefined;
          }
          return moveReadPosition(db, identity, message);
        }),
      ),
    followThread: changeFollow(db, reader, "INSERT OR IGNORE INTO follows (identity_name, thread_id) VALUES (?, ?)"),
    listInbox: (identity) => inboxOf({ db, reader }, identity, NOTHING_SEEN),
    listInboxAfter: (identity, after) => inboxOf({ db, reader }, identity, after),
    listInboxHistory: (identity, page) => historyOf({ db, reader }, identity, page),
    listReadPositions: (identity) => readPositionsIn({ db, identity }),
    listSubscribedChannels: (identity) =>
      db
        .all(SUBSCRIBED_CHANNELS, identity)
        .pipe(Effect.flatMap((rows) => Effect.forEach(rows, (row) => toChannel(row), { concurrency: 1 }))),
    subscribeChannel: changeSubscription(
      db,
      "INSERT OR IGNORE INTO subscriptions (identity_name, channel) VALUES (?, ?)",
    ),
    unfollowThread: changeFollow(db, reader, "DELETE FROM follows WHERE identity_name = ? AND thread_id = ?"),
    unsubscribeChannel: changeSubscription(db, "DELETE FROM subscriptions WHERE identity_name = ? AND channel = ?"),
  };
}

const INBOX_TABLES = [
  "message_mentions",
  "follows",
  "subscriptions",
  "channel_read_positions",
  "thread_read_positions",
] as const;

export { INBOX_TABLES, type MessageReader, recordAppended, sqliteInbox };
