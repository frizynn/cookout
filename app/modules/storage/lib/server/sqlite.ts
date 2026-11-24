import { Effect, identity } from "effect";
import type { StorageService } from "./service.ts";
import { openMigrated } from "./migrations.ts";
import { sqlMessageReader } from "./messages-sqlite.ts";
import { sqlStorage } from "./sql-storage.ts";
import { sqliteSearch } from "./search-sqlite.ts";

type Opened = ReturnType<typeof openMigrated>;

interface OpenedStorage {
  readonly db: Effect.Success<Opened>;
  readonly storage: StorageService;
}

interface SqliteOpening {
  readonly path: string;
  readonly watch?: (db: Effect.Success<Opened>) => Effect.Success<Opened>;
}

function openSqliteStorage({
  path,
  watch = identity,
}: SqliteOpening): Effect.Effect<OpenedStorage, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const migrated = yield* openMigrated(path);
    const db = watch(migrated);
    const storage: StorageService = { ...sqlStorage(db), ...sqliteSearch({ db, reader: sqlMessageReader(db) }) };
    return { db, storage };
  });
}

export { openSqliteStorage, type SqliteOpening };
