import { Effect } from "effect";
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

function openSqliteStorage(path: string): Effect.Effect<OpenedStorage, Effect.Error<Opened>, Effect.Services<Opened>> {
  return Effect.gen(function* openStorage() {
    const db = yield* openMigrated(path);
    const storage: StorageService = { ...sqlStorage(db), ...sqliteSearch({ db, reader: sqlMessageReader(db) }) };
    return { db, storage };
  });
}

export { openSqliteStorage };
