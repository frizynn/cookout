import { Array as Arr, Clock, Effect, Fiber, Option, Predicate, String as Str } from "effect";
import type { CliResult, CommandLineNeeds, CuttableLink, TestIdentity } from "../../../testing/server.ts";
import {
  TestCookout,
  answer,
  commandLineServices,
  cuttableLink,
  freshStateFolder,
  runCookout,
  serverAnswering,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import { inboxPath } from "../../../inbox/index.ts";

interface Watch {
  readonly ann: TestIdentity;
  readonly env: Readonly<Record<string, string>>;
  readonly link: CuttableLink;
}

const A_WHILE = "5 seconds";
const NEWLINE = "\n";
const RETRY_NOTE = "retrying in ";
const DECIMAL = 10;
const BEFORE_FIRST_NOTE = 1;
const TWO_FAILURES = 2;
const EXIT_SUCCESS = 0;
const EXIT_REFUSED = 1;
const EXIT_TIMEOUT = 2;
const TEN_MINUTES_OF_502S = 25;
const TEN_MINUTES = 600_000;
const ONE_REQUEST = 1;
const FIRST_DELAY = 1;
const SECOND_DELAY = 2;
const DOUBLING = 2;
const LONGEST_DELAY = 30;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;

const passTime = Effect.forever(Effect.andThen(TestClock.adjust(A_WHILE), Effect.yieldNow));

function eachDoubledUpTo30s(delays: readonly number[]): boolean {
  const doubled = Arr.zipWith(
    delays,
    Arr.drop(delays, BEFORE_FIRST_NOTE),
    (before, after) => after === Math.min(before * DOUBLING, LONGEST_DELAY),
  );
  return Arr.every(doubled, Boolean);
}

function retryDelaysIn(stderr: string): readonly number[] {
  return Arr.map(Arr.drop(Str.split(stderr, RETRY_NOTE), BEFORE_FIRST_NOTE), (rest) => Number.parseInt(rest, DECIMAL));
}

const board: Effect.Effect<Watch, never, TestCookout | CommandLineNeeds | Scope.Scope> = Effect.gen(
  function* annBobAndALink() {
    const cookout = yield* TestCookout;
    const link = yield* cuttableLink(cookout.url);
    const ann = yield* cookout.createIdentity("ann");
    const bob = yield* cookout.createIdentity("bob");
    const folder = yield* freshStateFolder;
    yield* answer(() => ann.client.createChannel({ name: "grill" }));
    return { ann, env: { COOKOUT_STATE_DIR: folder, COOKOUT_TOKEN: bob.token, COOKOUT_URL: link.url }, link };
  },
);

function watchedWhileDown({
  env,
  link,
}: Omit<Watch, "ann">): Effect.Effect<CliResult, never, CommandLineNeeds | Scope.Scope> {
  return Effect.gen(function* watchWhileDown() {
    const watching = yield* Effect.forkScoped(runCookout({ args: ["watch", "--timeout", "600"], env }));
    yield* Effect.raceFirst(link.relayed("event: connected"), passTime);
    yield* link.takeDown;
    return yield* Effect.raceFirst(Fiber.join(watching), Effect.andThen(passTime, Effect.never));
  });
}

interface ThroughOutage {
  readonly outage: number;
  readonly stillRunning: boolean;
  readonly watching: Fiber.Fiber<CliResult>;
}

function watchingThrough502s({
  env,
  link,
}: Omit<Watch, "ann">): Effect.Effect<ThroughOutage, never, CommandLineNeeds | Scope.Scope> {
  return Effect.gen(function* watchThrough502s() {
    yield* link.badGatewayFor(TEN_MINUTES_OF_502S);
    const startedAt = yield* Clock.currentTimeMillis;
    const watching = yield* Effect.forkScoped(runCookout({ args: ["watch", "--until-mention"], env }));
    yield* Effect.raceFirst(link.answeredBadGateway(TEN_MINUTES_OF_502S), passTime);
    const outage = (yield* Clock.currentTimeMillis) - startedAt;
    return { outage, stillRunning: Predicate.isUndefined(watching.pollUnsafe()), watching };
  });
}

it.effect("cookout watch keeps running through a deploy's two 502s, then prints the next mention once", () =>
  Effect.gen(function* watchThroughDeploy() {
    const { ann, env, link } = yield* board;
    yield* link.badGatewayFor(TWO_FAILURES);

    const watching = yield* Effect.forkScoped(runCookout({ args: ["watch", "--until-mention"], env }));
    yield* Effect.raceFirst(link.relayed("event: connected"), passTime);
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "@bob deployed" }));
    const result = yield* Effect.raceFirst(Fiber.join(watching), Effect.andThen(passTime, Effect.never));

    expect(result.exitCode).toBe(EXIT_SUCCESS);
    expect(Str.split(result.stdout, NEWLINE)).toStrictEqual([
      `#grill thread:${String(message.id)} @ann: @bob deployed (msg ${String(message.id)})`,
    ]);
    expect(result.stderr).toContain("board unavailable (502), retrying in 1s");
    expect(retryDelaysIn(result.stderr)).toStrictEqual([FIRST_DELAY, SECOND_DELAY]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout watch waits 1 s before its first retry, twice as long each time after, and never over 30 s", () =>
  Effect.gen(function* watchBacksOff() {
    const { env, link } = yield* board;

    const result = yield* watchedWhileDown({ env, link });
    const delays = retryDelaysIn(result.stderr);

    expect(result.exitCode).toBe(EXIT_TIMEOUT);
    expect(Arr.head(delays)).toStrictEqual(Option.some(FIRST_DELAY));
    expect(eachDoubledUpTo30s(delays)).toBe(true);
    expect(delays).toContain(LONGEST_DELAY);
    expect(Arr.every(delays, (delay) => delay <= LONGEST_DELAY)).toBe(true);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout watch keeps retrying through 10 minutes of 502s, then prints the next mention", () =>
  Effect.gen(function* watchThroughOutage() {
    const { ann, env, link } = yield* board;
    const { outage, stillRunning, watching } = yield* watchingThrough502s({ env, link });
    yield* Effect.raceFirst(link.relayed("event: connected"), passTime);
    const { message } = yield* answer(() => ann.client.createMessage({ channel: "grill", text: "@bob back up" }));
    const result = yield* Effect.raceFirst(Fiber.join(watching), Effect.andThen(passTime, Effect.never));

    expect(outage).toBeGreaterThanOrEqual(TEN_MINUTES);
    expect(stillRunning).toBe(true);
    expect(result.exitCode).toBe(EXIT_SUCCESS);
    expect(Str.split(result.stdout, NEWLINE)).toStrictEqual([
      `#grill thread:${String(message.id)} @ann: @bob back up (msg ${String(message.id)})`,
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("cookout watch retries a 502 on its start-up unread count, then prints the unread line", () =>
  Effect.gen(function* watchRetriesStartUp() {
    const { ann, env, link } = yield* board;
    yield* answer(() => ann.client.createMessage({ channel: "grill", text: "@bob before the deploy" }));
    yield* link.badGatewayFor(ONE_REQUEST, inboxPath);

    const result = yield* Effect.raceFirst(
      runCookout({ args: ["watch", "--until-mention"], env }),
      Effect.andThen(passTime, Effect.never),
    );

    expect(result.exitCode).toBe(EXIT_SUCCESS);
    expect(result.stdout).toBe("1 unread, run cookout inbox");
    expect(result.stderr).toContain("board unavailable (502), retrying in 1s");
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect.each([UNAUTHORIZED, FORBIDDEN, NOT_FOUND])(
  "cookout watch exits 1 at once, without a retry, when GET /v1/events answers %i",
  (status) =>
    Effect.gen(function* watchRefusedByStatus() {
      const url = yield* serverAnswering({ status, text: "no" });
      const result = yield* runCookout({ args: ["watch"], env: { COOKOUT_TOKEN: "any", COOKOUT_URL: url } });

      expect(result).toMatchObject({ exitCode: EXIT_REFUSED, stderrJson: { error: { code: "bad_response" } } });
      expect(retryDelaysIn(result.stderr)).toStrictEqual([]);
    }).pipe(Effect.provide(commandLineServices)),
);
