import { Effect, type Scope } from "effect";
import { openSqlite } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { sqliteHealth } from "./health.ts";
import { migrate } from "./migrations.ts";
import type { StorageService } from "./service.ts";

export const openSqliteStorage = (path: string): Effect.Effect<StorageService, StorageUnavailable, Scope.Scope> =>
  Effect.gen(function* () {
    const db = yield* openSqlite(path);
    yield* migrate(db);
    return { ...sqliteHealth(db) };
  });
