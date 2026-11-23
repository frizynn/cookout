import { Array as Arr, Context, Effect, Option, Queue, Schedule, Schema, String as Str, Stream, pipe } from "effect";
import type { CookoutEvent } from "../../index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { isMessageId } from "../../../messages/index.ts";

interface SseEvent {
  readonly event: CookoutEvent["type"];
  readonly id: MessageId;
  readonly data: string;
}

interface SseComment {
  readonly comment: string;
}

type SseFrame = SseEvent | SseComment;

type Connected<Needs> = Effect.Effect<
  Stream.Stream<SseFrame, Refusal | StorageUnavailable>,
  never,
  Needs | Scope.Scope
>;

type EventSource<Needs> = (caller: Identity) => Connected<Needs>;

class LastEventId extends Context.Service<LastEventId, Option.Option<MessageId>>()(
  "@ai-hero/cookout/events/lib/server/source/LastEventId",
) {}

const HEARTBEAT_EVERY = "15 seconds";
const HEARTBEAT: SseComment = { comment: "heartbeat" };

function sseEvent<Event extends CookoutEvent>(
  schema: Schema.Codec<Event, unknown>,
): (event: Event, id: MessageId) => Effect.Effect<SseEvent> {
  const encode = Schema.encodeEffect(Schema.fromJsonString(schema));
  return (event, id) => Effect.map(Effect.orDie(encode(event)), (data) => ({ data, event: event.type, id }));
}

function sseText(frame: SseFrame): string {
  if ("comment" in frame) {
    return `: ${frame.comment}\n\n`;
  }
  const { data, event, id } = frame;
  const dataLines = pipe(
    Str.split(data, "\n"),
    Arr.map((line) => `data: ${line}\n`),
    Arr.join(""),
  );
  return `event: ${event}\nid: ${String(id)}\n${dataLines}\n`;
}

function lastEventIdIn(sent: string | undefined): Option.Option<MessageId> {
  return Option.liftPredicate(Number(sent ?? ""), isMessageId);
}

function heartbeat(): Connected<never> {
  return Effect.gen(function* startHeartbeat() {
    const beats = yield* Queue.unbounded<SseComment>();
    yield* Stream.fromSchedule(Schedule.spaced(HEARTBEAT_EVERY)).pipe(
      Stream.runForEach(() => Queue.offer(beats, HEARTBEAT)),
      Effect.forkScoped,
    );
    return Stream.fromQueue(beats);
  });
}

export { type Connected, type EventSource, LastEventId, heartbeat, lastEventIdIn, sseEvent, sseText };
