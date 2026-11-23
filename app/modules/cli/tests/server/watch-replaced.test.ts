import type { CliResult, CommandLineNeeds, CuttableLink, TestIdentity } from "../../../testing/server.ts";
import { Effect, Fiber, String as Str } from "effect";
import {
  TestCookout,
  answer,
  commandLineServices,
  cuttableLink,
  freshStateFolder,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

interface Board {
  readonly bob: TestIdentity;
  readonly env: Readonly<Record<string, string>>;
  readonly link: CuttableLink;
}

interface Case {
  readonly args: readonly string[];
  readonly line: string;
}

interface Replaced {
  readonly result: CliResult;
  readonly stdoutLines: readonly string[];
}

const EXIT_REPLACED = 6;
const STOPPED_LINE = "cookout watch stopped: replaced by another watch (watch_replaced)";
const STOPPED_JSON = '{"error":{"code":"watch_replaced","message":"replaced by another watch"}}';

const passTime = Effect.forever(Effect.andThen(TestClock.adjust("5 seconds"), Effect.yieldNow));

const bobsBoard: Effect.Effect<Board, never, CommandLineNeeds | TestCookout | Scope.Scope> = Effect.gen(
  function* bobAndALink() {
    const cookout = yield* TestCookout;
    const link = yield* cuttableLink(cookout.url);
    const bob = yield* cookout.createIdentity("bob");
    const folder = yield* freshStateFolder;
    const session = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: folder, COOKOUT_STATE_DIR: folder };
    return { bob, env: { ...session, COOKOUT_TOKEN: bob.token, COOKOUT_URL: link.url }, link };
  },
);

function replacedWatch(args: readonly string[]): Effect.Effect<Replaced, never, CommandLineNeeds | Scope.Scope> {
  return Effect.gen(function* watchThenReplace() {
    const { bob, env, link } = yield* bobsBoard;
    const watching = yield* Effect.forkScoped(runCookout({ args, env }));
    yield* link.relayed("event: connected");
    yield* Effect.acquireRelease(
      answer(() => bob.client.watch()),
      (events) => answer(() => events.close()),
    );
    const result = yield* Effect.raceFirst(Fiber.join(watching), Effect.andThen(passTime, Effect.never));
    return { result, stdoutLines: Str.split(result.stdout, "\n") };
  }).pipe(Effect.provide(testCookout()));
}

it.effect.each<Case>([
  { args: ["watch"], line: STOPPED_LINE },
  { args: ["watch", "--json"], line: STOPPED_JSON },
])("cookout $args prints one stdout line and exits 6 when another watch for its agent replaces it", ({ args, line }) =>
  Effect.gen(function* watchReplaced() {
    const { result, stdoutLines } = yield* replacedWatch(args);

    expect(result.exitCode).toBe(EXIT_REPLACED);
    expect(stdoutLines).toStrictEqual([line]);
  }).pipe(Effect.provide(commandLineServices)),
);
