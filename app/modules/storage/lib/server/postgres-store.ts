import type { Redacted, Scope } from "effect";
import { Effect } from "effect";
import type { FullStorage } from "./memory-store.ts";
import { StorageUnavailable } from "./errors.ts";
import { migratePostgres } from "./postgres-migrations.ts";
import { openPostgres } from "./adapters/postgres.ts";
import { sqlStorage } from "./sql-storage.ts";
import { sqlStore } from "./sql-store.ts";

const notOnPostgresYet = StorageUnavailable.make({ message: "This part of the store is not on Postgres yet." });

function notYet(): Effect.Effect<never, StorageUnavailable> {
  return Effect.fail(notOnPostgresYet);
}

function openPostgresStore(url: Redacted.Redacted): Effect.Effect<FullStorage, StorageUnavailable, Scope.Scope> {
  return Effect.gen(function* openStore() {
    const db = yield* openPostgres(url);
    yield* migratePostgres(db);
    return yield* sqlStore({ db, storage: { ...sqlStorage(db), searchMessages: notYet } });
  });
}

export { openPostgresStore };
