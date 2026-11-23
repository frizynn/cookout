import { Context, Layer } from "effect";
import type { Effect } from "effect";
import { Secrets } from "../../../secrets/server.ts";
import type { Storage } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import type { WebhookFake } from "../../../webhook-fake/server.ts";
import { memoryStorage } from "../../../storage/server.ts";
import { secretsOf } from "./secrets.ts";
import { unusableStorage } from "./storage.ts";
import { webhookFake } from "../../../webhook-fake/server.ts";

interface BackingOptions {
  readonly storage?: "memory" | "unusable";
  readonly secrets?: "test" | "live";
}

function storageOf(kind: BackingOptions["storage"]): Layer.Layer<Storage> {
  if (kind === "unusable") {
    return unusableStorage;
  }
  return memoryStorage;
}

function backingServices(options: BackingOptions): Layer.Layer<Storage | Secrets | WebhookFake> {
  return Layer.mergeAll(storageOf(options.storage), secretsOf(options.secrets ?? "test"), webhookFake);
}

function newToken(store: Context.Context<Secrets>): Effect.Effect<Token> {
  return Context.get(store, Secrets).newToken;
}

export { backingServices, newToken };
