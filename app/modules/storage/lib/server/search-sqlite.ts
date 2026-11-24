import { Array as Arr, Effect, Predicate, Schema } from "effect";
import type { ParsedQuery, SearchResult } from "../../../search/index.ts";
import type { SearchCursor, SearchPageRequest, SearchSection, StoredSearchPage } from "./search.ts";
import type { MessageReader } from "./inbox-sqlite.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

const SEARCH_MIGRATION = `CREATE VIRTUAL TABLE message_search USING fts5(
     text, content = 'messages', content_rowid = 'id', tokenize = 'unicode61 remove_diacritics 2'
   );
   CREATE TRIGGER message_search_insert AFTER INSERT ON messages BEGIN
     INSERT INTO message_search (rowid, text) VALUES (new.id, new.text);
   END;
   CREATE TRIGGER message_search_delete AFTER DELETE ON messages BEGIN
     INSERT INTO message_search (message_search, rowid, text) VALUES ('delete', old.id, old.text);
   END;
   CREATE TRIGGER message_search_update AFTER UPDATE OF text ON messages BEGIN
     INSERT INTO message_search (message_search, rowid, text) VALUES ('delete', old.id, old.text);
     INSERT INTO message_search (rowid, text) VALUES (new.id, new.text);
   END;
   INSERT INTO message_search (message_search) VALUES ('rebuild');`;

const ONE_MORE = 1;
const AFTER_EVERY_TIME = "~";
const AFTER_EVERY_ID = Number.MAX_SAFE_INTEGER;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const WORD_SEPARATOR = " ";
const OPEN = 0;
const CLOSED = 1;
const EVERY_MESSAGE = "";
const MATCHING_WORDS = "id IN (SELECT rowid FROM message_search WHERE message_search MATCH ?) AND";

const ClosedRow = Schema.Struct({ thread_closed: Schema.Literals([OPEN, CLOSED]) });

interface SearchOptions {
  readonly db: SqliteDatabase;
  readonly reader: MessageReader;
}

interface SearchSql {
  readonly columns: string;
  readonly matching: string;
}

function searchSql({ columns, matching }: SearchSql): string {
  return `SELECT ${columns},
    (SELECT thread.closed_at IS NOT NULL FROM messages AS thread
      WHERE thread.id = coalesce(messages.reply_to, messages.id)) AS thread_closed
  FROM messages
  WHERE ${matching} (created_at, id) < (?, ?)
  ORDER BY created_at DESC, id DESC LIMIT ?`;
}

function sqlFor(reader: MessageReader, { words }: ParsedQuery): string {
  if (Arr.isReadonlyArrayEmpty(words)) {
    return searchSql({ columns: reader.columns, matching: EVERY_MESSAGE });
  }
  return searchSql({ columns: reader.columns, matching: MATCHING_WORDS });
}

function matchOf({ words }: ParsedQuery): readonly string[] {
  if (Arr.isReadonlyArrayEmpty(words)) {
    return [];
  }
  return [
    Arr.join(
      Arr.map(words, (word) => `"${word}"*`),
      WORD_SEPARATOR,
    ),
  ];
}

function startOf(after: SearchCursor | undefined): readonly [string, number] {
  if (Predicate.isUndefined(after)) {
    return [AFTER_EVERY_TIME, AFTER_EVERY_ID];
  }
  return [after.createdAt, after.id];
}

function resultOf(reader: MessageReader): (row: unknown) => Fails<SearchResult> {
  return (row) =>
    Effect.gen(function* readResult() {
      const message = yield* reader.toMessage(row);
      const { thread_closed: closed } = yield* Schema.decodeUnknownEffect(ClosedRow)(row).pipe(
        Effect.mapError(unreadable),
      );
      return { message, threadClosed: closed === CLOSED };
    });
}

interface Searching extends SearchOptions {
  readonly query: ParsedQuery;
  readonly page: SearchPageRequest;
}

function searchPage({ db, page, query, reader }: Searching): Fails<StoredSearchPage> {
  return db.all(sqlFor(reader, query), ...matchOf(query), ...startOf(page.after), page.limit + ONE_MORE).pipe(
    Effect.flatMap((rows) => Effect.forEach(rows, resultOf(reader), ONE_AT_A_TIME)),
    Effect.map((results: readonly SearchResult[]) => ({
      hasMore: results.length > page.limit,
      results: Arr.take(results, page.limit),
    })),
  );
}

function sqliteSearch({ db, reader }: SearchOptions): SearchSection {
  return { searchMessages: (query, page) => searchPage({ db, page, query, reader }) };
}

export { SEARCH_MIGRATION, sqliteSearch };
