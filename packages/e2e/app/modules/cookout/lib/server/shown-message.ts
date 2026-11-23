import { String as Str } from "effect";

const SPECIAL = /[.*+?^${}()|[\]\\/]/gu;
const TIME_AGO = String.raw`(?:just now|\d+ (?:seconds?|minutes?|hours?) ago)`;
const HOVER_ACTION = "(?:Reply)?";

interface ShownMessageParts {
  readonly header: string;
  readonly body: string;
}

function escaped(text: string): string {
  return Str.replaceAll(SPECIAL, String.raw`\$&`)(text);
}

function shownMessage({ body, header }: ShownMessageParts): RegExp {
  return new RegExp(`^(?:New)?${escaped(header)}${TIME_AGO}${escaped(body)}${HOVER_ACTION}$`, "u");
}

export { shownMessage };
