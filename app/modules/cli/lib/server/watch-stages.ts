import { Array as Arr, Duration, Effect, Option, Ref, Stream } from "effect";
import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import { CommandFailed, refused } from "./output.ts";
import type { ConnectedEvent, InboxItemEvent, MessageId } from "../../../sdk/index.ts";
import { note, printLine } from "./watch-lines.ts";
import type { Format } from "./watch-lines.ts";
import type { Heard } from "./watch-connection.ts";
import { callClient } from "./adapters/sdk.ts";
import { isInboxItem } from "./watch-connection.ts";
import { leaseLost } from "../../../leases/index.ts";

interface StopCondition {
  readonly once: boolean;
  readonly untilMention: boolean;
  readonly timeout: number | null;
}

const NO_UNREAD = 0;
const NOTHING_POSTED = 0;
const FIRST = 1;
const TOKEN_REFUSED: ReadonlySet<string> = new Set(["token_missing", "token_unknown", "token_revoked"]);
const exitCodes = { leaseLost: 4, timeout: 2, tokenRefused: 3, unreachable: 5 } as const;

function unreadUpTo(opened: ClientWithLeaseState, latest: MessageId | null): Effect.Effect<number, CallFailure> {
  if (latest === null) {
    return Effect.succeed(NO_UNREAD);
  }
  return Effect.map(
    callClient((client) => client.inbox())(opened),
    ({ items }) => Arr.filter(items, ({ message }) => message.id <= latest).length,
  );
}

function sayUnread(format: Format, count: number): Effect.Effect<boolean> {
  if (count === NO_UNREAD) {
    return Effect.succeed(false);
  }
  return Effect.as(
    printLine({ format, json: { count, type: "unread" }, text: `${String(count)} unread, run cookout inbox` }),
    true,
  );
}

function isNewerThan(counted: Option.Option<number>, { item }: InboxItemEvent): boolean {
  return !Option.exists(counted, (latest) => item.message.id <= latest);
}

interface Counting {
  readonly opened: ClientWithLeaseState;
  readonly format: Format;
  readonly stop: StopCondition;
}

function startUpLine({
  format,
  opened,
  stop,
}: Counting): (events: Stream.Stream<Heard, CallFailure>) => Stream.Stream<InboxItemEvent, CallFailure> {
  return (events) =>
    Stream.unwrap(
      Effect.gen(function* countOnce() {
        const counted = yield* Ref.make(Option.none<number>());
        const sayOnce = Effect.fnUntraced(function* sayUnreadOnce({ latestMessageId }: ConnectedEvent) {
          const toCount = yield* Ref.modify(counted, (already) => [
            Option.filter(Option.some(latestMessageId), () => Option.isNone(already)),
            Option.orElseSome(already, () => latestMessageId ?? NOTHING_POSTED),
          ]);
          const said = yield* Effect.forEach(
            Option.toArray(toCount),
            (latest) => Effect.flatMap(unreadUpTo(opened, latest), (count) => sayUnread(format, count)),
            { concurrency: 1 },
          );
          return said.includes(true);
        });
        function isNewer(event: InboxItemEvent): Effect.Effect<boolean> {
          return Effect.map(Ref.get(counted), (latest) => isNewerThan(latest, event));
        }
        return events.pipe(
          Stream.takeUntilEffect((event) => {
            if (isInboxItem(event)) {
              return Effect.succeed(false);
            }
            return Effect.map(sayOnce(event), (said) => said && stop.once);
          }),
          Stream.filter(isInboxItem),
          Stream.filterEffect(isNewer),
        );
      }),
    );
}

function isMention({ item }: InboxItemEvent): boolean {
  return item.reasons.includes("mention");
}

function wanted(
  { once, untilMention }: StopCondition,
  events: Stream.Stream<InboxItemEvent, CallFailure>,
): Stream.Stream<InboxItemEvent, CallFailure> {
  if (untilMention) {
    return Stream.take(Stream.filter(events, isMention), FIRST);
  }
  if (once) {
    return Stream.take(events, FIRST);
  }
  return events;
}

function untilStopped(
  stop: StopCondition,
): (events: Stream.Stream<InboxItemEvent, CallFailure>) => Stream.Stream<InboxItemEvent, CallFailure> {
  const seconds = stop.timeout;
  if (seconds === null) {
    return (events) => wanted(stop, events);
  }
  return (events) =>
    Stream.timeoutOrElse(wanted(stop, events), {
      duration: Duration.seconds(seconds),
      orElse: () => Stream.fail({ code: "timeout", message: `No item in ${String(seconds)} s.` }),
    });
}

function fatalExitCode(code: string): Option.Option<number> {
  if (TOKEN_REFUSED.has(code)) {
    return Option.some(exitCodes.tokenRefused);
  }
  if (code === leaseLost) {
    return Option.some(exitCodes.leaseLost);
  }
  if (code === "server_unreachable") {
    return Option.some(exitCodes.unreachable);
  }
  return Option.none();
}

function stopped(format: Format): (failure: CallFailure) => Effect.Effect<never, CommandFailed> {
  return (failure) => {
    const { code, message } = failure;
    if (code === "timeout") {
      return Effect.andThen(note({ timeout: message }), CommandFailed.make({ code, exitCode: exitCodes.timeout }));
    }
    return Option.match(fatalExitCode(code), {
      onNone: () => refused(failure),
      onSome: (exitCode) =>
        Effect.andThen(
          printLine({
            format,
            json: { error: { code, message } },
            text: `cookout watch stopped: ${message} (${code})`,
          }),
          CommandFailed.make({ code, exitCode }),
        ),
    });
  };
}

export { type StopCondition, startUpLine, stopped, untilStopped };
