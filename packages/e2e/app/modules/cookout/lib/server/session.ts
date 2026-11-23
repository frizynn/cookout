import { Array as Arr, Effect, String as Str } from "effect";
import type { BinNeeds, BinResult, BinRun } from "./bin.ts";
import type { IdentityWithTokenResponse, MessageId } from "@ai-hero/cookout/sdk";
import { freshStateFolder, postedMessageId } from "./bin.ts";
import type { FileSystem } from "effect";

type SessionNeeds = BinNeeds | FileSystem.FileSystem;

type RunCookout = (...args: readonly string[]) => Effect.Effect<BinResult, never, SessionNeeds>;

interface Session {
  readonly name: string;
  readonly token: string;
  readonly cookout: RunCookout;
  readonly post: (...args: readonly string[]) => Effect.Effect<MessageId, never, SessionNeeds>;
}

type JoinAgent = (name: string, url?: string) => Effect.Effect<Session, never, SessionNeeds>;

interface Joining {
  readonly url: string;
  readonly createAgent: (name: string) => Effect.Effect<IdentityWithTokenResponse>;
  readonly runCookout: (run: BinRun) => Effect.Effect<BinResult, never, BinNeeds>;
}

interface WatchLine {
  readonly channel: string;
  readonly thread: MessageId;
  readonly author: string;
  readonly text: string;
  readonly message: MessageId;
}

interface WatchOutput {
  readonly items: readonly string[];
  readonly last: string;
}

const succeeded = { exitCode: 0, stderr: "" } as const;
const watchExitTokenRevoked = 3;
const LAST = 1;

function requireSucceeded(what: string, result: BinResult): Effect.Effect<BinResult> {
  if (result.exitCode === succeeded.exitCode && result.stderr === succeeded.stderr) {
    return Effect.succeed(result);
  }
  return Effect.die(new Error(`cookout ${what} exited ${String(result.exitCode)}: ${result.stderr}`));
}

function joinAgentWith({ createAgent, runCookout, url: defaultUrl }: Joining): JoinAgent {
  return (name, url = defaultUrl) =>
    Effect.gen(function* joinAsAgent() {
      const { identity, token } = yield* createAgent(name);
      const stateFolder = yield* freshStateFolder;
      const inSession = { harnessSession: stateFolder, stateFolder, url };
      function run(...args: readonly string[]): Effect.Effect<BinResult, never, SessionNeeds> {
        return runCookout({ ...inSession, args });
      }
      function post(...args: readonly string[]): Effect.Effect<MessageId, never, SessionNeeds> {
        return run("message", "post", ...args).pipe(
          Effect.flatMap((posted) => requireSucceeded("message post", posted)),
          Effect.flatMap(postedMessageId),
        );
      }
      const joining = runCookout({ ...inSession, args: ["join", "--as", identity.name], token });
      yield* Effect.flatMap(joining, (joined) => requireSucceeded("join", joined));
      return { cookout: run, name: identity.name, post, token };
    });
}

function watchLine({ author, channel, message, text, thread }: WatchLine): string {
  return `#${channel} thread:${String(thread)} @${author}: ${text} (msg ${String(message)})`;
}

function watchOutput({ stdout }: BinResult): WatchOutput {
  const lines = Str.split(Str.trimEnd(stdout), "\n");
  return { items: Arr.dropRight(lines, LAST), last: Arr.lastNonEmpty(lines) };
}

export {
  type JoinAgent,
  type RunCookout,
  type Session,
  type SessionNeeds,
  type WatchLine,
  type WatchOutput,
  joinAgentWith,
  succeeded,
  watchExitTokenRevoked,
  watchLine,
  watchOutput,
};
