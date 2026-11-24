import { Context, Effect, Layer } from "effect";
import type { FileSystem, Path, Scope } from "effect";
import { ScriptedTriggers, scriptedTriggers, unusedScriptedTriggers } from "./triggers.ts";
import { freshDatabasePath, unusableStorage } from "./storage.ts";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import type { Storage } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import type { TriggerCaller } from "../../../triggers/server.ts";
import type { WebhookFake } from "../../../webhook-fake/server.ts";
import { layer as nodeServices } from "@effect/platform-node/NodeServices";
import { secretsOf } from "./secrets.ts";
import { triggerCallerLive } from "../../../triggers/server.ts";
import { webhookFake } from "../../../webhook-fake/server.ts";

type StorageKind = "memory" | "unusable" | "sqlite";

interface BackingOptions {
  readonly storage?: StorageKind;
  readonly secrets?: "test" | "live";
  readonly triggers?: "receiver" | "scripted";
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
  return sharedStore(memoryStorage);
}

function storageFor(options: BackingOptions): Effect.Effect<Layer.Layer<Storage>, never, Scope.Scope> {
  return Effect.flatMap(Layer.build(nodeServices), (node) => Effect.provideContext(storageOf(options.storage), node));
}

type Backing = Secrets | WebhookFake | TriggerCaller | ScriptedTriggers;

function triggersOf(kind: BackingOptions["triggers"]): Layer.Layer<TriggerCaller | ScriptedTriggers> {
  if (kind === "scripted") {
    return scriptedTriggers;
  }
  return Layer.merge(triggerCallerLive, unusedScriptedTriggers);
}

function backingServices(options: BackingOptions): Layer.Layer<Backing> {
  return Layer.mergeAll(secretsOf(options.secrets ?? "test"), webhookFake, triggersOf(options.triggers));
}

function newToken(store: Context.Context<Secrets>): Effect.Effect<Token> {
  return Context.get(store, Secrets).newToken;
}

function scriptedTriggersIn(store: Context.Context<ScriptedTriggers>): ScriptedTriggers["Service"] {
  return Context.get(store, ScriptedTriggers);
}

export { type StorageKind, backingServices, newToken, scriptedTriggersIn, storageFor };
