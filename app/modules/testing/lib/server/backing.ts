import { Effect, Layer } from "effect";
import type { FileSystem, Path, Scope } from "effect";
import { freshDatabasePath, unusableStorage } from "./storage.ts";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { NodeServices } from "@effect/platform-node";
import type { Secrets } from "../../../secrets/server.ts";
import type { Storage } from "../../../storage/server.ts";
import type { WebhookFake } from "../../../webhook-fake/server.ts";
import { secretsOf } from "./secrets.ts";
import { webhookFake } from "../../../webhook-fake/server.ts";

type StorageKind = "memory" | "unusable" | "sqlite";

interface BackingOptions {
  readonly storage?: StorageKind;
  readonly secrets?: "test" | "live";
}

type StorageFactory = Effect.Effect<Layer.Layer<Storage>, never, FileSystem.FileSystem | Path.Path | Scope.Scope>;

function sharedStore(layer: Layer.Layer<Storage>): StorageFactory {
  return Effect.map(Layer.build(layer), (store) => Layer.succeedContext(store));
}

function storageOf(kind: StorageKind | undefined): StorageFactory {
  if (kind === "sqlite") {
    return Effect.map(freshDatabasePath, (path) =>
      sqliteStorage(path).pipe(Layer.provide(NodeServices.layer), Layer.orDie),
    );
  }
  if (kind === "unusable") {
    return sharedStore(unusableStorage);
  }
  return sharedStore(memoryStorage);
}

function storageFor(options: BackingOptions): Effect.Effect<Layer.Layer<Storage>, never, Scope.Scope> {
  return Effect.flatMap(Layer.build(NodeServices.layer), (node) =>
    Effect.provideContext(storageOf(options.storage), node),
  );
}

function backingServices(options: BackingOptions): Layer.Layer<Secrets | WebhookFake> {
  return Layer.mergeAll(secretsOf(options.secrets ?? "test"), webhookFake);
}

export { type StorageKind, backingServices, storageFor };
