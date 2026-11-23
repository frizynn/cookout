import { Array as Arr, Effect, Predicate, Schema, String as Str, pipe } from "effect";
import type { Scope, Stream } from "effect";
import type { CookoutEvent } from "../../index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { httpResponseSchemas } from "../../../http/server.ts";
import { refusalEvent } from "../../index.ts";

interface SseEvent {
  readonly event: CookoutEvent["type"] | typeof refusalEvent;
  readonly id?: MessageId;
  readonly data: string;
}

type Connected<Needs> = Effect.Effect<
  Stream.Stream<SseEvent, Refusal | StorageUnavailable>,
  never,
  Needs | Scope.Scope
>;

interface StreamRequest {
  readonly caller: Identity;
  readonly url: string;
}

type EventSource<Needs> = (request: StreamRequest) => Connected<Needs>;

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

function sseText({ data, event, id }: SseEvent): string {
  const dataLines = pipe(
    Str.split(data, "\n"),
    Arr.map((line) => `data: ${line}\n`),
    Arr.join(""),
  );
  return `event: ${event}\n${idLine(id)}${dataLines}\n`;
}

function isLast({ event }: SseEvent): boolean {
  return event === refusalEvent;
}

export { type Connected, type EventSource, isLast, refusalSseEvent, sseEvent, sseText, type StreamRequest };
