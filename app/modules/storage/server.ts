/**
 * The cookout's storage: one `Storage` service, so operations that must be
 * atomic stay one method each, and two Layers that pass the same contract
 * suite. Every method fails with `StorageUnavailable` when the store can't be used.
 */
import { Context, Layer } from "effect";
import { StorageUnavailable } from "./lib/server/errors.ts";
import { openMemoryStorage } from "./lib/server/memory.ts";
import type { StorageService } from "./lib/server/service.ts";
import { openSqliteStorage } from "./lib/server/sqlite.ts";

export { StorageUnavailable };
export type { TokenLookup } from "./lib/server/identities.ts";
export type { NewMessage } from "./lib/server/messages.ts";

export class Storage extends Context.Service<Storage, StorageService>()("cookout/storage/Storage") {}

/** Opens and migrates the SQLite file at `path`, and closes it when the Layer is released. */
export const sqliteStorage = (path: string): Layer.Layer<Storage, StorageUnavailable> =>
  Layer.effect(Storage, openSqliteStorage(path));

/** A store held in this process only. Everything is lost when the Layer is released. */
export const memoryStorage: Layer.Layer<Storage> = Layer.effect(Storage, openMemoryStorage);
