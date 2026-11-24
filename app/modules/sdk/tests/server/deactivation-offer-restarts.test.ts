import { Array as Arr, DateTime, Duration, Effect } from "effect";
import type { CookoutClient, DeactivationOffer } from "../../index.ts";
import { TestCookout, answer, isoTime, testCookout, testStartTime } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { createCookoutClient } from "../../index.ts";

type Wait = `${number} days` | `${number} millis`;

const HUMAN = { kind: "human" } as const;
const ONE = 1;
const SETTLE = "30 millis";
const JUST_UNDER_THIRTY_DAYS = "2591999999 millis";
const LONG_AGO = isoTime("2024-11-27T00:00:00.000Z");

const board = Effect.gen(function* openBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* cookout.createIdentity("ada/scout", { owner: "ada" });
  return { ada, cookout };
});

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function quietFor(wait: Wait): Effect.Effect<void> {
  return Effect.andThen(Effect.andThen(settled, TestClock.adjust(wait)), settled);
}

function openOffers(client: CookoutClient): Effect.Effect<readonly DeactivationOffer[]> {
  return Effect.map(
    answer(() => client.inbox()),
    ({ deactivationOffers }) => deactivationOffers,
  );
}

function offersOnceThere(client: CookoutClient): Effect.Effect<readonly DeactivationOffer[]> {
  return Effect.repeat(openOffers(client), { until: (offers) => offers.length >= ONE });
}

function historyCount(client: CookoutClient): Effect.Effect<number> {
  return Effect.map(
    answer(() => client.inboxHistory()),
    ({ deactivationOffers }) => deactivationOffers.length,
  );
}

function later(wait: Wait): string {
  return DateTime.formatIso(DateTime.addDuration(DateTime.makeUnsafe(testStartTime), Duration.fromInputUnsafe(wait)));
}

function clientAt(url: string, who: TestIdentity): CookoutClient {
  return createCookoutClient({ env: {}, token: who.token, url });
}

it.effect(
  "a server restarted before an offer is due raises it on time, once, and a restart after doesn't repeat it",
  () =>
    Effect.gen(function* restartBefore() {
      const { ada, cookout } = yield* board;
      const { url } = yield* Effect.andThen(quietFor("10 days"), cookout.restartServer);
      const offers = yield* Effect.andThen(quietFor("20 days"), offersOnceThere(clientAt(url, ada)));
      const again = yield* cookout.restartServer;
      const count = yield* Effect.andThen(quietFor("1 days"), historyCount(clientAt(again.url, ada)));

      expect(Arr.map(offers, ({ raisedAt }) => raisedAt)).toStrictEqual([later("30 days")]);
      expect(count).toBe(ONE);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("an offer that fell due while the server was down is raised at boot", () =>
  Effect.gen(function* dueWhileDown() {
    const { ada, cookout } = yield* board;
    const { url } = yield* cookout.restartServerAfter(TestClock.adjust("40 days"));
    const offers = yield* offersOnceThere(clientAt(url, ada));

    expect(offers).toMatchObject([{ identity: { name: "ada/scout" }, quietDays: 30, raisedAt: later("40 days") }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("identities that exist when activity began raise no offer for 30 days after it", () =>
  Effect.gen(function* beforeActivity() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("ada/old", { createdAt: LONG_AGO, owner: "ada" });
    const justUnder = yield* Effect.andThen(quietFor(JUST_UNDER_THIRTY_DAYS), openOffers(ada.client));
    const offers = yield* Effect.andThen(quietFor("1 millis"), offersOnceThere(ada.client));

    expect(justUnder).toStrictEqual([]);
    expect(offers).toMatchObject([{ identity: { name: "ada/old" }, raisedAt: later("30 days") }]);
  }).pipe(Effect.provide(testCookout())),
);
