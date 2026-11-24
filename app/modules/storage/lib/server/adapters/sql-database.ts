import type { Effect } from "effect";
import type { StorageUnavailable } from "../errors.ts";

type SqlValue = string | number | bigint | null;

type SqlDialect = "sqlite" | "postgres";

interface SqlDatabase {
  readonly dialect: SqlDialect;
  readonly get: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<unknown, StorageUnavailable>;
  readonly all: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<readonly unknown[], StorageUnavailable>;
  readonly run: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<void, StorageUnavailable>;
  readonly exec: (sql: string) => Effect.Effect<void, StorageUnavailable>;
  readonly transaction: <Value, Failure>(
    work: Effect.Effect<Value, Failure>,
  ) => Effect.Effect<Value, Failure | StorageUnavailable>;
}

type DialectForms<Form> = Readonly<Record<SqlDialect, Form>>;

const isFalse: DialectForms<(column: string) => string> = {
  postgres: (column) => `NOT ${column}`,
  sqlite: (column) => `${column} = 0`,
};

export { type DialectForms, isFalse, type SqlDatabase, type SqlValue };
