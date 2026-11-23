import type { CallFailure, ClientWithLeaseState } from "./adapters/sdk.ts";
import { Command, Flag } from "effect/cli";
import { Effect, Option, Stream } from "effect";
import { printLine, textLine } from "./watch-lines.ts";
import { source, start } from "./watch-connection.ts";
import { startUpLine, stopped, untilStopped } from "./watch-stages.ts";
import type { CommandFailed } from "./output.ts";
import type { Format } from "./watch-lines.ts";
import type { Heard } from "./watch-connection.ts";
import type { InboxItemEvent } from "../../../sdk/index.ts";
import type { LeaseStateNeeds } from "./lease-state.ts";
import type { StopCondition } from "./watch-stages.ts";
import { withClient } from "./adapters/sdk.ts";

interface Watching {
  readonly format: Format;
  readonly stop: StopCondition;
}

function printEach(format: Format): (event: InboxItemEvent) => Effect.Effect<void> {
  return (event) => printLine({ format, json: event, text: textLine(event) });
}

function printItems({ format, stop }: Watching): (opened: ClientWithLeaseState) => Effect.Effect<void, CallFailure> {
  return (opened) =>
    Effect.scoped(
      Effect.flatMap(start(opened), (first: Stream.Stream<readonly Heard[], CallFailure>) =>
        source({ first, opened }).pipe(
          startUpLine({ format, opened, stop }),
          untilStopped(stop),
          Stream.runForEach(printEach(format)),
        ),
      ),
    );
}

function watch(watching: Watching): Effect.Effect<void, CommandFailed, LeaseStateNeeds> {
  return Effect.matchEffect(withClient(printItems(watching)), {
    onFailure: stopped(watching.format),
    onSuccess: () => Effect.void,
  });
}

const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Print each line as one JSON object instead: an item is its event, the start-up line is " +
      '{ "type": "unread", "count" }, a fatal error is { "error": { "code", "message" } }.',
  ),
);

const onceFlag = Flag.Boolean("once").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Exit 0 after printing the first new item, or the start-up unread line when there is one."),
);

const untilMentionFlag = Flag.Boolean("until-mention").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Print only the first new item that @-mentions this identity, then exit 0, or exit 0 at the start-up unread line when an unread mention is waiting.",
  ),
);

const timeoutFlag = Flag.Int("timeout").pipe(
  Flag.optional,
  Flag.withDescription("Exit 2 when this many seconds pass with no item printed."),
);

function formatOf(json: boolean): Format {
  if (json) {
    return "json";
  }
  return "text";
}

export const watchCommand = Command.make(
  "watch",
  { json: jsonFlag, once: onceFlag, timeout: timeoutFlag, untilMention: untilMentionFlag },
  ({ json, once, timeout, untilMention }) =>
    watch({ format: formatOf(json), stop: { once, timeout: Option.getOrNull(timeout), untilMention } }),
).pipe(
  Command.withDescription(
    "Print one line per new inbox item as it arrives, for Claude Code's Monitor tool: " +
      "#<channel> thread:<id> @<author>: <first 120 characters> (msg <id>), after one " +
      "<n> unread, run cookout inbox line when there are unread items. Exit codes: 0 after --once (at the " +
      "unread line, or else the first item) or " +
      "--until-mention, 1 refused, 2 --timeout passed, 3 token invalid or deleted, 4 lease_lost (another " +
      "session ran join --force), 5 server unreachable for 5 minutes; 3, 4 and 5 print one stdout line first. " +
      "Run cookout help monitor.",
  ),
);
