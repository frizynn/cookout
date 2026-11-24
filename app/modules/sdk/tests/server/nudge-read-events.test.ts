import { Array as Arr, Effect, Option } from "effect";
import type { CookoutClient, CookoutEvent, EventStream, Message, Nudge, NudgeId } from "../../index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import type { TestCookoutOptions, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

const HUMAN = { kind: "human" } as const;
const SETTLE = "30 millis";
const OLDEST = 0;
const NEWEST = 1;
const ONE = 1;
const TWO = 2;
const storageKinds: readonly NonNullable<TestCookoutOptions["storage"]>[] = ["memory", "sqlite"];

const board = Effect.gen(function* openBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const bob = yield* cookout.createIdentity("bob", HUMAN);
  yield* answer(() => ada.client.createChannel({ name: "grill" }));
  return { ada, bob };
});

function post(who: TestIdentity, text: string): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "grill", text })),
    ({ message }) => message,
  );
}

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function nudgesOnceThere(client: CookoutClient, count: number): Effect.Effect<readonly Nudge[]> {
  const unread = Effect.map(
    answer(() => client.inbox()),
    ({ nudges }) => nudges,
  );
  return Effect.repeat(unread, { until: (nudges) => nudges.length >= count });
}

function idOf(nudges: readonly Nudge[], index: number): NudgeId {
  return Option.getOrThrow(Option.map(Arr.get(nudges, index), ({ id }) => id));
}

function watching(client: CookoutClient): Effect.Effect<AsyncIterator<CookoutEvent>, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch()),
      (events: EventStream) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

function eventIn(next: Readonly<IteratorResult<CookoutEvent>>): CookoutEvent | null {
  if (next.done === true) {
    return null;
  }
  return next.value;
}

function nextNudgeRead(events: AsyncIterator<CookoutEvent>): Effect.Effect<CookoutEvent | null> {
  const next = answer(() => events.next());
  return Effect.map(
    Effect.repeat(next, {
      until: (heard: Readonly<IteratorResult<CookoutEvent>>) =>
        heard.done === true || heard.value.type === "nudge-read",
    }),
    eventIn,
  );
}

interface Raised {
  readonly ada: TestIdentity;
  readonly bob: TestIdentity;
  readonly adas: readonly Nudge[];
  readonly bobs: readonly Nudge[];
}

const raised: Effect.Effect<Raised, never, TestCookout> = Effect.gen(function* raiseNudges() {
  const { ada, bob } = yield* board;
  yield* Effect.andThen(post(ada, "who owns the release notes?"), post(ada, "who owns the changelog?"));
  yield* post(bob, "who owns the roadmap?");
  yield* Effect.andThen(settled, TestClock.adjust("4 days"));
  const adas = yield* nudgesOnceThere(ada.client, TWO);
  const bobs = yield* nudgesOnceThere(bob.client, ONE);
  return { ada, adas, bob, bobs };
});

it.effect.each(storageKinds)(
  "marking a nudge read, one or all, sends nudge-read naming it to its recipient only (%s)",
  (storage) =>
    Effect.gen(function* markedReadLive() {
      const { ada, adas, bob, bobs } = yield* raised;
      const [adaEvents, bobEvents] = yield* Effect.all([watching(ada.client), watching(bob.client)], {
        concurrency: 1,
      });
      yield* Effect.andThen(
        settled,
        answer(() => ada.client.markNudgeRead(idOf(adas, OLDEST))),
      );
      const one = yield* nextNudgeRead(adaEvents);
      yield* answer(() => ada.client.ackAll({ nudgesUpTo: idOf(adas, NEWEST) }));
      const all = yield* nextNudgeRead(adaEvents);
      yield* answer(() => bob.client.ackAll({ nudgesUpTo: idOf(bobs, OLDEST) }));
      const bobsFirst = yield* nextNudgeRead(bobEvents);

      expect([one, all, bobsFirst]).toStrictEqual([
        { nudgeIds: [idOf(adas, OLDEST)], type: "nudge-read" },
        { nudgeIds: [idOf(adas, NEWEST)], type: "nudge-read" },
        { nudgeIds: [idOf(bobs, OLDEST)], type: "nudge-read" },
      ]);
    }).pipe(Effect.scoped, Effect.provide(testCookout({ storage }))),
);
