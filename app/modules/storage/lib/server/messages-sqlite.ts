import type { AppendMessageResult, ChannelPageRequest, MessagesSection, NewMessage, Placement } from "./messages.ts";
import { Array as Arr, Effect, Option, Predicate, Schema, pipe } from "effect";
import type { Author, ListMessagesResponse, Message, MessageId, ThreadResponse } from "../../../messages/index.ts";
import { isIdentityName, isOwner } from "../../../identities/index.ts";
import { isPlaced, placeIn, placed, threadIdOf, withKnownMentions } from "./messages.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isChannelName } from "../../../channels/index.ts";
import { isMessageId } from "../../../messages/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const FOUND = 1;
const ONE_MORE = 1;
const ALL_IDS = Number.MAX_SAFE_INTEGER;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

const MessageIdColumn = Schema.Int.pipe(Schema.refine(isMessageId));
const IdentityNameColumn = Schema.String.pipe(Schema.refine(isIdentityName));
const MentionsColumn = Schema.fromJsonString(Schema.Array(IdentityNameColumn));
const OwnerColumn = Schema.String.pipe(Schema.refine(isOwner));
const MentionsText = Schema.fromJsonString(Schema.Array(Schema.String));
const JsonText = Schema.fromJsonString(Schema.Json);

const MessageRow = Schema.Struct({
  author_name: IdentityNameColumn,
  author_owner: Schema.NullOr(OwnerColumn),
  channel: Schema.String.pipe(Schema.refine(isChannelName)),
  created_at: IsoTimeSchema,
  data: Schema.NullOr(Schema.String),
  id: MessageIdColumn,
  latest_reply_id: Schema.NullOr(MessageIdColumn),
  mentions: MentionsColumn,
  reply_count: Schema.Int,
  reply_to: Schema.NullOr(MessageIdColumn),
  text: Schema.String,
});

type MessageRowType = typeof MessageRow.Type;

interface DataField {
  readonly data?: Schema.Json;
}

const NO_DATA: DataField = {};

const SequenceRow = Schema.Struct({ last_id: MessageIdColumn });

const isFoundRow = Schema.is(Schema.Struct({ found: Schema.Literal(FOUND) }));

const MESSAGE_COLUMNS = `id, channel, author_name, author_owner, text, data, reply_to, mentions, created_at,
  (SELECT count(*) FROM messages AS replies WHERE replies.reply_to = messages.id) AS reply_count,
  (SELECT max(replies.id) FROM messages AS replies WHERE replies.reply_to = messages.id) AS latest_reply_id`;

