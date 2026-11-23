import type { Appended, Hub } from "./service.ts";
import { Effect, Layer, PubSub, Semaphore } from "effect";
import { Messages, ONE_AT_A_TIME, messagesOn } from "./service.ts";
import type { Message } from "../../index.ts";
import { Reactions } from "./reactions.ts";
import { ReadReceipts } from "./read-receipts.ts";
import { Storage } from "../../../storage/server.ts";

export const messagesLayer: Layer.Layer<Messages, never, Storage | ReadReceipts | Reactions> = Layer.effect(
  Messages,
  Effect.gen(function* messagesOnStorage() {
    const storage = yield* Storage;
    const readReceipts = yield* ReadReceipts;
    const reactions = yield* Reactions;
    const pubSub = yield* PubSub.unbounded<Message>();
    const appending = yield* Semaphore.make(ONE_AT_A_TIME);
    function publishIfAppended(result: Appended): Effect.Effect<void> {
      if (result.status !== "appended") {
        return Effect.void;
      }
      return Effect.andThen(PubSub.publish(pubSub, result.message), readReceipts.publish(result.receipts));
    }
    const hub: Hub = {
      appendThenPublish: (append, message) =>
        appending.withPermits(ONE_AT_A_TIME)(Effect.tap(append(message), publishIfAppended)),
      subscribe: PubSub.subscribe(pubSub),
    };
    return messagesOn({ hub, reactions, storage });
  }),
);
