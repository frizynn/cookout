import type { CookoutClient, CookoutEvent, EventStream } from "../../index.ts";
import { Duration, Effect, Fiber } from "effect";
import { TestCookout, answer, refusal, testCookout, twoSessions } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

const CONFLICT = 409;
const RENEWAL_AND_MORE = 30;

function watching(client: CookoutClient): Effect.Effect<AsyncIterator<CookoutEvent>, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch()),
      (events: EventStream) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

function refusedAfter(call: () => Promise<unknown>, seconds: number): Effect.Effect<unknown> {
  return Effect.gen(function* refusedLater() {
    const next = yield* Effect.forkChild(refusal(call));
    yield* TestClock.adjust(Duration.seconds(seconds));
    return yield* Fiber.join(next);
  });
}

it.effect("an agent's open stream keeps its lease alive past 60 s", () =>
  Effect.gen(function* streamRenews() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* watching(first);
    yield* TestClock.adjust("90 seconds");
    const error = yield* refusal(() => second.join({ as: "auth-griller" }));

    expect(error).toMatchObject({ code: "lease_held", status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("after join --force by another session, the open stream ends with lease_lost", () =>
  Effect.gen(function* streamLosesLease() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    const events = yield* watching(first);
    const taken = yield* answer(() => second.join({ as: "auth-griller", force: true }));
    const error = yield* refusedAfter(() => events.next(), RENEWAL_AND_MORE);
    const left = yield* refusal(() => first.leave());

    expect(error).toMatchObject({ code: "lease_lost", details: { heldUntil: taken.expiresAt } });
    expect(left).toMatchObject({ code: "lease_required" });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("watching with a stale lease ID is refused with 409 lease_lost before the stream opens", () =>
  Effect.gen(function* staleWatch() {
    const cookout = yield* TestCookout;
    const { first, second } = yield* twoSessions(cookout);
    yield* answer(() => first.join({ as: "auth-griller" }));
    yield* answer(() => second.join({ as: "auth-griller", force: true }));
    const error = yield* refusal(() => first.watch());

    expect(error).toMatchObject({ code: "lease_lost", status: CONFLICT });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a human's stream works with no lease, and a stray lease ID it sends is never checked", () =>
  Effect.gen(function* humanWatch() {
    const cookout = yield* TestCookout;
    const { first, agent } = yield* twoSessions(cookout);
    const { leaseId } = yield* answer(() => first.join({ as: "auth-griller" }));
    const human = yield* cookout.createIdentity("ada", { kind: "human" });
    const plain = yield* watching(human.client);
    const stray = yield* watching(cookout.clientFor(human.token, { leaseId }));
    yield* TestClock.adjust("90 seconds");
    const { message } = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "@ada look" }));
    const arrived = yield* answer(() => Promise.all([plain.next(), stray.next()]));

    expect(arrived).toMatchObject([
      { value: { item: { message: { id: message.id } }, type: "inbox-item" } },
      { value: { item: { message: { id: message.id } }, type: "inbox-item" } },
    ]);
  }).pipe(Effect.provide(testCookout())),
);
