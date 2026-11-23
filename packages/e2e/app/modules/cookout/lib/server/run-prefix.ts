import { Effect, String as Str } from "effect";

const PREFIX_RADIX = 36;
const PREFIX_LENGTH = 8;

const e2eNameStart = "e2e-";

const runPrefixSpace = PREFIX_RADIX ** PREFIX_LENGTH;

function runPrefix(draw: number): string {
  return `${e2eNameStart}${Str.padStart(PREFIX_LENGTH, "0")(draw.toString(PREFIX_RADIX))}`;
}

function notTheRuns(prefix: string, name: string): Error {
  return new Error(
    `${name} isn't an identity this e2e run created (${prefix}-…): a test may deactivate, delete or rotate only its own.`,
  );
}

function requireRunIdentity(prefix: string): (name: string) => Effect.Effect<string> {
  return (name) => {
    if (Str.startsWith(`${prefix}-`)(name)) {
      return Effect.succeed(name);
    }
    return Effect.die(notTheRuns(prefix, name));
  };
}

export { e2eNameStart, requireRunIdentity, runPrefix, runPrefixSpace };
