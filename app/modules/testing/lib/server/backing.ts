import { Layer } from "effect";
import type { Secrets } from "../../../secrets/server.ts";
import type { Storage } from "../../../storage/server.ts";
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

export { backingServices };
