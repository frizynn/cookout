import type { FileSystem, Scope } from "effect";
import { Effect } from "effect";
import type { FullStorage } from "./memory-store.ts";
import type { StorageUnavailable } from "./errors.ts";
import { openSqliteStorage } from "./sqlite.ts";
import { sqlStore } from "./sql-store.ts";

function openSqliteStore(
  path: string,
): Effect.Effect<FullStorage, StorageUnavailable, FileSystem.FileSystem | Scope.Scope> {
  return Effect.flatMap(openSqliteStorage(path), sqlStore);
}

export { openSqliteStore };
