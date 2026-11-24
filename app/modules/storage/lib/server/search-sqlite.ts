import { Array as Arr, Effect, Predicate, Schema } from "effect";
import type { SearchCursor, SearchPageRequest, SearchQuery, SearchSection, StoredSearchPage } from "./search.ts";
import type { MessageReader } from "./inbox-sqlite.ts";
import type { SearchResult } from "../../../search/index.ts";
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
const MATCHING_WORDS = "id IN (SELECT rowid FROM message_search WHERE message_search MATCH ?)";
const AND = " AND ";
const LIST_SEPARATOR = ", ";
const PLACEHOLDER = "?";
const NOTHING = "";

const ClosedRow = Schema.Struct({ thread_closed: Schema.Literals([OPEN, CLOSED]) });

interface SearchOptions {
  readonly db: SqliteDatabase;
  readonly reader: MessageReader;
}

interface Condition {
  readonly sql: string;
  readonly params: readonly string[];
}

interface SearchSql {
  readonly columns: string;
  readonly conditions: readonly Condition[];
}

function searchSql({ columns, conditions }: SearchSql): string {
  const filters = Arr.join(
    Arr.map(conditions, ({ sql }) => `${sql}${AND}`),
    NOTHING,
  );
  return `SELECT ${columns},
    (SELECT thread.closed_at IS NOT NULL FROM messages AS thread
      WHERE thread.id = coalesce(messages.reply_to, messages.id)) AS thread_closed
  FROM messages
  WHERE ${filters}(created_at, id) < (?, ?)
  ORDER BY created_at DESC, id DESC LIMIT ?`;
}

function wordsCondition(words: readonly string[]): readonly Condition[] {
  if (Arr.isReadonlyArrayEmpty(words)) {
    return [];
  }
  const match = Arr.join(
    Arr.map(words, (word) => `"${word}"*`),
    WORD_SEPARATOR,
  );
  return [{ params: [match], sql: MATCHING_WORDS }];
}

interface OneOf {
  readonly column: string;
  readonly values: readonly string[];
}

function oneOfCondition({ column, values }: OneOf): readonly Condition[] {
  if (Arr.isReadonlyArrayEmpty(values)) {
    return [];
  }
  const placeholders = Arr.join(
    Arr.map(values, () => PLACEHOLDER),
    LIST_SEPARATOR,
  );
  return [{ params: values, sql: `${column} IN (${placeholders})` }];
}

function boundCondition(sql: string, bound: string | undefined): readonly Condition[] {
  if (Predicate.isUndefined(bound)) {
    return [];
  }
  return [{ params: [bound], sql }];
}

function conditionsOf(query: SearchQuery): readonly Condition[] {
  return [
    ...wordsCondition(query.words),
    ...oneOfCondition({ column: "author_name", values: query.authors }),
    ...oneOfCondition({ column: "channel", values: query.channels }),
    ...boundCondition("created_at < ?", query.createdBefore),
    ...boundCondition("created_at >= ?", query.createdSince),
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
  readonly query: SearchQuery;
  readonly page: SearchPageRequest;
}

function searchPage({ db, page, query, reader }: Searching): Fails<StoredSearchPage> {
  const conditions = conditionsOf(query);
  const params = Arr.flatMap(conditions, (condition) => condition.params);
  const sql = searchSql({ columns: reader.columns, conditions });
  return db.all(sql, ...params, ...startOf(page.after), page.limit + ONE_MORE).pipe(
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
