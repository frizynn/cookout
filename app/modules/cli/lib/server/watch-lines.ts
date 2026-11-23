import { Console, Effect, Schema, String as Str, pipe } from "effect";
import type { InboxItemEvent } from "../../../sdk/index.ts";

type Format = "json" | "text";

const SHOWN_CHARACTERS = 120;
const toJsonLine = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

function textLine({ item: { channel, message, parent } }: InboxItemEvent): string {
  const shown = pipe(message.text, Str.replaceAll(/\s+/gu, " "), Str.takeLeft(SHOWN_CHARACTERS));
  return `#${channel.name} thread:${String(parent.id)} @${message.author.name}: ${shown} (msg ${String(message.id)})`;
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
