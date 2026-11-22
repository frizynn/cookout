import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { Effect, type Scope } from "effect";
import { StorageUnavailable } from "../errors.ts";

type SqlValue = SQLInputValue;

export type SqliteDatabase = {
  readonly get: (sql: string, ...params: ReadonlyArray<SqlValue>) => Effect.Effect<unknown, StorageUnavailable>;
  readonly all: (
    sql: string,
    ...params: ReadonlyArray<SqlValue>
  ) => Effect.Effect<ReadonlyArray<unknown>, StorageUnavailable>;
  readonly run: (sql: string, ...params: ReadonlyArray<SqlValue>) => Effect.Effect<void, StorageUnavailable>;
  readonly exec: (sql: string) => Effect.Effect<void, StorageUnavailable>;
  readonly transaction: <A, E>(work: Effect.Effect<A, E>) => Effect.Effect<A, E | StorageUnavailable>;
};

const unavailable = (cause: unknown): StorageUnavailable =>
  new StorageUnavailable({ message: cause instanceof Error ? cause.message : String(cause) });

const wrap = (db: DatabaseSync): SqliteDatabase => {
  const attempt = <A>(work: () => A): Effect.Effect<A, StorageUnavailable> =>
    Effect.try({ try: work, catch: unavailable });
  const exec = (sql: string) => attempt(() => db.exec(sql));
  return {
    get: (sql, ...params) => attempt((): unknown => db.prepare(sql).get(...params)),
    all: (sql, ...params) => attempt((): ReadonlyArray<unknown> => db.prepare(sql).all(...params)),
    run: (sql, ...params) => attempt(() => void db.prepare(sql).run(...params)),
    exec,
    transaction: (work) =>
      Effect.acquireUseRelease(
        exec("BEGIN IMMEDIATE"),
        () => work,
        (_, exit) => exec(exit._tag === "Success" ? "COMMIT" : "ROLLBACK").pipe(Effect.orDie),
      ),
  };
};

export const openSqlite = (path: string): Effect.Effect<SqliteDatabase, StorageUnavailable, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(path);
        db.exec(
          "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;",
        );
        return db;
      },
      catch: unavailable,
    }),
    (db) => Effect.sync(() => (db.isOpen ? db.close() : undefined)),
  ).pipe(Effect.map(wrap));
