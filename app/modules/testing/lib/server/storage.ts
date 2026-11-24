import { Context, Effect, Exit, FileSystem, Layer, Path, Predicate, Scope } from "effect";
import {
  Storage,
  StorageUnavailable,
  memoryAssetStore,
  memoryStorage,
  postgresStorage,
  sqliteQueryPlans,
  sqliteStorage,
} from "../../../storage/server.ts";
import { fixtureOwnerName, identityFixture } from "./identities.ts";
import type { QueryPlan } from "../../../storage/server.ts";
import { freshPostgresDatabase } from "./postgres.ts";
import { inject } from "vitest";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { tokenHash } from "../../../identities/index.ts";

interface StorageLayer {
  readonly adapter: "memory" | "sqlite" | "postgres";
  readonly layer: Layer.Layer<Storage, StorageUnavailable>;
  readonly emptyLayer: Layer.Layer<Storage, StorageUnavailable>;
}

interface OpenStore {
  readonly close: Effect.Effect<void>;
  readonly storage: Storage["Service"];
}

const freshDatabasePath: Effect.Effect<string, never, FileSystem.FileSystem | Path.Path | Scope.Scope> = Effect.gen(
  function* makeDatabasePath() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const folder = yield* fs.makeTempDirectoryScoped({ prefix: "cookout-sqlite-" });
    return path.join(folder, "cookout.db");
  },
).pipe(Effect.orDie);

const freshSqliteStorage: Layer.Layer<Storage, StorageUnavailable> = Layer.unwrap(
  Effect.map(freshDatabasePath, sqliteStorage),
).pipe(Layer.provide(nodeServices));

function withFixtureOwner<Failure>(
  layer: Layer.Layer<Storage, Failure>,
): Layer.Layer<Storage, Failure | StorageUnavailable> {
  return Layer.tap(layer, (context) =>
    Context.get(context, Storage).createIdentity(
      identityFixture(fixtureOwnerName, { kind: "human" }),
      tokenHash("fixture-owner-token-hash"),
    ),
  );
}

const freshPostgresStorage: Layer.Layer<Storage, StorageUnavailable> = Layer.unwrap(
  Effect.map(freshPostgresDatabase, postgresStorage),
);

const postgresLayer: StorageLayer = {
  adapter: "postgres",
  emptyLayer: freshPostgresStorage,
  layer: withFixtureOwner(freshPostgresStorage),
};

function postgresLayers(): readonly StorageLayer[] {
  if (Predicate.isUndefined(inject("postgres"))) {
    return [];
  }
  return [postgresLayer];
}

const storageLayers: readonly StorageLayer[] = [
  { adapter: "memory", emptyLayer: memoryStorage, layer: withFixtureOwner(memoryStorage) },
  { adapter: "sqlite", emptyLayer: freshSqliteStorage, layer: withFixtureOwner(freshSqliteStorage) },
  ...postgresLayers(),
];

const unusableStorage: Layer.Layer<Storage> = Layer.effect(
  Storage,
  Effect.map(Storage, (storage) => ({
    ...storage,
    checkHealth: (): Effect.Effect<never, StorageUnavailable> =>
      Effect.fail(StorageUnavailable.make({ message: "The test made this store unusable." })),
  })),
).pipe(Layer.provide(memoryStorage));

function freshSqliteQueryPlans<Failure>(
  work: (storage: Storage["Service"]) => Effect.Effect<unknown, Failure>,
): Effect.Effect<readonly QueryPlan[], Failure | StorageUnavailable, FileSystem.FileSystem | Path.Path> {
  return Effect.scoped(Effect.flatMap(freshDatabasePath, (path) => sqliteQueryPlans({ path, work })));
}

function openStore<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<OpenStore, Failure, Needs> {
  return Effect.gen(function* buildStore() {
    const scope = yield* Scope.make();
    const context = yield* Layer.buildWithScope(layer, scope);
    return { close: Scope.close(scope, Exit.void), storage: Context.get(context, Storage) };
  });
}

const memoryAssets = memoryAssetStore;

export { freshDatabasePath, freshSqliteQueryPlans, memoryAssets, openStore, storageLayers, unusableStorage };
