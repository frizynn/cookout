import { Array as Arr, Effect, Option, Predicate, Queue, Schedule, Schema, String as Str, Stream, pipe } from "effect";
import type { CookoutEvent } from "../../index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { httpResponseSchemas } from "../../../http/server.ts";
import { isMessageId } from "../../../messages/index.ts";
import { refusalEvent } from "../../index.ts";

interface SseEvent {
  readonly event: CookoutEvent["type"] | typeof refusalEvent;
  readonly id?: MessageId;
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

interface StreamRequest {
  readonly caller: Identity;
  readonly lastEventId: Option.Option<MessageId>;
  readonly url: string;
}

type EventSource<Needs> = (request: StreamRequest) => Connected<Needs>;

const HEARTBEAT_EVERY = "15 seconds";
const HEARTBEAT: SseComment = { comment: "heartbeat" };

function sseEvent<Event extends CookoutEvent>(
  schema: Schema.Codec<Event, unknown>,
): (event: Event, id: MessageId) => Effect.Effect<SseEvent> {
  const encode = Schema.encodeEffect(Schema.fromJsonString(schema));
  return (event, id) => Effect.map(Effect.orDie(encode(event)), (data) => ({ data, event: event.type, id }));
}

const encodeErrorResponse = Schema.encodeEffect(Schema.fromJsonString(httpResponseSchemas.ErrorResponse));

function refusalSseEvent({ status: _status, ...error }: Refusal): Effect.Effect<SseEvent> {
  return Effect.map(Effect.orDie(encodeErrorResponse({ error })), (data) => ({ data, event: refusalEvent }));
}

function idLine(id: MessageId | undefined): string {
  if (Predicate.isUndefined(id)) {
    return "";
  }
  return `id: ${String(id)}\n`;
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
  return `event: ${event}\n${idLine(id)}${dataLines}\n`;
}

function isLast(frame: SseFrame): boolean {
  return "event" in frame && frame.event === refusalEvent;
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

export {
  type Connected,
  type EventSource,
  heartbeat,
  isLast,
  lastEventIdIn,
  refusalSseEvent,
  sseEvent,
  sseText,
  type StreamRequest,
};
