import { Context, Effect, Layer } from "effect";
import type { FileSystem, Path, Scope } from "effect";
import { freshDatabasePath, pausedMidRunStorage, unusableStorage } from "./storage.ts";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import type { Storage } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import type { WebhookFake } from "../../../webhook-fake/server.ts";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { secretsOf } from "./secrets.ts";
import { webhookFake } from "../../../webhook-fake/server.ts";

type StorageKind = "memory" | "unusable" | "sqlite" | "paused-mid-run";

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
    return Effect.map(freshDatabasePath, (path) => sqliteStorage(path).pipe(Layer.provide(nodeServices), Layer.orDie));
  }
  if (kind === "unusable") {
    return sharedStore(unusableStorage);
  }
  if (kind === "paused-mid-run") {
    return sharedStore(pausedMidRunStorage);
  }
  return sharedStore(memoryStorage);
}

function storageFor(options: BackingOptions): Effect.Effect<Layer.Layer<Storage>, never, Scope.Scope> {
  return Effect.flatMap(Layer.build(nodeServices), (node) => Effect.provideContext(storageOf(options.storage), node));
}

function backingServices(options: BackingOptions): Layer.Layer<Secrets | WebhookFake> {
  return Layer.mergeAll(secretsOf(options.secrets ?? "test"), webhookFake);
}

function newToken(store: Context.Context<Secrets>): Effect.Effect<Token> {
  return Context.get(store, Secrets).newToken;
}

export { type StorageKind, backingServices, newToken, storageFor };
