import { Array as Arr, Effect, Option, Stdio, String as Str, Stream, pipe } from "effect";
import type { AgentSessionStateNeeds } from "./agent-session-state.ts";
import type { CallFailure } from "./adapters/sdk.ts";
import { baseUrlOf } from "../../../http/client.ts";
import { boardUrl } from "./logins.ts";
import { cookoutUrl } from "../../../config/server.ts";
import { createCookoutClient } from "../../../sdk/index.ts";
import { toFailure } from "./adapters/sdk.ts";

interface TypedOnTerminal {
  readonly rest: string;
  readonly url: string;
}

const NOTHING = {};
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//iu;

const noUrl: CallFailure = {
  code: "usage",
  message: "Give the board's URL, such as `cookout login --url https://cookout.example.com`.",
};

function boardUrlFrom(typed: string): string {
  const url = Str.trim(typed);
  if (SCHEME.test(url)) {
    return baseUrlOf(url);
  }
  return baseUrlOf(`https://${url}`);
}

function setTo(value: string): Option.Option<string> {
  return Option.liftPredicate(Str.trim(value), Str.isNonEmpty);
}

function givenBoard(flag: Option.Option<string>): Effect.Effect<Option.Option<string>> {
  return Effect.map(Effect.orDie(cookoutUrl), (fromEnvironment) =>
    pipe(
      Option.flatMap(flag, setTo),
      Option.orElse(() => setTo(fromEnvironment)),
    ),
  );
}

const askedOnTerminal: Effect.Effect<void, CallFailure, Stdio.Stdio> = Effect.gen(function* askForUrl() {
  const stdio = yield* Stdio.Stdio;
  const isTerminal = yield* stdio.stdinIsTerminal;
  if (!isTerminal) {
    return yield* Effect.fail(noUrl);
  }
  return yield* Stream.make("Board URL: ").pipe(
    Stream.run(stdio.stderr({ endOnDone: false })),
    Effect.mapError(toFailure),
  );
});

function typedFrom(text: string): Effect.Effect<TypedOnTerminal, CallFailure> {
  const [first, ...rest] = Str.split(text, "\n");
  const url = Effect.mapError(Effect.fromOption(setTo(first)), () => noUrl);
  return Effect.map(url, (typed) => ({ rest: Arr.join(rest, "\n"), url: typed }));
}

const typedOnTerminal: Effect.Effect<TypedOnTerminal, CallFailure, Stdio.Stdio> = Effect.gen(function* readTyped() {
  yield* askedOnTerminal;
  const stdio = yield* Stdio.Stdio;
  const text = yield* stdio.stdin.pipe(Stream.decodeText, Stream.mkString, Effect.mapError(toFailure));
  return yield* typedFrom(text);
});

const firstLineOnTerminal: Effect.Effect<string, CallFailure, Stdio.Stdio> = Effect.gen(function* readFirstLine() {
  yield* askedOnTerminal;
  const stdio = yield* Stdio.Stdio;
  const line = yield* stdio.stdin.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.runHead,
    Effect.mapError(toFailure),
  );
  return yield* Effect.mapError(Effect.fromOption(Option.flatMap(line, setTo)), () => noUrl);
});

function notACookout(url: string, failure: CallFailure): CallFailure {
  return {
    code: "not_a_cookout",
    message: `${url} didn't answer as a cookout server (${failure.message}). Check the URL, and that the server is up.`,
  };
}

function checked(typed: string): Effect.Effect<string, CallFailure> {
  const url = boardUrlFrom(typed);
  return Effect.tryPromise({
    catch: toFailure,
    try: () => createCookoutClient({ env: NOTHING, url }).health(),
  }).pipe(
    Effect.mapError((failure) => notACookout(url, failure)),
    Effect.as(url),
  );
}

function boardToLogOutOf(
  flag: Option.Option<string>,
): Effect.Effect<Option.Option<string>, CallFailure, AgentSessionStateNeeds> {
  return Option.match(Option.flatMap(flag, setTo), {
    onNone: () => boardUrl,
    onSome: (url) => Effect.succeedSome(boardUrlFrom(url)),
  });
}

export { boardToLogOutOf, checked, firstLineOnTerminal, givenBoard, typedOnTerminal };
