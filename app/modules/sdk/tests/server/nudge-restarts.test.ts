import { Array as Arr, DateTime, Duration, Effect } from "effect";
import type { CookoutClient, Message, Nudge } from "../../index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { createCookoutClient } from "../../index.ts";

type Wait = `${number} days` | `${number} millis`;

interface HistoryEntry {
  readonly kind: string;
  readonly read: boolean;
}

const HUMAN = { kind: "human" } as const;
const ONE = 1;
const SETTLE = "30 millis";

const board = Effect.gen(function* openBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* answer(() => ada.client.createChannel({ name: "grill" }));
  return { ada, cookout };
});

function post(who: TestIdentity, text: string): Effect.Effect<Message> {
  return Effect.map(
    answer(() => who.client.createMessage({ channel: "grill", text })),
    ({ message }) => message,
  );
}

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function quietFor(wait: Wait): Effect.Effect<void> {
  return Effect.andThen(Effect.andThen(settled, TestClock.adjust(wait)), settled);
}

function nudgesOnceThere(client: CookoutClient, count: number): Effect.Effect<readonly Nudge[]> {
  const unread = Effect.map(
    answer(() => client.inbox()),
    ({ nudges }) => nudges,
  );
  return Effect.repeat(unread, { until: (nudges) => nudges.length >= count });
}

function historyNudges(client: CookoutClient): Effect.Effect<readonly HistoryEntry[]> {
  return Effect.map(
    answer(() => client.inboxHistory()),
    ({ nudges }) => Arr.map(nudges, ({ kind, read }) => ({ kind, read })),
  );
}

function later(at: string, wait: Wait): string {
  return DateTime.formatIso(DateTime.addDuration(DateTime.makeUnsafe(at), Duration.fromInputUnsafe(wait)));
}

function clientAt(url: string, who: TestIdentity): CookoutClient {
  return createCookoutClient({ env: {}, token: who.token, url });
}

it.effect(
  "a server restarted before a nudge is due raises it on time, once, and a restart after doesn't repeat it",
  () =>
    Effect.gen(function* restartBefore() {
      const { ada, cookout } = yield* board;
      const thread = yield* post(ada, "who owns the release notes?");
      const { url } = yield* Effect.andThen(quietFor("1 days"), cookout.restartServer);
      const nudges = yield* Effect.andThen(quietFor("2 days"), nudgesOnceThere(clientAt(url, ada), ONE));
      const again = yield* cookout.restartServer;
      const history = yield* Effect.andThen(quietFor("1 days"), historyNudges(clientAt(again.url, ada)));

      expect(nudges).toMatchObject([{ raisedAt: later(thread.createdAt, "3 days") }]);
      expect(history).toStrictEqual([{ kind: "first", read: false }]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("a nudge that fell due while the server was down is raised at boot", () =>
  Effect.gen(function* dueWhileDown() {
    const { ada, cookout } = yield* board;
    const thread = yield* post(ada, "who owns the release notes?");
    const { url } = yield* cookout.restartServerAfter(TestClock.adjust("4 days"));
    const nudges = yield* nudgesOnceThere(clientAt(url, ada), ONE);

    expect(nudges).toMatchObject([{ kind: "first", raisedAt: later(thread.createdAt, "4 days") }]);
  }).pipe(Effect.provide(testCookout())),
);
