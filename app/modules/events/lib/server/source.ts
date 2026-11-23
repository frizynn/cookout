import { Array as Arr, Effect, Schema, String as Str, pipe } from "effect";
import type { Scope, Stream } from "effect";
import type { CookoutEvent } from "../../index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";

interface SseEvent {
  readonly event: CookoutEvent["type"];
  readonly id: MessageId;
  readonly data: string;
}

type Connected<Needs> = Effect.Effect<
  Stream.Stream<SseEvent, Refusal | StorageUnavailable>,
  never,
  Needs | Scope.Scope
>;

type EventSource<Needs> = (caller: Identity) => Connected<Needs>;

function sseEvent<Event extends CookoutEvent>(
  schema: Schema.Codec<Event, unknown>,
): (event: Event, id: MessageId) => Effect.Effect<SseEvent> {
  const encode = Schema.encodeEffect(Schema.fromJsonString(schema));
  return (event, id) => Effect.map(Effect.orDie(encode(event)), (data) => ({ data, event: event.type, id }));
}

function sseText({ data, event, id }: SseEvent): string {
  const dataLines = pipe(
    Str.split(data, "\n"),
    Arr.map((line) => `data: ${line}\n`),
    Arr.join(""),
  );
  return `event: ${event}\nid: ${String(id)}\n${dataLines}\n`;
}

export { type Connected, type EventSource, sseEvent, sseText };
