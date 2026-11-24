import type { FileSystem, Scope } from "effect";
import { Effect } from "effect";
import type { FullStorage } from "./memory-store.ts";
import type { SqliteOpening } from "./sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { openSqliteStorage } from "./sqlite.ts";
import { sqliteDeactivationOffers } from "./deactivation-offers-sqlite.ts";
import { sqliteNudges } from "./nudges-sqlite.ts";
import { withActivity } from "./activity.ts";

function openSqliteStore(
  opening: SqliteOpening,
): Effect.Effect<FullStorage, StorageUnavailable, FileSystem.FileSystem | Scope.Scope> {
  return Effect.gen(function* openStore() {
    const { db, storage } = yield* openSqliteStorage(opening);
    const nudges = yield* sqliteNudges({ db, sources: storage });
    const offers = yield* sqliteDeactivationOffers({ db, sources: storage });
    return withActivity({ record: offers.recordActivity, store: { ...storage, ...nudges, ...offers } });
  });
}

export { openSqliteStore };
