import { Effect } from "effect";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import type { MemoryState } from "./memory-state.ts";

export type HealthSection = {
  readonly checkHealth: () => Effect.Effect<void, StorageUnavailable>;
};

export const sqliteHealth = (db: SqliteDatabase): HealthSection => ({
  checkHealth: () => Effect.asVoid(db.get("SELECT 1 AS ok")),
});

export const memoryHealth = (state: MemoryState): HealthSection => ({
  checkHealth: () => state.ensureOpen,
});
