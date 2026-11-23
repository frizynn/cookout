import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Stream } from "effect";
import { ReadPositionEventSchema, ReadPositionMovedBackEventSchema } from "./wire.ts";
import { Inbox } from "../../../inbox/server.ts";
import { sseEvent } from "./source.ts";

const readPositionEvent = sseEvent(ReadPositionEventSchema);
const movedBackEvent = sseEvent(ReadPositionMovedBackEventSchema);

function readPositions({ caller }: StreamRequest): Connected<Inbox> {
  return Effect.gen(function* subscribeToReadPositions() {
    const inbox = yield* Inbox;
    const acked = yield* inbox.acked;
    const movedBack = yield* inbox.movedBack;
    const forward = Stream.fromSubscription(acked).pipe(
      Stream.filter(({ identity }) => identity === caller.name),
      Stream.mapEffect(({ readPosition }) => readPositionEvent({ readPosition, type: "read-position" })),
    );
    const back = Stream.fromSubscription(movedBack).pipe(
      Stream.filter(({ identity }) => identity === caller.name),
      Stream.mapEffect(({ readPosition }) => movedBackEvent({ readPosition, type: "read-position-moved-back" })),
    );
    return Stream.merge(forward, back);
  });
}

export { readPositions };
