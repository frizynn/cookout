import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Stream } from "effect";
import { Inbox } from "../../../inbox/server.ts";
import { ReadPositionEventSchema } from "./wire.ts";
import { sseEvent } from "./source.ts";

const readPositionEvent = sseEvent(ReadPositionEventSchema);

function readPositions({ caller }: StreamRequest): Connected<Inbox> {
  return Effect.gen(function* subscribeToReadPositions() {
    const inbox = yield* Inbox;
    const acked = yield* inbox.acked;
    return Stream.fromSubscription(acked).pipe(
      Stream.filter(({ identity }) => identity === caller.name),
      Stream.mapEffect(({ readPosition }) => readPositionEvent({ readPosition, type: "read-position" })),
    );
  });
}

export { readPositions };
