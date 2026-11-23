import type { AckAllResponse, AckResponse, ReadPosition } from "../../index.ts";
import type { AckedMessage, Storage, StorageUnavailable } from "../../../storage/server.ts";
import { DateTime, Effect, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { PubSub, Scope } from "effect";
import type { MessageId } from "../../../messages/index.ts";
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
}

interface AckCalls {
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly ackAll: (caller: Identity, upTo: MessageId) => Fails<AckAllResponse>;
}

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

function acksOn({ hubs, storage }: AcksOn): AckCalls {
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
    ackAll: (caller, upTo) =>
      Effect.gen(function* ackInbox() {
        const now = yield* DateTime.now;
        const { readPositions, receipts } = yield* storage.ackInbox(caller.name, upTo, isoTimeOf(now));
        yield* seenUpTo({ author: caller.name, storage, upTo });
        yield* Effect.forEach(readPositions, (readPosition) => hub.publish({ identity: caller.name, readPosition }), {
          concurrency: 1,
          discard: true,
        });
        yield* readReceipts.publish(receipts);
        return { readPositions };
      }),
  };
}

export { type Acked, type Fails, type Hub, acksOn, orMessageNotFound };
