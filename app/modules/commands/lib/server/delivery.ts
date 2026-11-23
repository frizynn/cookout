import type { CallId, CommandName } from "../../index.ts";
import { Context, Duration, Effect, FiberSet, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import type { JsonValue, MessageId } from "../../../messages/index.ts";
import type { Config } from "effect";
import { Secrets } from "../../../secrets/server.ts";
import type { StoredCommand } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import { webhookTimeoutSeconds } from "../../../config/server.ts";

interface WebhookBody {
  readonly command: CommandName;
  readonly data: JsonValue;
  readonly threadId: MessageId;
  readonly token: Token;
  readonly callId: CallId;
}

interface Call {
  readonly stored: StoredCommand;
  readonly data: JsonValue;
  readonly threadId: MessageId;
}

interface DeliveriesService {
  readonly deliver: (call: Call) => Effect.Effect<void>;
}

const SIGNATURE_HEADER = "cookout-signature";
const toJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

class Deliveries extends Context.Service<Deliveries, DeliveriesService>()(
  "@ai-hero/cookout/commands/lib/server/delivery/Deliveries",
) {}

function webhookBody(call: Call, token: Token, callId: CallId): WebhookBody {
  return { callId, command: call.stored.command.name, data: call.data, threadId: call.threadId, token };
}

const deliveriesLayer: Layer.Layer<Deliveries, Config.ConfigError, Secrets> = Layer.effect(
  Deliveries,
  Effect.gen(function* startDeliveries() {
    const seconds = yield* webhookTimeoutSeconds;
    const timeout = Duration.seconds(seconds);
    const secrets = yield* Secrets;
    const anyStatus = yield* HttpClient.HttpClient;
    const client = HttpClient.filterStatusOk(anyStatus);
    const running = yield* FiberSet.make();

    function send(call: Call, token: Token, callId: CallId): Effect.Effect<void> {
      return Effect.gen(function* sendWebhook() {
        const body = yield* Effect.orDie(toJson(webhookBody(call, token, callId)));
        const signature = yield* secrets.signature(call.stored.secret, body);
        const request = HttpClientRequest.post(call.stored.command.url).pipe(
          HttpClientRequest.setHeader(SIGNATURE_HEADER, signature),
          HttpClientRequest.bodyText(body, "application/json"),
        );
        yield* client
          .execute(request)
          .pipe(
            Effect.timeout(timeout),
            Effect.ignore({ log: "Warn", message: `The webhook delivery ${callId} failed.` }),
          );
      });
    }

    function deliver(call: Call): Effect.Effect<void> {
      return Effect.gen(function* startDelivery() {
        const token = yield* secrets.newCommandToken;
        const callId = yield* secrets.newCallId;
        yield* FiberSet.run(running, send(call, token, callId));
      });
    }

    return Deliveries.of({ deliver });
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

export { Deliveries, type DeliveriesService, deliveriesLayer, type WebhookBody };
