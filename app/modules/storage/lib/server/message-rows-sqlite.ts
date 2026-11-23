import { Array as Arr, Effect, Order, Predicate, Schema } from "effect";
import type { Author, Closing, Message } from "../../../messages/index.ts";
import type { Harness, IdentityName, Owner } from "../../../identities/index.ts";
import { isHarness, isIdentityName, isOwner } from "../../../identities/index.ts";
import { isMessageId, shownRepliers } from "../../../messages/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { NewMessage } from "./messages.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isChannelName } from "../../../channels/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const MessageIdColumn = Schema.Int.pipe(Schema.refine(isMessageId));
const IdentityNameColumn = Schema.String.pipe(Schema.refine(isIdentityName));
const MentionsColumn = Schema.fromJsonString(Schema.Array(IdentityNameColumn));
const OwnerColumn = Schema.String.pipe(Schema.refine(isOwner));
const HarnessColumn = Schema.String.pipe(Schema.refine(isHarness));
const MentionsText = Schema.fromJsonString(Schema.Array(Schema.String));
const JsonText = Schema.fromJsonString(Schema.Json);
const ReplierCell = Schema.Struct({ last: Schema.Int, name: IdentityNameColumn, owner: Schema.NullOr(OwnerColumn) });
const RepliersColumn = Schema.fromJsonString(Schema.Array(ReplierCell));
const latestFirst = Order.flip(Order.mapInput(Order.Number, (cell: typeof ReplierCell.Type) => cell.last));

const MessageRow = Schema.Struct({
  author_name: IdentityNameColumn,
  author_owner: Schema.NullOr(OwnerColumn),
  channel: Schema.String.pipe(Schema.refine(isChannelName)),
  closed_at: Schema.NullOr(IsoTimeSchema),
  closed_by: Schema.NullOr(IdentityNameColumn),
  created_at: IsoTimeSchema,
  data: Schema.NullOr(Schema.String),
  harness: Schema.NullOr(HarnessColumn),
  id: MessageIdColumn,
  latest_reply_at: Schema.NullOr(IsoTimeSchema),
  latest_reply_id: Schema.NullOr(MessageIdColumn),
  mentions: MentionsColumn,
  repliers: RepliersColumn,
  reply_count: Schema.Int,
  reply_to: Schema.NullOr(MessageIdColumn),
  text: Schema.String,
});

type MessageRowType = typeof MessageRow.Type;

interface DataField {
  readonly data?: Schema.Json;
}

const NO_DATA: DataField = {};
const NO_HARNESS = {};

const MESSAGE_COLUMNS = `id, channel, author_name, author_owner, text, data, reply_to, mentions, created_at, harness,
  closed_at, closed_by,
  (SELECT count(*) FROM messages AS replies WHERE replies.reply_to = messages.id) AS reply_count,
  (SELECT max(replies.id) FROM messages AS replies WHERE replies.reply_to = messages.id) AS latest_reply_id,
  (SELECT replies.created_at FROM messages AS replies WHERE replies.reply_to = messages.id
    ORDER BY replies.id DESC LIMIT 1) AS latest_reply_at,
  (SELECT json_group_array(json_object('name', name, 'owner', owner, 'last', last)) FROM (
    SELECT replies.author_name AS name, replies.author_owner AS owner, max(replies.id) AS last
    FROM messages AS replies WHERE replies.reply_to = messages.id
    GROUP BY replies.author_name ORDER BY last DESC LIMIT ${String(shownRepliers)}
  )) AS repliers`;

interface StoredAuthor {
  readonly name: IdentityName;
  readonly owner: Owner | null;
}

function authorOf({ name, owner }: StoredAuthor): Author {
  if (Predicate.isNull(owner)) {
    return { name };
  }
  return { name, owner };
}

function repliersOf(row: MessageRowType): readonly Author[] {
  return Arr.map(Arr.sort(row.repliers, latestFirst), authorOf);
}

function harnessOf(row: MessageRowType): { readonly harness?: Harness } {
  if (Predicate.isNull(row.harness)) {
    return NO_HARNESS;
  }
  return { harness: row.harness };
}

function closingOf(row: MessageRowType): Partial<Closing> {
  if (Predicate.isNull(row.closed_at) || Predicate.isNull(row.closed_by)) {
    return {};
  }
  return { closedAt: row.closed_at, closedBy: row.closed_by };
}

function messageOf(row: MessageRowType, data: DataField): Message {
  const fields = {
    author: authorOf({ name: row.author_name, owner: row.author_owner }),
    channel: row.channel,
    createdAt: row.created_at,
    id: row.id,
  };
  const content = { ...fields, ...harnessOf(row), ...data, mentions: row.mentions, text: row.text };
  if (Predicate.isNull(row.reply_to)) {
    const replies = {
      latestReplyAt: row.latest_reply_at,
      latestReplyId: row.latest_reply_id,
      replyCount: row.reply_count,
    };
    return { ...content, ...replies, ...closingOf(row), kind: "top-level", repliers: repliersOf(row) };
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

export { MESSAGE_COLUMNS, MentionsText, MessageIdColumn, dataText, toMessage };
