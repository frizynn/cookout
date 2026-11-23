import type { Call, FailureReplyNeeds } from "./failure-reply.ts";
import type { CallId, CommandName } from "../../index.ts";
import { Config, Context, DateTime, Duration, Effect, FiberSet, Layer, Schedule, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { webhookRetryDelaySeconds, webhookRetryFactor, webhookTimeoutSeconds } from "../../../config/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import { failureReply } from "./failure-reply.ts";
import { isoTimeOf } from "../../../time/server.ts";

interface WebhookBody {
  readonly channel: Call["channel"];
  readonly command: CommandName;
  readonly data: Call["data"];
  readonly threadId: Call["threadId"];
  readonly token: Token;
  readonly callId: CallId;
}

interface DeliveriesService {
  readonly deliver: (call: Call) => Effect.Effect<void, StorageUnavailable, FailureReplyNeeds>;
}

const SIGNATURE_HEADER = "cookout-signature";
const RETRIES = 5;
const COMMAND_TOKEN_LIFETIME: Duration.Input = "24 hours";
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
  return {
    callId,
    channel: call.channel,
    command: call.stored.command.name,
    data: call.data,
    threadId: call.threadId,
    token,
  };
}

const deliveriesLayer: Layer.Layer<Deliveries, Config.ConfigError, Secrets | Storage> = Layer.effect(
  Deliveries,
  Effect.gen(function* startDeliveries() {
    const timeout = yield* Config.map(webhookTimeoutSeconds, Duration.seconds);
    const schedule = yield* backoff;
    const { secrets, storage } = yield* Effect.all({ secrets: Secrets, storage: Storage }, { concurrency: 1 });
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

    function deliver(call: Call): Effect.Effect<void, StorageUnavailable, FailureReplyNeeds> {
      return Effect.gen(function* startDelivery() {
        const needs = yield* Effect.context<FailureReplyNeeds>();
        const token = yield* secrets.newCommandToken;
        const now = yield* DateTime.now;
        yield* storage.addCommandToken({
          expiresAt: isoTimeOf(DateTime.addDuration(now, COMMAND_TOKEN_LIFETIME)),
          handler: call.stored.command.handler,
          hash: yield* secrets.hashToken(token),
          threadId: call.threadId,
        });
        const callId = yield* secrets.newCallId;
        yield* FiberSet.run(running, Effect.provideContext(send(call, token, callId), needs));
      });
    }

    return Deliveries.of({ deliver });
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

export { Deliveries, deliveriesLayer };
