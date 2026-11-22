import { it } from "@effect/vitest";
import { Effect } from "effect";
import { freshDatabasePath, openStore } from "../../testing/server.ts";
import { sqliteStorage } from "../server.ts";

it.effect("an existing database opens again without losing its data", () =>
  Effect.gen(function* () {
    const path = yield* freshDatabasePath;
    for (const _ of [1, 2, 3]) {
      const { storage, close } = yield* openStore(sqliteStorage(path));
      yield* storage.checkHealth();
      yield* close;
    }
    const { storage } = yield* openStore(sqliteStorage(path));
    yield* storage.checkHealth();
  }),
);