const INSERT_MESSAGE = `INSERT INTO messages (id, channel, author_name, author_owner, text, data, reply_to, mentions, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function authorOf(row: MessageRowType): Author {
  if (Predicate.isNull(row.author_owner)) {
    return { name: row.author_name };
  }
  return { name: row.author_name, owner: row.author_owner };
}

function messageOf(row: MessageRowType, data: DataField): Message {
  const fields = { author: authorOf(row), channel: row.channel, createdAt: row.created_at, id: row.id };
  const content = { ...fields, ...data, mentions: row.mentions, text: row.text };
  if (Predicate.isNull(row.reply_to)) {
    return { ...content, kind: "top-level", latestReplyId: row.latest_reply_id, replyCount: row.reply_count };
  }
  return { ...content, kind: "reply", replyTo: row.reply_to };
}

function dataOf(text: string | null): Fails<DataField> {
  if (Predicate.isNull(text)) {
    return Effect.succeed(NO_DATA);
  }
  return Schema.decodeEffect(JsonText)(text).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: (data): DataField => ({ data }) }),
  );
}

function toMessage(row: unknown): Fails<Message> {
  return Effect.gen(function* readMessage() {
    const decoded = yield* Schema.decodeUnknownEffect(MessageRow)(row).pipe(Effect.mapError(unreadable));
    const data = yield* dataOf(decoded.data);
    return messageOf(decoded, data);
  });
}

function dataText(message: NewMessage): Fails<string | null> {
  if (Predicate.isUndefined(message.data)) {
    return Effect.succeed(null);
  }
  return Schema.encodeEffect(JsonText)(message.data).pipe(Effect.mapError(unreadable));
}

function replyToOf(message: Message): MessageId | null {
  if (message.kind === "reply") {
    return message.replyTo;
  }
  return null;
}

function find(db: SqliteDatabase, id: MessageId): Fails<Message | undefined> {
  return db.get(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, id).pipe(
    Effect.flatMap((row) => {
      if (Predicate.isObject(row)) {
        return toMessage(row);
      }
      return Effect.undefined;
    }),
  );
}

function channelExists(db: SqliteDatabase, channel: ChannelName): Fails<boolean> {
  return db.get("SELECT 1 AS found FROM channels WHERE name = ?", channel).pipe(Effect.map(isFoundRow));
}

function takeId(db: SqliteDatabase): Fails<MessageId> {
  return db.get("UPDATE message_id_sequence SET last_id = last_id + 1 WHERE only_row = 1 RETURNING last_id").pipe(
    Effect.flatMap((row) => Schema.decodeUnknownEffect(SequenceRow)(row).pipe(Effect.mapError(unreadable))),
    Effect.map((row) => row.last_id),
  );
}

function placementOf(db: SqliteDatabase, { channel, replyTo }: NewMessage): Fails<Placement> {
  if (Predicate.isUndefined(replyTo)) {
    return Effect.succeed({ status: "top-level" });
  }
  return Effect.map(find(db, replyTo), (found) => placeIn({ channel, found }));
}

function insert(db: SqliteDatabase, message: Message, data: string | null): Fails<void> {
  return Effect.gen(function* insertMessage() {
    const mentions = yield* Schema.encodeEffect(MentionsText)(message.mentions).pipe(Effect.mapError(unreadable));
    const owner = message.author.owner ?? null;
    const replyTo = replyToOf(message);
    const { author, channel, createdAt, id, text } = message;
    yield* db.run(INSERT_MESSAGE, id, channel, author.name, owner, text, data, replyTo, mentions, createdAt);
  });
}

function knownNames(db: SqliteDatabase, names: readonly IdentityName[]): Fails<ReadonlySet<IdentityName>> {
  return pipe(
    names,
    Effect.filter((name) =>
      db.get("SELECT 1 AS found FROM identities WHERE name = ?", name).pipe(Effect.map(isFoundRow)),
    ),
    Effect.map((found: readonly IdentityName[]) => new Set(found)),
  );
}

function appendInChannel(db: SqliteDatabase, message: NewMessage): Fails<AppendMessageResult> {
  return Effect.gen(function* appendMessage() {
    const placement = yield* placementOf(db, message);
    if (!isPlaced(placement)) {
      return placement;
    }
    const data = yield* dataText(message);
    const known = yield* knownNames(db, message.mentions);
    const mentioning = withKnownMentions({ known, message });
    const id = yield* takeId(db);
    const stored = placed({ id, message: mentioning, placement });
    yield* insert(db, stored, data);
    return { message: stored, status: "appended" } as const;
  });
}

function append(db: SqliteDatabase, message: NewMessage): Fails<AppendMessageResult> {
  return Effect.gen(function* appendIfChannel() {
    const exists = yield* channelExists(db, message.channel);
    if (exists) {
      return yield* appendInChannel(db, message);
    }
    return { status: "channel_not_found" } as const;
  });
}

function threadMessages(db: SqliteDatabase, parentId: MessageId): Fails<readonly Message[]> {
  const sql = `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ? OR reply_to = ? ORDER BY id`;
  return db.all(sql, parentId, parentId).pipe(Effect.flatMap((rows) => Effect.forEach(rows, toMessage, ONE_AT_A_TIME)));
}

function threadOf(db: SqliteDatabase, id: MessageId): Fails<ThreadResponse | undefined> {
  return Effect.gen(function* getThread() {
    const found = yield* find(db, id);
    if (Predicate.isUndefined(found)) {
      return found;
    }
    const messages = yield* threadMessages(db, threadIdOf(found));
    return pipe(
      Arr.findFirst(messages, (message) => message.kind === "top-level"),
      Option.map((parent) => ({ parent, replies: Arr.filter(messages, (reply) => reply.kind === "reply") })),
      Option.getOrUndefined,
    );
  });
}

function newestRows(db: SqliteDatabase, channel: ChannelName, page: ChannelPageRequest): Fails<readonly unknown[]> {
  const sql = `SELECT ${MESSAGE_COLUMNS} FROM messages
    WHERE channel = ? AND reply_to IS NULL AND id < ? ORDER BY id DESC LIMIT ?`;
  return db.all(sql, channel, page.before ?? ALL_IDS, page.limit + ONE_MORE);
}

function pageOf(db: SqliteDatabase, channel: ChannelName, page: ChannelPageRequest): Fails<ListMessagesResponse> {
  return Effect.gen(function* readPage() {
    const rows = yield* newestRows(db, channel, page);
    const messages = yield* Effect.forEach(rows, toMessage, ONE_AT_A_TIME);
    const newest = Arr.filter(messages, (message) => message.kind === "top-level");
    const shown = Arr.reverse(Arr.take(newest, page.limit));
    return { hasMore: newest.length > page.limit, messages: shown };
  });
}

function sqliteMessages(db: SqliteDatabase): MessagesSection {
  return {
    appendMessage: (message) => db.transaction(append(db, message)),
    getThread: (id) => threadOf(db, id),
    listChannelMessages: (channel, page) =>
      Effect.flatMap(channelExists(db, channel), (exists) => {
        if (exists) {
          return pageOf(db, channel, page);
        }
        return Effect.undefined;
      }),
  };
}

export { sqliteMessages };
