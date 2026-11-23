import { Array as Arr, Effect, Predicate, Schema } from "effect";
import type { Message, OpenThread, TopLevelMessage } from "../../../messages/index.ts";
import type {
  OpenThreadsCursor,
  OpenThreadsPageRequest,
  OpenThreadsSection,
  StoredOpenThreadsPage,
} from "./open-threads.ts";
import type { IdentityName } from "../../../identities/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import { MESSAGE_COLUMNS } from "./message-rows-sqlite.ts";
import type { MessageReader } from "./inbox-sqlite.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface OpenThreadsOptions {
  readonly db: SqliteDatabase;
  readonly reader: MessageReader;
}

const ONE_MORE = 1;
const ALL = 1;
const MINE = 0;
const BEFORE_EVERY_TIME = "";
const BEFORE_EVERY_ID = 0;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

const ActivityRow = Schema.Struct({ last_activity_at: IsoTimeSchema });

const OPEN_THREADS = `WITH open_threads AS (
    SELECT parent.id AS thread_id, max(
      coalesce(
        (SELECT latest.created_at FROM messages AS latest WHERE latest.reply_to = parent.id
          ORDER BY latest.id DESC LIMIT 1),
        parent.created_at
      ),
      coalesce(parent.reopened_at, '')
    ) AS last_activity_at
    FROM messages AS parent
    WHERE parent.reply_to IS NULL AND parent.closed_at IS NULL AND (? = ${String(ALL)} OR EXISTS (
      SELECT 1 FROM messages AS involved WHERE (involved.id = parent.id OR involved.reply_to = parent.id)
        AND (involved.author_name = ? OR EXISTS (SELECT 1 FROM json_each(involved.mentions) WHERE value = ?))
    ))
  )
  SELECT ${MESSAGE_COLUMNS}, last_activity_at FROM messages JOIN open_threads ON messages.id = open_threads.thread_id
  WHERE (last_activity_at, messages.id) > (?, ?)
  ORDER BY last_activity_at, messages.id LIMIT ?`;

function isTopLevel(message: Message): message is TopLevelMessage {
  return message.kind === "top-level";
}

function openThreadOf(reader: MessageReader): (row: unknown) => Fails<readonly OpenThread[]> {
  return (row) =>
    Effect.gen(function* readOpenThread() {
      const message = yield* reader.toMessage(row);
      const { last_activity_at: lastActivityAt } = yield* Schema.decodeUnknownEffect(ActivityRow)(row).pipe(
        Effect.mapError(unreadable),
      );
      return Arr.map(Arr.filter([message], isTopLevel), (parent) => ({ lastActivityAt, message: parent }));
    });
}

function scopeOf(all: boolean): number {
  if (all) {
    return ALL;
  }
  return MINE;
}

function startOf(after: OpenThreadsCursor | undefined): readonly [string, number] {
  if (Predicate.isUndefined(after)) {
    return [BEFORE_EVERY_TIME, BEFORE_EVERY_ID];
  }
  return [after.lastActivityAt, after.id];
}

interface Listing extends OpenThreadsOptions {
  readonly identity: IdentityName;
  readonly page: OpenThreadsPageRequest;
}

function openThreadsPage({ db, identity, page, reader }: Listing): Fails<StoredOpenThreadsPage> {
  const { after, all, limit } = page;
  return db.all(OPEN_THREADS, scopeOf(all), identity, identity, ...startOf(after), limit + ONE_MORE).pipe(
    Effect.flatMap((rows) => Effect.forEach(rows, openThreadOf(reader), ONE_AT_A_TIME)),
    Effect.map(Arr.flatten),
    Effect.map((threads: readonly OpenThread[]) => ({
      hasMore: threads.length > limit,
      threads: Arr.take(threads, limit),
    })),
  );
}

function sqliteOpenThreads({ db, reader }: OpenThreadsOptions): OpenThreadsSection {
  return { listOpenThreads: (identity, page) => openThreadsPage({ db, identity, page, reader }) };
}

export { sqliteOpenThreads };
