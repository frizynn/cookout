import { Array as Arr, Effect, Fiber, Option } from "effect";
import type { CookoutClient, CookoutEvent, EventStream, JoinRequest, Presence } from "../../index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";

const AGENT = "triage";
const HUMAN = { kind: "human" } as const;
const AS_AGENT: JoinRequest = { as: AGENT };
const GRACE = "60 seconds";
const DROPPED_AT = "2026-01-01T00:00:00.000Z";

type Feed = AsyncIterator<CookoutEvent, unknown>;
type Scoped = Effect.Effect<void, never, Scope.Scope>;

interface Board {
  readonly cookout: TestCookoutService;
  readonly matt: TestIdentity;
  readonly ada: TestIdentity;
}

const board: Effect.Effect<Board, never, TestCookout> = Effect.gen(function* mattHisAgentAndAda() {
  const cookout = yield* TestCookout;
  const matt = yield* cookout.createIdentity("matt", HUMAN);
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* cookout.createIdentity(AGENT, { owner: "matt" });
  return { ada, cookout, matt };
});

function joinedSession({ cookout, matt }: Board, asked: JoinRequest = AS_AGENT): Effect.Effect<CookoutClient> {
  return Effect.map(
    answer(() => matt.client.join(asked)),
    ({ agentSessionToken }) => cookout.clientFor(agentSessionToken),
  );
}

function watching(client: CookoutClient): Effect.Effect<EventStream, never, Scope.Scope> {
  return Effect.gen(function* watchUntilConnected() {
    const connected = Promise.withResolvers<null>();
    const events = yield* answer(() =>
      client.watch({
        onConnected: () => {
          connected.resolve(null);
        },
      }),
    );
    const iterator = events[Symbol.asyncIterator]();
    yield* Effect.forkScoped(Effect.ignore(answer(() => iterator.next())));
    yield* answer(() => connected.promise);
    return events;
  });
}

function feedOf(client: CookoutClient): Effect.Effect<Feed, never, Scope.Scope> {
  return Effect.map(
    Effect.acquireRelease(
      answer(() => client.watch({ allChannels: true })),
      (events) => answer(() => events.close()),
    ),
    (events) => events[Symbol.asyncIterator](),
  );
}

function eventIn(next: Readonly<IteratorResult<CookoutEvent, unknown>>): CookoutEvent | null {
  if (next.done === true) {
    return null;
  }
  return next.value;
}

function isAgentsPresenceOrEnd(event: CookoutEvent | null): boolean {
  return event === null || (event.type === "presence" && event.presence.identity === AGENT);
}

function nextAgentPresenceEvent(feed: Feed): Effect.Effect<CookoutEvent | null> {
  return answer(() => feed.next()).pipe(Effect.map(eventIn), Effect.repeat({ until: isAgentsPresenceOrEnd }));
}

function presenceOf(client: CookoutClient): Effect.Effect<Presence | undefined> {
  return Effect.map(
    answer(() => client.presence()),
    ({ presence }) => Option.getOrUndefined(Arr.findFirst(presence, ({ identity }) => identity === AGENT)),
  );
}

function everyonesView({ ada, cookout, matt }: Board): Effect.Effect<readonly (Presence | undefined)[]> {
  return Effect.all([presenceOf(matt.client), presenceOf(ada.client), presenceOf(cookout.client)], {
    concurrency: 1,
  });
}

function dropped(watched: Board, session: CookoutClient, events: EventStream): Scoped {
  return Effect.gen(function* dropThenWaitOutTheGrace() {
    yield* answer(() => events.close());
    yield* watched.cookout.liveConnectionsClosed(AGENT);
    yield* TestClock.adjust(GRACE);
  });
}

type Heard = Fiber.Fiber<readonly (CookoutEvent | null)[]>;

function hearingMattAndAda({ ada, matt }: Board): Effect.Effect<Heard, never, Scope.Scope> {
  return Effect.gen(function* hearBoth() {
    const mattsFeed = yield* feedOf(matt.client);
    const adasFeed = yield* feedOf(ada.client);
    const both = [nextAgentPresenceEvent(mattsFeed), nextAgentPresenceEvent(adasFeed)] as const;
    return yield* Effect.forkChild(Effect.all(both, { concurrency: "unbounded" }));
  });
}

const offline = { identity: AGENT, lastSeenAt: DROPPED_AT, offlineReason: "connection lost", online: false };

it.effect("after an unexpected end, only the agent's owner reads a warning on its presence, live and in the read", () =>
  Effect.gen(function* warnedOwner() {
    const watched = yield* board;
    const session = yield* joinedSession(watched);
    const events = yield* watching(session);
    const hearing = yield* hearingMattAndAda(watched);
    yield* dropped(watched, session, events);
    const heard = yield* Fiber.join(hearing);
    const views = yield* everyonesView(watched);

    expect(heard).toStrictEqual([
      { presence: { ...offline, warning: true }, type: "presence" },
      { presence: offline, type: "presence" },
    ]);
    expect(views).toStrictEqual([{ ...offline, warning: true }, offline, offline]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("the warning clears when the agent next has a live connection, with a presence event to its owner", () =>
  Effect.gen(function* warningCleared() {
    const watched = yield* board;
    const session = yield* joinedSession(watched);
    const events = yield* watching(session);
    yield* dropped(watched, session, events);
    const heard = yield* Effect.flatMap(feedOf(watched.matt.client), (feed) =>
      Effect.forkChild(nextAgentPresenceEvent(feed)),
    );
    yield* watching(session);
    const event = yield* Fiber.join(heard);
    const presence = yield* presenceOf(watched.matt.client);

    expect(event).toStrictEqual({
      presence: { connection: { via: "watch" }, identity: AGENT, online: true },
      type: "presence",
    });
    expect(presence).toStrictEqual({ connection: { via: "watch" }, identity: AGENT, online: true });
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

interface Ending {
  readonly how: string;
  readonly end: (watched: Board, session: CookoutClient, events: EventStream) => Scoped;
}

function left(_watched: Board, session: CookoutClient): Scoped {
  return answer(() => session.leave());
}

function closedCleanly(_watched: Board, _session: CookoutClient, events: EventStream): Scoped {
  return answer(() => events.closeCleanly());
}

function takenOver(watched: Board): Scoped {
  return Effect.asVoid(joinedSession(watched, { as: AGENT, force: true }));
}

it.effect.each<Ending>([
  { end: left, how: "leave" },
  { end: closedCleanly, how: "a clean close" },
  { end: takenOver, how: "a join --force takeover" },
])("$how sets no warning", ({ end }) =>
  Effect.gen(function* expectedEnd() {
    const watched = yield* board;
    const session = yield* joinedSession(watched);
    const events = yield* watching(session);
    yield* end(watched, session, events);
    yield* TestClock.adjust("2 minutes");
    const presence = yield* presenceOf(watched.matt.client);

    expect(presence).not.toHaveProperty("warning");
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);
