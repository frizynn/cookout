import type { AckAllRequest, AckAllResponse, AckResponse, OfflineAlert, ReadPosition } from "../../index.ts";
import type { AckedMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import { DateTime, Effect, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { PubSub, Scope } from "effect";
import type { MessageId } from "../../../messages/index.ts";
import type { OfflineAlerts } from "./offline-alerts.ts";
import type { ReadReceipts } from "../../../messages/server.ts";
import type { Refusal } from "../../../http/index.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { messageNotFound } from "../../../messages/server.ts";
import { seenUpTo } from "./reaction-items.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface Acked {
  readonly identity: IdentityName;
  readonly readPosition: ReadPosition;
}

interface Hub<Value> {
  readonly publish: (value: Value) => Effect.Effect<boolean>;
  readonly subscribe: Effect.Effect<PubSub.Subscription<Value>, never, Scope.Scope>;
}

interface AckHubs {
  readonly acked: Hub<Acked>;
  readonly readReceipts: ReadReceipts["Service"];
  readonly offlineAlerts: OfflineAlerts["Service"];
}

interface AckCalls {
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly ackAll: (caller: Identity, request: AckAllRequest) => Fails<AckAllResponse>;
}

const NO_POSITIONS: readonly ReadPosition[] = [];
const NO_ALERTS: readonly OfflineAlert[] = [];

function orMessageNotFound<Value>(asked: string): (value: Value | undefined) => Fails<Value> {
  return (value) => {
    if (Predicate.isUndefined(value)) {
      return Effect.fail(messageNotFound(asked));
    }
    return Effect.succeed(value);
  };
}

interface AcksOn {
  readonly storage: Storage["Service"];
  readonly hubs: AckHubs;
}

function inboxAckedUpTo({ hubs, storage }: AcksOn, caller: Identity, upTo: MessageId): Fails<readonly ReadPosition[]> {
  return Effect.gen(function* ackInbox() {
    const now = yield* DateTime.now;
    const { readPositions, receipts } = yield* storage.ackInbox(caller.name, upTo, isoTimeOf(now));
    yield* seenUpTo({ author: caller.name, storage, upTo });
    yield* Effect.forEach(
      readPositions,
      (readPosition) => hubs.acked.publish({ identity: caller.name, readPosition }),
      {
        concurrency: 1,
        discard: true,
      },
    );
    yield* hubs.readReceipts.publish(receipts);
    return readPositions;
  });
}

function acksOn(on: AcksOn): AckCalls {
  const { hubs, storage } = on;
  const { acked: hub, readReceipts } = hubs;
  return {
    ack: (caller, id) =>
      Effect.gen(function* ackMessage() {
        const now = yield* DateTime.now;
        const acked = yield* storage.ackMessage(caller.name, id, isoTimeOf(now));
        const { readPosition, receipts } = yield* orMessageNotFound<AckedMessage>(String(id))(acked);
        yield* hub.publish({ identity: caller.name, readPosition });
        yield* readReceipts.publish(receipts);
        return { readPosition };
      }),
    ackAll: (caller, { alertsUpTo, nudgesUpTo, upTo }) =>
      Effect.gen(function* ackInboxAndAlerts() {
        let readPositions = NO_POSITIONS;
        let alerts = NO_ALERTS;
        if (Predicate.isNotUndefined(nudgesUpTo)) {
          yield* storage.markNudgesReadUpTo(caller.name, nudgesUpTo);
        }
        if (Predicate.isNotUndefined(upTo)) {
          readPositions = yield* inboxAckedUpTo(on, caller, upTo);
        }
        if (Predicate.isNotUndefined(alertsUpTo)) {
          alerts = yield* hubs.offlineAlerts.markAllRead(caller, alertsUpTo);
        }
        return { alerts, readPositions };
      }),
  };
}

export { type Acked, type Fails, type Hub, acksOn, orMessageNotFound };
