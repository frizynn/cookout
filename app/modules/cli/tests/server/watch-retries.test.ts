import { Array as Arr, Effect, Fiber, Option, String as Str } from "effect";
import type { CommandLineNeeds, CuttableLink, TestIdentity } from "../../../testing/server.ts";
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
const EXIT_UNREACHABLE = 5;
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
    yield* link.takeDown;

    const result = yield* Effect.raceFirst(
      runCookout({ args: ["watch"], env }),
      Effect.andThen(passTime, Effect.never),
    );
    const delays = retryDelaysIn(result.stderr);

    expect(result.exitCode).toBe(EXIT_UNREACHABLE);
    expect(Arr.head(delays)).toStrictEqual(Option.some(FIRST_DELAY));
    expect(eachDoubledUpTo30s(delays)).toBe(true);
    expect(delays).toContain(LONGEST_DELAY);
    expect(Arr.every(delays, (delay) => delay <= LONGEST_DELAY)).toBe(true);
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
