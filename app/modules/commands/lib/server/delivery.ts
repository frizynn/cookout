import type { Call, FailureReplyNeeds } from "./failure-reply.ts";
import type { Config, Scope } from "effect";
import { Context, DateTime, Duration, Effect, FiberSet, Layer, Ref, Schedule, Schema } from "effect";
import type { DeliveryOutcome, StorageUnavailable, StoredDelivery } from "../../../storage/server.ts";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { webhookRetryDelaySeconds, webhookRetryFactor, webhookTimeoutSeconds } from "../../../config/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { Token } from "../../../identities/index.ts";
import { failureReply } from "./failure-reply.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { messagesLayer } from "../../../messages/server.ts";

interface DeliveriesService {
  readonly deliver: (call: Call) => Effect.Effect<void, StorageUnavailable>;
}

interface Backoff {
  readonly timeoutSeconds: number;
  readonly firstDelaySeconds: number;
  readonly factor: number;
}

type Progress = Pick<StoredDelivery, "callId" | "attempts" | "nextAttemptAt">;

interface Delivery {
  readonly call: Call;
  readonly token: Token;
  readonly progress: Progress;
}

interface Settled {
  readonly callId: StoredDelivery["callId"];
  readonly outcome: DeliveryOutcome;
  readonly attempts: number;
  readonly delaySeconds: number;
}

type DeliveryNeeds = Secrets | Storage | FailureReplyNeeds | HttpClient.HttpClient;

const SIGNATURE_HEADER = "cookout-signature";
const RETRIES = 5;
const NONE = 0;
const ONE = 1;
const COMMAND_TOKEN_LIFETIME: Duration.Input = "24 hours";
const toJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

class Deliveries extends Context.Service<Deliveries, DeliveriesService>()(
  "@ai-hero/cookout/commands/lib/server/delivery/Deliveries",
) {}

const readBackoff: Effect.Effect<Backoff, Config.ConfigError> = Effect.all(
  { factor: webhookRetryFactor, firstDelaySeconds: webhookRetryDelaySeconds, timeoutSeconds: webhookTimeoutSeconds },
  { concurrency: 1 },
);

function delaySecondsAfter({ factor, firstDelaySeconds }: Backoff, failures: number): number {
  return firstDelaySeconds * factor ** (failures - ONE);
}

function untilDue(nextAttemptAt: StoredDelivery["nextAttemptAt"]): Effect.Effect<void> {
  return Effect.flatMap(DateTime.now, (now) => {
    const wait = DateTime.distance(now, DateTime.makeUnsafe(nextAttemptAt));
    return Effect.sleep(Duration.max(wait, Duration.zero));
  });
}

function record({ attempts, callId, delaySeconds, outcome }: Settled): Effect.Effect<void, never, Storage> {
  return Effect.gen(function* recordProgress() {
    const storage = yield* Storage;
    const now = yield* DateTime.now;
    const nextAttemptAt = isoTimeOf(DateTime.addDuration(now, Duration.seconds(delaySeconds)));
    yield* storage.updateDelivery(callId, { attempts, nextAttemptAt, outcome });
  }).pipe(Effect.ignore({ log: "Warn", message: `The progress of the webhook delivery ${callId} wasn't stored.` }));
}

function attempt(
  { call, token, progress: { callId } }: Delivery,
  timeoutSeconds: number,
): Effect.Effect<boolean, never, Secrets | HttpClient.HttpClient> {
  return Effect.gen(function* sendWebhook() {
    const { channel, data, threadId } = call;
    const fields = { callId, channel, command: call.stored.command.name, data, threadId, token };
    const body = yield* Effect.orDie(toJson(fields));
    const secrets = yield* Secrets;
    const signature = yield* secrets.signature(call.stored.secret, body);
    const request = HttpClientRequest.post(call.stored.command.url).pipe(
      HttpClientRequest.setHeader(SIGNATURE_HEADER, signature),
      HttpClientRequest.bodyText(body, "application/json"),
    );
    const anyStatus = yield* HttpClient.HttpClient;
    const client = HttpClient.filterStatusOk(anyStatus);
    yield* client.execute(request).pipe(Effect.timeout(Duration.seconds(timeoutSeconds)));
  }).pipe(
    Effect.matchEffect({
      onFailure: () => Effect.as(Effect.logWarning(`An attempt at the webhook delivery ${callId} failed.`), false),
      onSuccess: () => Effect.succeed(true),
    }),
  );
}

