import { Array as Arr, Duration, Effect, Option, Queue, Ref, Schedule, Stream } from "effect";
import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import type {
  ConnectedEvent,
  CookoutEvent,
  EventStream,
  InboxItemEvent,
  MessageId,
  WatchOptions,
} from "../../../sdk/index.ts";
import { callClient, toFailure } from "./adapters/sdk.ts";
import type { Scope } from "effect";
import { eventsPath } from "../../../events/index.ts";
import { note } from "./watch-lines.ts";

type Heard = InboxItemEvent | ConnectedEvent;

const SERVER_ERROR = 500;
const NO_STATUS = 0;
const heartbeat: readonly Heard[] = [];
const THREE_MISSED_HEARTBEATS = "45 seconds";
const FIRST_RECONNECT_DELAY = "200 millis";
const LONGEST_RECONNECT_DELAY = "10 seconds";
const GIVE_UP_AFTER = Duration.toMillis("5 minutes");
const streamEnded: CallFailure = { code: "cli_error", message: "The server ended the stream." };
const heardNothing: CallFailure = { code: "cli_error", message: "Heard nothing from the server for 45 s." };

function resumeFrom(lastSeen: Option.Option<MessageId>): Pick<WatchOptions, "lastEventId"> {
  return Option.match(lastSeen, { onNone: () => ({}), onSome: (lastEventId) => ({ lastEventId }) });
}

function closeStream(events: EventStream): Effect.Effect<void> {
  return Effect.ignore(Effect.tryPromise({ catch: toFailure, try: () => events.close() }));
}

function isInboxItem(event: CookoutEvent | Heard): event is InboxItemEvent {
  return event.type === "inbox-item";
}

function heardOn(
  events: EventStream,
  signals: Stream.Stream<readonly Heard[], CallFailure>,
): Stream.Stream<readonly Heard[], CallFailure> {
  const items = Stream.fromAsyncIterable(events, toFailure).pipe(Stream.filter(isInboxItem), Stream.map(Arr.of));
  const untilEnded = Stream.concat(items, Stream.fail(streamEnded));
  return Stream.merge(untilEnded, signals, { haltStrategy: "left" }).pipe(
    Stream.timeoutOrElse({ duration: THREE_MISSED_HEARTBEATS, orElse: () => Stream.fail(heardNothing) }),
  );
}

function connect(
  opened: ClientWithLeaseState,
  lastSeen: Option.Option<MessageId>,
): Effect.Effect<Stream.Stream<readonly Heard[], CallFailure>, CallFailure, Scope.Scope> {
  return Effect.gen(function* openConnection() {
    const signals = yield* Queue.unbounded<readonly Heard[]>();
    function onHeartbeat(): void {
      Queue.offerUnsafe(signals, heartbeat);
    }
    function onConnected(latestMessageId: MessageId | null): void {
      Queue.offerUnsafe(signals, [{ latestMessageId, type: "connected" }]);
    }
    const options = { ...resumeFrom(lastSeen), onConnected, onHeartbeat };
    const watching = callClient((client) => client.watch(options))(opened);
    const events = yield* Effect.acquireRelease(watching, closeStream);
    return heardOn(events, Stream.fromQueue(signals));
  });
}

function start(
  opened: ClientWithLeaseState,
): Effect.Effect<Stream.Stream<readonly Heard[], CallFailure>, CallFailure, Scope.Scope> {
  return Effect.tap(connect(opened, Option.none()), () => note({ watching: `${opened.connection.url}${eventsPath}` }));
}

function isDropped({ code, status = NO_STATUS }: CallFailure): boolean {
  return code === "cli_error" || status >= SERVER_ERROR;
}

function keepTrying({ elapsed, input }: { readonly elapsed: number; readonly input: CallFailure }): boolean {
  return isDropped(input) && elapsed < GIVE_UP_AFTER;
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

function gaveUp(failure: CallFailure): CallFailure {
  if (!isDropped(failure)) {
    return failure;
  }
  return { code: "server_unreachable", message: `Couldn't reach the server for 5 minutes: ${failure.message}` };
}

function lastSeenAfter(event: Heard): (seen: Option.Option<MessageId>) => Option.Option<MessageId> {
  if (isInboxItem(event)) {
    return () => Option.some(event.item.message.id);
  }
  return Option.orElse(() => Option.fromNullishOr(event.latestMessageId));
}

interface Resuming {
  readonly opened: ClientWithLeaseState;
  readonly first: Stream.Stream<readonly Heard[], CallFailure>;
}

function source({ first, opened }: Resuming): Stream.Stream<Heard, CallFailure> {
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
        Stream.mapError(gaveUp),
        Stream.flattenIterable,
        Stream.tap((event) => Ref.update(lastSeen, lastSeenAfter(event))),
      );
    }),
  );
}

export { type Heard, isInboxItem, source, start };
