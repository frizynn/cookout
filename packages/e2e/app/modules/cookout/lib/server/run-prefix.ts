import { String as Str } from "effect";

const PREFIX_RADIX = 36;
const PREFIX_LENGTH = 8;

const e2eNameStart = "e2e-";

const runPrefixSpace = PREFIX_RADIX ** PREFIX_LENGTH;

function runPrefix(draw: number): string {
  return `${e2eNameStart}${Str.padStart(PREFIX_LENGTH, "0")(draw.toString(PREFIX_RADIX))}`;
}

export { e2eNameStart, runPrefix, runPrefixSpace };
