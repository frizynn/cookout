import { String as Str } from "effect";

const SPECIAL = /[.*+?^${}()|[\]\\/]/gu;
const SHORT_TIME = String.raw`\d{1,2}:\d{2}\s[AP]M`;

interface ShownMessageParts {
  readonly header: string;
  readonly body: string;
}

function escaped(text: string): string {
  return Str.replaceAll(SPECIAL, String.raw`\$&`)(text);
}

function shownMessage({ body, header }: ShownMessageParts): RegExp {
  return new RegExp(`^(?:New)?${escaped(header)}${SHORT_TIME}${escaped(body)}$`, "u");
}

export { shownMessage };