function sendDelivery(backoff: Backoff, delivery: Delivery): Effect.Effect<void, never, DeliveryNeeds> {
  const { call, progress } = delivery;
  const { attempts, callId } = progress;
  return Effect.gen(function* sendUntilSettled() {
    const failed = yield* Ref.make(attempts);
    function settle(outcome: DeliveryOutcome, extra: number): Effect.Effect<void, never, Storage> {
      return Effect.flatMap(Ref.get(failed), (failures) =>
        record({ attempts: failures + extra, callId, delaySeconds: NONE, outcome }),
      );
    }
    const countFailure = Effect.flatMap(
      Ref.updateAndGet(failed, (count) => count + ONE),
      (failures) =>
        record({ attempts: failures, callId, delaySeconds: delaySecondsAfter(backoff, failures), outcome: "pending" }),
    );
    const schedule = Schedule.exponential(Duration.seconds(delaySecondsAfter(backoff, attempts + ONE)), backoff.factor);
    yield* untilDue(progress.nextAttemptAt);
    const delivered = yield* attempt(delivery, backoff.timeoutSeconds).pipe(
      Effect.tap((succeeded) => Effect.when(countFailure, Effect.succeed(!succeeded))),
      Effect.repeat({ schedule, times: Math.max(RETRIES - attempts, NONE), until: (succeeded) => succeeded }),
    );
    if (delivered) {
      return yield* settle("delivered", ONE);
    }
    yield* failureReply({ call, retries: RETRIES });
    return yield* settle("failed", NONE);
  });
}

const newCommandToken = Effect.fnUntraced(function* issueCommandToken(
  call: Call,
): Effect.fn.Return<Token, StorageUnavailable, Secrets | Storage> {
  const secrets = yield* Secrets;
  const storage = yield* Storage;
  const token = yield* secrets.newCommandToken;
  const now = yield* DateTime.now;
  const hash = yield* secrets.hashToken(token);
  const expiresAt = isoTimeOf(DateTime.addDuration(now, COMMAND_TOKEN_LIFETIME));
  yield* storage.addCommandToken({ expiresAt, handler: call.stored.command.handler, hash, threadId: call.threadId });
  return token;
});

const storeDelivery = Effect.fnUntraced(function* addDelivery(
  call: Call,
): Effect.fn.Return<Progress, StorageUnavailable, Secrets | Storage> {
  const secrets = yield* Secrets;
  const storage = yield* Storage;
  const callId = yield* secrets.newCallId;
  const now = yield* DateTime.now;
  const progress = { attempts: NONE, callId, nextAttemptAt: isoTimeOf(now) };
  const { channel, data, threadId } = call;
  const command = call.stored.command.name;
  yield* storage.addDelivery({ ...progress, channel, command, data, outcome: "pending", threadId });
  return progress;
});

const callOf = Effect.fnUntraced(function* findCall(
  pending: StoredDelivery,
): Effect.fn.Return<Call, StorageUnavailable, Storage> {
  const storage = yield* Storage;
  const found = yield* storage.findCommand(pending.command);
  const stored = yield* Effect.orDie(Effect.fromNullishOr(found));
  return { channel: pending.channel, data: pending.data, stored, threadId: pending.threadId };
});

function deliveriesWith(
  backoff: Backoff,
): Effect.Effect<DeliveriesService, StorageUnavailable, DeliveryNeeds | Scope.Scope> {
  return Effect.gen(function* startDeliveries() {
    const running = yield* FiberSet.make();
    const runInBackground = yield* FiberSet.runtime(running)<DeliveryNeeds>();
    const services = yield* Effect.context<Secrets | Storage>();
    function sendInBackground(delivery: Delivery): Effect.Effect<void> {
      return Effect.sync(() => {
        runInBackground(sendDelivery(backoff, delivery));
      });
    }
    function resume(pending: StoredDelivery): Effect.Effect<void, StorageUnavailable, Secrets | Storage> {
      return Effect.gen(function* resumeDelivery() {
        const call = yield* callOf(pending);
        const token = yield* newCommandToken(call);
        yield* sendInBackground({ call, progress: pending, token });
      });
    }
    function deliver(call: Call): Effect.Effect<void, StorageUnavailable> {
      return Effect.gen(function* startDelivery() {
        const token = yield* newCommandToken(call);
        const progress = yield* storeDelivery(call);
        yield* sendInBackground({ call, progress, token });
      }).pipe(Effect.provideContext(services));
    }
    const storage = yield* Storage;
    const pending = yield* storage.listPendingDeliveries;
    yield* Effect.forEach(pending, resume, { concurrency: 1, discard: true });
    return Deliveries.of({ deliver });
  });
}

const deliveriesLayer: Layer.Layer<Deliveries, Config.ConfigError | StorageUnavailable, Secrets | Storage> =
  Layer.effect(Deliveries, Effect.flatMap(readBackoff, deliveriesWith)).pipe(
    Layer.provide(Layer.merge(FetchHttpClient.layer, messagesLayer)),
  );

export { Deliveries, deliveriesLayer };
