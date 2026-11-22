/**
 * A fake command handler: a real HTTP server on `127.0.0.1` and a free port
 * that stands in for the webhook a command calls. `WebhookFake` gives its base
 * URL (any path is accepted) and every call so far, oldest first, with the
 * status it answered. `failNext(count, status)` answers the next `count` calls
 * with `status` (default 500), then 200 again, and `waitForCalls(count)`
 * waits until at least `count` calls have arrived. `webhookFake` is a scoped
 * Layer: the server stops, dropping open connections, when its scope closes.
 * Reachable only from tests and the dev script.
 */
import { Context, Effect, Layer } from "effect";
import type { ReceivedCall } from "./lib/server/receiver.ts";
import { receiver } from "./lib/server/receiver.ts";

type WebhookCall = ReceivedCall;

interface WebhookFakeService {
  readonly calls: Effect.Effect<readonly WebhookCall[]>;
  readonly failNext: (count: number, status?: number) => Effect.Effect<void>;
  readonly url: string;
  readonly waitForCalls: (count: number) => Effect.Effect<readonly WebhookCall[]>;
}

const SERVER_ERROR = 500;

class WebhookFake extends Context.Service<WebhookFake, WebhookFakeService>()(
  "@ai-hero/cookout/webhook-fake/server/WebhookFake",
) {}

const webhookFake: Layer.Layer<WebhookFake> = Layer.effect(
  WebhookFake,
  Effect.map(receiver, (started) =>
    WebhookFake.of({
      calls: started.calls,
      failNext: (count, status = SERVER_ERROR) => started.failNext(count, status),
      url: started.url,
      waitForCalls: started.waitForCalls,
    }),
  ),
);

export { type WebhookCall, WebhookFake, type WebhookFakeService, webhookFake };
