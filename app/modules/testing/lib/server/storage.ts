import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Path, Scope } from "effect";
import { memoryStorage, sqliteStorage, Storage, StorageUnavailable } from "../../../storage/server.ts";

export const freshDatabasePath = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = yield* fs.makeTempDirectoryScoped({ prefix: "cookout-sqlite-" });
  return path.join(folder, "cookout.db");
}).pipe(Effect.orDie, Effect.provide(NodeServices.layer));

const freshSqliteStorage: Layer.Layer<Storage, StorageUnavailable> = Layer.unwrap(
  Effect.map(freshDatabasePath, sqliteStorage),
);

export const storageLayers = { memory: memoryStorage, sqlite: freshSqliteStorage };

export const unusableStorage: Layer.Layer<Storage> = Layer.effect(
  Storage,
  Effect.map(Storage, (storage) => ({
    ...storage,
    checkHealth: () => Effect.fail(new StorageUnavailable({ message: "The test made this store unusable." })),
  })),
).pipe(Layer.provide(memoryStorage));

export const openStore = <E>(layer: Layer.Layer<Storage, E>) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const context = yield* Layer.buildWithScope(layer, scope);
    return { storage: Context.get(context, Storage), close: Scope.close(scope, Exit.void) };
  });
