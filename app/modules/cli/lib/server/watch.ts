import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import { Command, Flag } from "effect/cli";
import { Console, Effect, Schema, String as Str, Stream, pipe } from "effect";
import type { CookoutEvent, EventStream, InboxItemEvent } from "../../../sdk/index.ts";
import { callClient, toFailure, withClient } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import type { Scope } from "effect";
import { eventsPath } from "../../../events/index.ts";
import { refused } from "./output.ts";

type Format = "json" | "text";

const SHOWN_CHARACTERS = 120;
const toJsonLine = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const openStream = callClient((client) => client.watch());

function textLine({ item: { channel, message, parent } }: InboxItemEvent): string {
  const shown = pipe(message.text, Str.replaceAll(/\s+/gu, " "), Str.takeLeft(SHOWN_CHARACTERS));
  return `#${channel.name} thread:${String(parent.id)} @${message.author.name}: ${shown} (msg ${String(message.id)})`;
}

function lineOf(format: Format, event: InboxItemEvent): Effect.Effect<string> {
  if (format === "json") {
    return Effect.orDie(toJsonLine(event));
  }
  return Effect.succeed(textLine(event));
}

function closeStream(events: EventStream): Effect.Effect<void> {
  return Effect.ignore(Effect.promise(() => events.close()));
}

function sayWatching(opened: ClientWithLeaseState): Effect.Effect<void> {
  return toJsonLine({ watching: `${opened.connection.url}${eventsPath}` }).pipe(
    Effect.orDie,
    Effect.flatMap(Console.error),
  );
}

function start(opened: ClientWithLeaseState): Effect.Effect<EventStream, CallFailure, Scope.Scope> {
  return Effect.acquireRelease(openStream(opened), closeStream).pipe(Effect.tap(() => sayWatching(opened)));
}

function isInboxItem(event: CookoutEvent): event is InboxItemEvent {
  return event.type === "inbox-item";
}

function source(events: EventStream): Stream.Stream<InboxItemEvent, CallFailure> {
  return Stream.filter(Stream.fromAsyncIterable(events, toFailure), isInboxItem);
}

function untilStopped(events: Stream.Stream<InboxItemEvent, CallFailure>): Stream.Stream<InboxItemEvent, CallFailure> {
  return events;
}

function printEach(format: Format): (event: InboxItemEvent) => Effect.Effect<void> {
  return (event) => Effect.flatMap(lineOf(format, event), Console.log);
}

function printItems(format: Format): (opened: ClientWithLeaseState) => Effect.Effect<void, CallFailure> {
  return (opened) =>
    Effect.scoped(
      Effect.flatMap(start(opened), (events) => Stream.runForEach(untilStopped(source(events)), printEach(format))),
    );
}

function watch(format: Format): Effect.Effect<void, CommandFailed, LeaseStateNeeds> {
  return Effect.matchEffect(withClient(printItems(format)), { onFailure: refused, onSuccess: () => Effect.void });
}

const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print each item as its event's JSON, one object per line, instead of a text line."),
);

function formatOf(json: boolean): Format {
  if (json) {
    return "json";
  }
  return "text";
}

export const watchCommand = Command.make("watch", { json: jsonFlag }, ({ json }) => watch(formatOf(json))).pipe(
  Command.withDescription(
    "Print one line per new inbox item as it arrives, for Claude Code's Monitor tool: " +
      "#<channel> thread:<id> @<author>: <first 120 characters> (msg <id>). Run cookout help monitor.",
  ),
);
