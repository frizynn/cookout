import type { Effect } from "effect";
import type { StorageUnavailable } from "../errors.ts";

export type SqlValue = string | number | bigint | null;

export interface SqlDatabase {
  readonly get: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<unknown, StorageUnavailable>;
  readonly all: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<readonly unknown[], StorageUnavailable>;
  readonly run: (sql: string, ...params: readonly SqlValue[]) => Effect.Effect<void, StorageUnavailable>;
  readonly exec: (sql: string) => Effect.Effect<void, StorageUnavailable>;
  readonly transaction: <Value, Failure>(
    work: Effect.Effect<Value, Failure>,
  ) => Effect.Effect<Value, Failure | StorageUnavailable>;
}
