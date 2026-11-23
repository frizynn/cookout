import {
  Array as Arr,
  Console,
  Effect,
  Option,
  Queue,
  Ref,
  Schedule,
  Schema,
  String as Str,
  Stream,
  pipe,
} from "effect";
import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import { Command, Flag } from "effect/cli";
import type { CookoutEvent, EventStream, InboxItemEvent, MessageId, WatchOptions } from "../../../sdk/index.ts";
import { callClient, toFailure, withClient } from "./adapters/sdk.ts";
import type { CommandFailed } from "./output.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import type { Scope } from "effect";
import { eventsPath } from "../../../events/index.ts";
import { refused } from "./output.ts";

type Format = "json" | "text";

const SHOWN_CHARACTERS = 120;
const SERVER_ERROR = 500;
const NO_STATUS = 0;
const heartbeat: readonly InboxItemEvent[] = [];
const THREE_MISSED_HEARTBEATS = "45 seconds";
const FIRST_RECONNECT_DELAY = "200 millis";
const LONGEST_RECONNECT_DELAY = "10 seconds";
const streamEnded: CallFailure = { code: "cli_error", message: "The server ended the stream." };
const heardNothing: CallFailure = { code: "cli_error", message: "Heard nothing from the server for 45 s." };
const toJsonLine = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

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

function note(value: unknown): Effect.Effect<void> {
  return toJsonLine(value).pipe(Effect.orDie, Effect.flatMap(Console.error));
}

function resumeFrom(lastSeen: Option.Option<MessageId>): WatchOptions {
  return Option.match(lastSeen, { onNone: () => ({}), onSome: (lastEventId) => ({ lastEventId }) });
}

function closeStream(events: EventStream): Effect.Effect<void> {
  return Effect.ignore(Effect.tryPromise({ catch: toFailure, try: () => events.close() }));
}

function isInboxItem(event: CookoutEvent): event is InboxItemEvent {
  return event.type === "inbox-item";
}

function heardOn(
  events: EventStream,
  heartbeats: Stream.Stream<readonly InboxItemEvent[], CallFailure>,
): Stream.Stream<readonly InboxItemEvent[], CallFailure> {
  const items = Stream.fromAsyncIterable(events, toFailure).pipe(Stream.filter(isInboxItem), Stream.map(Arr.of));
  const untilEnded = Stream.concat(items, Stream.fail(streamEnded));
  return Stream.merge(untilEnded, heartbeats, { haltStrategy: "left" }).pipe(
    Stream.timeoutOrElse({ duration: THREE_MISSED_HEARTBEATS, orElse: () => Stream.fail(heardNothing) }),
  );
}

function connect(
  opened: ClientWithLeaseState,
  lastSeen: Option.Option<MessageId>,
): Effect.Effect<Stream.Stream<readonly InboxItemEvent[], CallFailure>, CallFailure, Scope.Scope> {
  return Effect.gen(function* openConnection() {
    const heartbeats = yield* Queue.unbounded<readonly InboxItemEvent[]>();
    function onHeartbeat(): void {
      Queue.offerUnsafe(heartbeats, heartbeat);
    }
    const watching = callClient((client) => client.watch({ ...resumeFrom(lastSeen), onHeartbeat }))(opened);
    const events = yield* Effect.acquireRelease(watching, closeStream);
    return heardOn(events, Stream.fromQueue(heartbeats));
  });
}

function start(
  opened: ClientWithLeaseState,
): Effect.Effect<Stream.Stream<readonly InboxItemEvent[], CallFailure>, CallFailure, Scope.Scope> {
  return Effect.tap(connect(opened, Option.none()), () => note({ watching: `${opened.connection.url}${eventsPath}` }));
}

function isDropped({ code, status = NO_STATUS }: CallFailure): boolean {
  return code === "cli_error" || status >= SERVER_ERROR;
}

function keepTrying({ input }: { readonly input: CallFailure }): boolean {
  return isDropped(input);
}

const reconnectBackoff = Schedule.min([
  Schedule.exponential(FIRST_RECONNECT_DELAY),
  Schedule.spaced(LONGEST_RECONNECT_DELAY),
]).pipe(Schedule.jittered, Schedule.setInputType<CallFailure>(), Schedule.while(keepTrying));

function sayReconnecting(failure: CallFailure): Effect.Effect<void> {
  if (!isDropped(failure)) {
    return Effect.void;
  }
  return note({ reconnecting: failure.message });
}

function source(
  opened: ClientWithLeaseState,
  first: Stream.Stream<readonly InboxItemEvent[], CallFailure>,
): Stream.Stream<InboxItemEvent, CallFailure> {
  return Stream.unwrap(
    Effect.gen(function* resumable() {
      const unused = yield* Ref.make(Option.some(first));
      const lastSeen = yield* Ref.make(Option.none<MessageId>());
      const next = Effect.flatMap(
        Ref.getAndSet(unused, Option.none()),
        Option.match({
          onNone: () => Effect.flatMap(Ref.get(lastSeen), (seen) => connect(opened, seen)),
          onSome: Effect.succeed,
        }),
      );
      return Stream.unwrap(next).pipe(
        Stream.tapError(sayReconnecting),
        Stream.retry(reconnectBackoff),
        Stream.flattenIterable,
        Stream.tap(({ item }) => Ref.set(lastSeen, Option.some(item.message.id))),
      );
    }),
  );
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
      Effect.flatMap(start(opened), (first) =>
        Stream.runForEach(untilStopped(source(opened, first)), printEach(format)),
      ),
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
