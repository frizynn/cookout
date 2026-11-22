import { Context, Effect, Exit, FileSystem, Layer, Path, Scope } from "effect";
import { Storage, StorageUnavailable, memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { NodeServices } from "@effect/platform-node";

interface StorageLayer {
  readonly adapter: "memory" | "sqlite";
  readonly layer: Layer.Layer<Storage, StorageUnavailable>;
}

interface OpenStore {
  readonly close: Effect.Effect<void>;
  readonly storage: Storage["Service"];
}

const freshDatabasePath: Effect.Effect<string, never, Scope.Scope> = Effect.gen(function* makeDatabasePath() {
  const node = yield* Layer.build(NodeServices.layer);
  const fs = Context.get(node, FileSystem.FileSystem);
  const path = Context.get(node, Path.Path);
  const folder = yield* fs.makeTempDirectoryScoped({ prefix: "cookout-sqlite-" });
  return path.join(folder, "cookout.db");
}).pipe(Effect.orDie);

const freshSqliteStorage: Layer.Layer<Storage, StorageUnavailable> = Layer.unwrap(
  Effect.map(freshDatabasePath, sqliteStorage),
);

const storageLayers: readonly StorageLayer[] = [
  { adapter: "memory", layer: memoryStorage },
  { adapter: "sqlite", layer: freshSqliteStorage },
];

const unusableStorage: Layer.Layer<Storage> = Layer.effect(
  Storage,
  Effect.map(Storage, (storage) => ({
    ...storage,
    checkHealth: (): Effect.Effect<never, StorageUnavailable> =>
      Effect.fail(StorageUnavailable.make({ message: "The test made this store unusable." })),
  })),
).pipe(Layer.provide(memoryStorage));

function openStore<Failure>(layer: Layer.Layer<Storage, Failure>): Effect.Effect<OpenStore, Failure> {
  return Effect.gen(function* buildStore() {
    const scope = yield* Scope.make();
    const context = yield* Layer.buildWithScope(layer, scope);
    return { close: Scope.close(scope, Exit.void), storage: Context.get(context, Storage) };
  });
}

export { freshDatabasePath, openStore, storageLayers, unusableStorage };
