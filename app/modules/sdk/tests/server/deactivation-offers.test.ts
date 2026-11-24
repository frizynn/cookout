import { Array as Arr, DateTime, Duration, Effect, Option, Order } from "effect";
import type {
  CookoutClient,
  CookoutEvent,
  DeactivationOffer,
  DeactivationOfferId,
  EventStream,
  Message,
} from "../../index.ts";
import { TestCookout, answer, refusal, testCookout, testStartTime } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";

type Wait = `${number} days` | `${number} millis`;

interface Summary {
  readonly agent: string;
  readonly cleared: boolean;
  readonly quietDays: number;
}

const HUMAN = { kind: "human" } as const;
const ADMIN = { admin: true, kind: "human" } as const;
const ONE = 1;
const FIVE = 5;
const SIXTY = 60;
const SETTLE = "30 millis";
const JUST_UNDER_THIRTY_DAYS = "2591999999 millis";
const TEXT = "@ada/scout has had no activity for 30 days. Deactivate it?";

const board = Effect.gen(function* openBoard() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const bob = yield* cookout.createIdentity("bob", HUMAN);
  const scout = yield* cookout.createIdentity("ada/scout", { owner: "ada" });
  yield* answer(() => ada.client.createChannel({ name: "grill" }));
  return { ada, bob, cookout, scout };
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

function offersAnAgent({ identity }: DeactivationOffer): boolean {
  return identity.kind === "agent";
}

function openOffers(client: CookoutClient): Effect.Effect<readonly DeactivationOffer[]> {
  return Effect.map(
    answer(() => client.inbox()),
    ({ deactivationOffers }) => Arr.filter(deactivationOffers, offersAnAgent),
  );
}

function offersOnceThere(client: CookoutClient, count: number): Effect.Effect<readonly DeactivationOffer[]> {
  return Effect.repeat(openOffers(client), { until: (offers) => offers.length >= count });
}

function summaryOf({ cleared, identity, quietDays }: DeactivationOffer): Summary {
  return { agent: identity.name, cleared, quietDays };
}

function history(client: CookoutClient): Effect.Effect<readonly Summary[]> {
  return Effect.map(
    answer(() => client.inboxHistory()),
    ({ deactivationOffers }) => Arr.map(Arr.filter(deactivationOffers, offersAnAgent), summaryOf),
  );
}

function later(at: string, wait: Wait): string {
  return DateTime.formatIso(DateTime.addDuration(DateTime.makeUnsafe(at), Duration.fromInputUnsafe(wait)));
}

function idOf(offers: readonly DeactivationOffer[]): DeactivationOfferId {
  return Option.getOrThrow(Option.map(Arr.head(offers), ({ id }) => id));
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

function nextOfferEvent(events: AsyncIterator<CookoutEvent>): Effect.Effect<CookoutEvent | null> {
  const next = answer(() => events.next());
  return Effect.map(
    Effect.repeat(next, {
      until: (heard: Readonly<IteratorResult<CookoutEvent>>) =>
        heard.done === true ||
        (heard.value.type === "deactivation-offer" && offersAnAgent(heard.value.deactivationOffer)),
    }),
    eventIn,
  );
}

const fourMoreAgents = Effect.gen(function* openFourMoreAgents() {
  const { ada, cookout } = yield* board;
  const thread = yield* post(ada, "who owns the release notes?");
  function agent(name: string): Effect.Effect<TestIdentity> {
    return cookout.createIdentity(name, { owner: "ada" });
  }
  const [poster, replier, reactor, watcher] = yield* Effect.all(
    [agent("ada/poster"), agent("ada/replier"), agent("ada/reactor"), agent("ada/watcher")],
    { concurrency: 1 },
  );
  const act = Effect.all(
    [
      post(poster, "still on it"),
      answer(() => replier.client.createMessage({ channel: "grill", replyTo: thread.id, text: "me" })),
      answer(() => reactor.client.react(thread.id, "thumbs_up")),
      Effect.flatMap(
        answer(() => watcher.client.watch()),
        (events) => answer(() => events.close()),
      ),
    ],
    { concurrency: 1 },
  );
  return { act: Effect.asVoid(act), ada };
});

interface Back {
  readonly back: Message;
  readonly live: CookoutEvent | null;
}

function postWhileWatching(owner: TestIdentity, agent: TestIdentity): Effect.Effect<Back> {
  return Effect.scoped(
    Effect.gen(function* postAndHear() {
      const events = yield* watching(owner.client);
      const back = yield* post(agent, "back from leave");
      const live = yield* nextOfferEvent(events);
      return { back, live };
    }),
  );
}

it.effect("an agent quiet for 30 days raises one offer for its owner, live and in the inbox, and nobody else", () =>
  Effect.gen(function* quietThirtyDays() {
    const { ada, bob, cookout } = yield* board;
    const justUnder = yield* Effect.andThen(quietFor(JUST_UNDER_THIRTY_DAYS), openOffers(ada.client));
    const events = yield* watching(ada.client);
    const live = yield* Effect.andThen(quietFor("1 millis"), nextOfferEvent(events));
    const listed = yield* offersOnceThere(ada.client, ONE);
    const others = yield* Effect.all([openOffers(bob.client), openOffers(cookout.client)], { concurrency: 1 });

    expect([justUnder, others]).toStrictEqual([[], [[], []]]);
    expect(live).toMatchObject({
      deactivationOffer: { cleared: false, identity: { name: "ada/scout" }, quietDays: 30, text: TEXT },
      type: "deactivation-offer",
    });
    expect(listed).toMatchObject([
      { cleared: false, identity: { name: "ada/scout" }, raisedAt: later(testStartTime, "30 days"), text: TEXT },
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("a post, a reply, a reaction and opening a watch each hold off the offer", () =>
  Effect.gen(function* heldOff() {
    const { act, ada } = yield* fourMoreAgents;
    yield* Effect.andThen(quietFor("20 days"), act);
    const atThirty = yield* Effect.andThen(quietFor("10 days"), offersOnceThere(ada.client, ONE));
    const atFifty = yield* Effect.andThen(quietFor("21 days"), offersOnceThere(ada.client, FIVE));

    expect(Arr.map(atThirty, ({ identity }) => identity.name)).toStrictEqual(["ada/scout"]);
    expect(
      Arr.sort(
        Arr.map(atFifty, ({ identity }) => identity.name),
        Order.String,
      ),
    ).toStrictEqual(["ada/poster", "ada/reactor", "ada/replier", "ada/scout", "ada/watcher"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("activity after the offer clears it, live, and restarts the clock", () =>
  Effect.gen(function* activityClears() {
    const { ada, scout } = yield* board;
    yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
    const { back, live } = yield* Effect.andThen(quietFor("1 days"), postWhileWatching(ada, scout));
    const open = yield* openOffers(ada.client);
    const early = yield* Effect.andThen(quietFor("29 days"), openOffers(ada.client));
    const again = yield* Effect.andThen(quietFor("1 days"), offersOnceThere(ada.client, ONE));

    expect([live, open, early]).toMatchObject([
      { deactivationOffer: { cleared: true, identity: { name: "ada/scout" } }, type: "deactivation-offer" },
      [],
      [],
    ]);
    expect(again).toMatchObject([{ quietDays: 30, raisedAt: later(back.createdAt, "30 days") }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("Keep clears the offer and the next comes 30 days later; an ignored one is replaced by the next", () =>
  Effect.gen(function* keepAndIgnore() {
    const { ada, bob } = yield* board;
    const first = yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
    const notBobs = yield* refusal(() => bob.client.keepDeactivationOffer(idOf(first)));
    const kept = yield* answer(() => ada.client.keepDeactivationOffer(idOf(first)));
    const afterKeep = yield* openOffers(ada.client);
    const second = yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
    const ignored = yield* history(ada.client);

    expect([notBobs.code, kept.deactivationOffer.cleared, afterKeep]).toStrictEqual([
      "deactivation_offer_not_found",
      true,
      [],
    ]);
    expect(second).toMatchObject([{ quietDays: SIXTY, raisedAt: later(testStartTime, "60 days") }]);
    expect(ignored).toStrictEqual([
      { agent: "ada/scout", cleared: false, quietDays: SIXTY },
      { agent: "ada/scout", cleared: true, quietDays: 30 },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect(
  "an ignored offer is replaced 30 days on, so the owner has one, and at 90 days the agent is deactivated instead",
  () =>
    Effect.gen(function* replaced() {
      const { ada } = yield* board;
      yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
      yield* quietFor("30 days");
      const open = yield* Effect.repeat(openOffers(ada.client), {
        until: (offers) => Arr.some(offers, ({ quietDays }) => quietDays === SIXTY),
      });
      yield* quietFor("30 days");
      const atNinety = yield* Effect.repeat(history(ada.client), { until: Arr.every(({ cleared }) => cleared) });

      expect(Arr.map(open, summaryOf)).toStrictEqual([{ agent: "ada/scout", cleared: false, quietDays: SIXTY }]);
      expect(atNinety).toStrictEqual([
        { agent: "ada/scout", cleared: true, quietDays: SIXTY },
        { agent: "ada/scout", cleared: true, quietDays: 30 },
      ]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("marking all as read clears an offer as Keep does", () =>
  Effect.gen(function* markAll() {
    const { ada } = yield* board;
    const first = yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
    yield* answer(() => ada.client.ackAll({ deactivationOffersUpTo: idOf(first) }));
    const after = yield* openOffers(ada.client);
    const next = yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));

    expect([after, Arr.map(next, ({ quietDays }) => quietDays)]).toStrictEqual([[], [SIXTY]]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("deactivating the agent clears its offer, and a Deactivated agent gets none", () =>
  Effect.gen(function* deactivationClears() {
    const { ada, cookout } = yield* board;
    const helper = yield* cookout.createIdentity("ada/helper", { owner: "ada" });
    yield* answer(() => ada.client.deactivateIdentity(helper.identity.name));
    yield* Effect.andThen(quietFor("30 days"), offersOnceThere(ada.client, ONE));
    yield* answer(() => ada.client.deactivateIdentity("ada/scout"));
    const open = yield* openOffers(ada.client);
    const all = yield* Effect.andThen(quietFor("30 days"), history(ada.client));

    expect([open, all]).toStrictEqual([[], [{ agent: "ada/scout", cleared: true, quietDays: 30 }]]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("an offer about an agent whose owner is Deactivated goes to every active admin, and one Keep clears it", () =>
  Effect.gen(function* toAdmins() {
    const { ada, cookout } = yield* board;
    const cy = yield* cookout.createIdentity("cy", ADMIN);
    yield* answer(() => cookout.client.deactivateIdentity(ada.identity.name));
    const [admins, cys] = yield* Effect.andThen(
      quietFor("30 days"),
      Effect.all([offersOnceThere(cookout.client, ONE), offersOnceThere(cy.client, ONE)], { concurrency: 1 }),
    );
    yield* answer(() => cy.client.keepDeactivationOffer(idOf(cys)));
    const after = yield* Effect.all([openOffers(cookout.client), openOffers(cy.client)], { concurrency: 1 });

    expect([idOf(admins), Arr.map(cys, ({ identity }) => identity.name)]).toStrictEqual([idOf(cys), ["ada/scout"]]);
    expect(after).toStrictEqual([[], []]);
  }).pipe(Effect.provide(testCookout())),
);
