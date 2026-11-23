import { Predicate, String as Str } from "effect";

const SPECIAL = /[.*+?^${}()|[\]\\/]/gu;
const TIME_AGO = String.raw`(?:just now|\d+ (?:seconds?|minutes?|hours?) ago)`;
const HOVER_ACTION = "(?:Reply)?";

interface ShownMessageParts {
  readonly header: string;
  readonly body: string;
  readonly seenBy?: string;
}

function escaped(text: string): string {
  return Str.replaceAll(SPECIAL, String.raw`\$&`)(text);
}

function receiptOf(seenBy: string | undefined): string {
  if (Predicate.isUndefined(seenBy)) {
    return "";
  }
  return `Seen by @${escaped(seenBy)} ${TIME_AGO}`;
}

function shownMessage({ body, header, seenBy }: ShownMessageParts): RegExp {
  return new RegExp(`^(?:New)?${escaped(header)}${TIME_AGO}${escaped(body)}${receiptOf(seenBy)}${HOVER_ACTION}$`, "u");
}

export { shownMessage };
