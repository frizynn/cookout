import { TestCookout, answer, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { EventStream } from "../../index.ts";
import { TestClock } from "effect/testing";

const TOO_MANY = 429;
const THREE_A_MINUTE = 3;
const ONE = 1;
const RETRIES = 50;
const deploy = { name: "deploy", schema: { type: "object" }, url: "https://hooks.example.com/deploy" };
const call = { channel: "grill", data: {} };

interface AnnAndBob {
  readonly ann: TestIdentity;
  readonly bob: TestIdentity;
}

function annAndBob(cookout: TestCookoutService): Effect.Effect<AnnAndBob> {
  return Effect.all({ ann: cookout.createIdentity("ann"), bob: cookout.createIdentity("bob") }, { concurrency: 1 });
}

function deployInGrill(cookout: TestCookoutService): Effect.Effect<void> {
  return Effect.gen(function* addDeploy() {
    yield* answer(() => cookout.client.addCommand(deploy));
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
  });
}

function reopenOnceFreed(who: TestIdentity): Effect.Effect<EventStream> {
  return Effect.tryPromise({ catch: () => "still_full", try: () => who.client.watch() }).pipe(
    Effect.retry({ times: RETRIES }),
    Effect.orDie,
  );
}

it.effect("an identity over its request rate is refused with 429 rate_limited until its bucket refills", () =>
  Effect.gen(function* overRate() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* annAndBob(cookout);
    yield* Effect.repeat(
      answer(() => ann.client.whoami()),
      { times: THREE_A_MINUTE - ONE },
    );
    const refused = yield* refusal(() => ann.client.whoami());
    const other = yield* answer(() => bob.client.whoami());
    yield* TestClock.adjust("20 seconds");
    const refilled = yield* answer(() => ann.client.whoami());
    const again = yield* refusal(() => ann.client.whoami());

    expect([refused, other, refilled, again]).toMatchObject([
      { code: "rate_limited", details: { retryAfterSeconds: 20 }, status: TOO_MANY },
      { identity: { name: "bob" } },
      { identity: { name: "ann" } },
      { code: "rate_limited", status: TOO_MANY },
    ]);
  }).pipe(Effect.provide(testCookout({ requestsPerMinute: THREE_A_MINUTE }))),
);

it.effect("command calls have a limit of their own, and a refused call posts nothing", () =>
  Effect.gen(function* overCalls() {
    const cookout = yield* TestCookout;
    yield* deployInGrill(cookout);
    const { ann, bob } = yield* annAndBob(cookout);
    yield* answer(() => ann.client.callCommand("deploy", call));
    const refused = yield* refusal(() => ann.client.callCommand("deploy", call));
    const { messages } = yield* answer(() => ann.client.listMessages("grill"));
    yield* answer(() => bob.client.callCommand("deploy", call));
    yield* TestClock.adjust("1 minute");
    yield* answer(() => ann.client.callCommand("deploy", call));

    expect({ messages: messages.length, refused }).toMatchObject({
      messages: ONE,
      refused: { code: "rate_limited", details: { retryAfterSeconds: 60 }, status: TOO_MANY },
    });
  }).pipe(Effect.provide(testCookout({ commandCallsPerMinute: ONE }))),
);

it.effect("an identity holds only so many open event streams, and closing one frees its place", () =>
  Effect.gen(function* overStreams() {
    const cookout = yield* TestCookout;
    const { ann, bob } = yield* annAndBob(cookout);
    const first = yield* answer(() => ann.client.watch());
    const refused = yield* refusal(() => ann.client.watch());
    const other = yield* answer(() => bob.client.watch());
    yield* answer(() => first.close());
    const reopened = yield* reopenOnceFreed(ann);
    yield* answer(() => other.close());
    yield* answer(() => reopened.close());

    expect(refused).toMatchObject({ code: "too_many_streams", status: TOO_MANY });
  }).pipe(Effect.provide(testCookout({ streamsPerIdentity: ONE }))),
);
