import { Array as Arr, Console, Effect, Schema, String as Str, pipe } from "effect";
import type { InboxItemEvent, NudgeEvent, Reaction } from "../../../sdk/index.ts";
import { reactionSymbols } from "../../../messages/index.ts";

type Format = "json" | "text";

const SHOWN_CHARACTERS = 120;
const toJsonLine = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

function reactedLine({ identity, reaction }: Reaction): string {
  return `@${identity} reacted with ${reactionSymbols[reaction]}`;
}

function nudgeLine({ nudge: { channel, id, parent, text } }: NudgeEvent): string {
  return `#${channel.name} thread:${String(parent.id)} ${text} (nudge ${String(id)})`;
}

function itemLine({ item: { channel, message, newReactions = [], parent } }: InboxItemEvent): string {
  const shown = pipe(message.text, Str.replaceAll(/\s+/gu, " "), Str.takeLeft(SHOWN_CHARACTERS));
  const where = `#${channel.name} thread:${String(parent.id)}`;
  const at = `(msg ${String(message.id)})`;
  if (Arr.isReadonlyArrayNonEmpty(newReactions)) {
    return `${where} ${Arr.join(Arr.map(newReactions, reactedLine), ", ")} to your message: ${shown} ${at}`;
  }
  return `${where} @${message.author.name}: ${shown} ${at}`;
}

function textLine(event: InboxItemEvent | NudgeEvent): string {
  if (event.type === "nudge") {
    return nudgeLine(event);
  }
  return itemLine(event);
}

interface Line {
  readonly format: Format;
  readonly text: string;
  readonly json: unknown;
}

function printLine({ format, json, text }: Line): Effect.Effect<void> {
  if (format === "json") {
    return toJsonLine(json).pipe(Effect.orDie, Effect.flatMap(Console.log));
  }
  return Console.log(text);
}

function note(value: unknown): Effect.Effect<void> {
  return toJsonLine(value).pipe(Effect.orDie, Effect.flatMap(Console.error));
}

export { type Format, note, printLine, textLine };
