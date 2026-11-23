import { Effect, Schema } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { ReadPosition } from "../../../inbox/index.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isChannelName } from "../../../channels/index.ts";
import { isMessageId } from "../../../messages/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const MessageIdColumn = Schema.Int.pipe(Schema.refine(isMessageId));

const READ_POSITIONS = `SELECT channel, NULL AS thread_id, message_id FROM channel_read_positions
    WHERE identity_name = ?1
  UNION ALL SELECT messages.channel, t.thread_id, t.message_id
    FROM thread_read_positions AS t JOIN messages ON messages.id = t.thread_id WHERE t.identity_name = ?1
  ORDER BY channel, thread_id`;

const ReadPositionRow = Schema.Struct({
  channel: Schema.String.pipe(Schema.refine(isChannelName)),
  message_id: MessageIdColumn,
  thread_id: Schema.NullOr(MessageIdColumn),
});

function readPositionRow(row: unknown): Fails<ReadPosition> {
  return Schema.decodeUnknownEffect(ReadPositionRow)(row).pipe(
    Effect.mapBoth({
      onFailure: unreadable,
      onSuccess: (decoded) => ({ channel: decoded.channel, messageId: decoded.message_id, thread: decoded.thread_id }),
    }),
  );
}

interface Reading {
  readonly db: SqliteDatabase;
  readonly identity: IdentityName;
}

function readPositionsIn({ db, identity }: Reading): Fails<readonly ReadPosition[]> {
  return db
    .all(READ_POSITIONS, identity)
    .pipe(Effect.flatMap((rows) => Effect.forEach(rows, readPositionRow, ONE_AT_A_TIME)));
}

export { readPositionsIn };
