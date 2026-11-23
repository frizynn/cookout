import type {
  CliResult,
  CommandLineNeeds,
  CuttableLink,
  LastEnd,
  TestCookoutService,
} from "../../../testing/server.ts";
import { Effect, Fiber } from "effect";
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

interface Watch {
  readonly cookout: TestCookoutService;
  readonly link: CuttableLink;
  readonly env: Readonly<Record<string, string>>;
  readonly mentionBob: Effect.Effect<void>;
}

interface Ended {
  readonly exitCode: number | null;
  readonly end: LastEnd;
}

type Needs = CommandLineNeeds | Scope.Scope;

const EXIT_SUCCESS = 0;
const EXIT_TIMEOUT = 2;
const EXIT_UNREACHABLE = 5;
const CLEAN: LastEnd = { endedUnexpectedly: false };
const DROPPED: LastEnd = { endedUnexpectedly: true, offlineReason: "connection lost" };

const READ_THE_CONNECTED_EVENT = "200 millis";

const passTime = Effect.forever(Effect.andThen(TestClock.adjust("5 seconds"), Effect.yieldNow));

const board: Effect.Effect<Watch, never, TestCookout | Needs> = Effect.gen(function* bobWatchingThroughALink() {
  const cookout = yield* TestCookout;
  const link = yield* cuttableLink(cookout.url);
  const ann = yield* cookout.createIdentity("ann");
  const bob = yield* cookout.createIdentity("bob");
  const folder = yield* freshStateFolder;
  yield* answer(() => ann.client.createChannel({ name: "grill" }));
  const session = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: folder, COOKOUT_STATE_DIR: folder };
  const env = { ...session, COOKOUT_TOKEN: bob.token, COOKOUT_URL: link.url };
  const mentionBob = Effect.asVoid(answer(() => ann.client.createMessage({ channel: "grill", text: "@bob look" })));
  return { cookout, env, link, mentionBob };
});

function endAfterTheGrace(cookout: TestCookoutService, result: CliResult): Effect.Effect<Ended> {
  return Effect.gen(function* readEndAfterTheGrace() {
    yield* cookout.liveConnectionsClosed("bob");
    yield* TestClock.adjust("60 seconds");
    const end = yield* cookout.lastEnd("bob");
    return { end, exitCode: result.exitCode };
  });
}

function watchedUntilExit(
  args: readonly string[],
  whileWatching: (watch: Watch) => Effect.Effect<void>,
): Effect.Effect<Ended, never, Needs> {
  return Effect.gen(function* watchAsBob() {
    const watch = yield* board;
    const watching = yield* Effect.forkScoped(runCookout({ args, env: watch.env }));
    yield* watch.link.relayed("event: connected");
    yield* whileWatching(watch);
    const result = yield* Effect.raceFirst(Fiber.join(watching), Effect.andThen(passTime, Effect.never));
    return yield* endAfterTheGrace(watch.cookout, result);
  }).pipe(Effect.provide(testCookout()));
}

it.effect("cookout watch --once sends the clean close before it exits 0", () =>
  Effect.gen(function* onceClosesCleanly() {
    const ended = yield* watchedUntilExit(["watch", "--once"], ({ mentionBob }) => mentionBob);

    expect(ended).toStrictEqual({ end: CLEAN, exitCode: EXIT_SUCCESS });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("cookout watch --timeout sends the clean close before it exits 2", () =>
  Effect.gen(function* timeoutClosesCleanly() {
    const ended = yield* watchedUntilExit(["watch", "--timeout", "1"], () => Effect.void);

    expect(ended).toStrictEqual({ end: CLEAN, exitCode: EXIT_TIMEOUT });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("cookout watch sends no clean close when its link is cut and it gives up, so the end reads as a drop", () =>
  Effect.gen(function* cutLinkDrops() {
    const ended = yield* watchedUntilExit(["watch"], ({ link }) => link.takeDown);

    expect(ended).toStrictEqual({ end: DROPPED, exitCode: EXIT_UNREACHABLE });
  }).pipe(Effect.provide(commandLineServices)),
);

const interruptedWatch: Effect.Effect<LastEnd, never, Needs> = Effect.gen(function* interruptWatch() {
  const watch = yield* board;
  const watching = yield* Effect.forkScoped(runCookout({ args: ["watch"], env: watch.env }));
  yield* watch.link.relayed("event: connected");
  yield* TestClock.withLive(Effect.sleep(READ_THE_CONNECTED_EVENT));
  yield* Fiber.interrupt(watching);
  yield* watch.cookout.liveConnectionsClosed("bob");
  yield* TestClock.adjust("60 seconds");
  return yield* watch.cookout.lastEnd("bob");
}).pipe(Effect.provide(testCookout()));

it.effect("cookout watch stopped by a signal (its fiber interrupted, as SIGTERM does) sends the clean close", () =>
  Effect.gen(function* signalClosesCleanly() {
    const end = yield* interruptedWatch;

    expect(end).toStrictEqual(CLEAN);
  }).pipe(Effect.provide(commandLineServices)),
);
