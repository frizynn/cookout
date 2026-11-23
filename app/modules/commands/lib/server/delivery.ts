import type { Call, FailureReplyNeeds } from "./failure-reply.ts";
import type { CallId, CommandName } from "../../index.ts";
import { Config, Context, Duration, Effect, FiberSet, Layer, Schedule, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { webhookRetryDelaySeconds, webhookRetryFactor, webhookTimeoutSeconds } from "../../../config/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import type { Token } from "../../../identities/index.ts";
import { failureReply } from "./failure-reply.ts";

interface WebhookBody {
  readonly command: CommandName;
  readonly data: Call["data"];
  readonly threadId: Call["threadId"];
  readonly token: Token;
  readonly callId: CallId;
}

interface DeliveriesService {
  readonly deliver: (call: Call) => Effect.Effect<void, never, FailureReplyNeeds>;
}

const SIGNATURE_HEADER = "cookout-signature";
const RETRIES = 5;
const toJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const backoff: Effect.Effect<Schedule.Schedule<Duration.Duration>, Config.ConfigError> = Effect.gen(
  function* readBackoff() {
    const firstDelay = yield* webhookRetryDelaySeconds;
    const factor = yield* webhookRetryFactor;
    return Schedule.exponential(Duration.seconds(firstDelay), factor);
  },
);

class Deliveries extends Context.Service<Deliveries, DeliveriesService>()(
  "@ai-hero/cookout/commands/lib/server/delivery/Deliveries",
) {}

function webhookBody(call: Call, token: Token, callId: CallId): WebhookBody {
  return { callId, command: call.stored.command.name, data: call.data, threadId: call.threadId, token };
}

const deliveriesLayer: Layer.Layer<Deliveries, Config.ConfigError, Secrets> = Layer.effect(
  Deliveries,
  Effect.gen(function* startDeliveries() {
    const timeout = yield* Config.map(webhookTimeoutSeconds, Duration.seconds);
    const schedule = yield* backoff;
    const secrets = yield* Secrets;
    const anyStatus = yield* HttpClient.HttpClient;
    const client = HttpClient.filterStatusOk(anyStatus);
    const running = yield* FiberSet.make();

    function attempt(call: Call, token: Token, callId: CallId): Effect.Effect<void, unknown> {
      return Effect.gen(function* sendWebhook() {
        const body = yield* Effect.orDie(toJson(webhookBody(call, token, callId)));
        const signature = yield* secrets.signature(call.stored.secret, body);
        const request = HttpClientRequest.post(call.stored.command.url).pipe(
          HttpClientRequest.setHeader(SIGNATURE_HEADER, signature),
          HttpClientRequest.bodyText(body, "application/json"),
        );
        yield* client.execute(request).pipe(
          Effect.timeout(timeout),
          Effect.tapError(() => Effect.logWarning(`An attempt at the webhook delivery ${callId} failed.`)),
        );
      });
    }

    function send(call: Call, token: Token, callId: CallId): Effect.Effect<void, never, FailureReplyNeeds> {
      return attempt(call, token, callId).pipe(
        Effect.retry({ schedule, times: RETRIES }),
        Effect.matchEffect({ onFailure: () => failureReply({ call, retries: RETRIES }), onSuccess: () => Effect.void }),
      );
    }

    function deliver(call: Call): Effect.Effect<void, never, FailureReplyNeeds> {
      return Effect.gen(function* startDelivery() {
        const needs = yield* Effect.context<FailureReplyNeeds>();
        const token = yield* secrets.newCommandToken;
        const callId = yield* secrets.newCallId;
        yield* FiberSet.run(running, Effect.provideContext(send(call, token, callId), needs));
      });
    }

    return Deliveries.of({ deliver });
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

export { Deliveries, deliveriesLayer };
