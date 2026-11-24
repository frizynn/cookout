import { Array as Arr, Effect, Option } from "effect";
import type { CookoutClient, DeactivationOfferId, EventStream } from "../../../sdk/index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { inDialog, inPane, inSidebar } from "../regions.ts";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { openAt } from "../render.tsx";
import { watched } from "../watched.ts";

const OFFER = "@ada/scout has had no activity for 30 days. Deactivate it?";
const EARLIER = "Earlier deactivation offers";
const SETTLE = "30 millis";
const HUMAN = { kind: "human" } as const;
const ADMIN = { admin: true, kind: "human" } as const;

interface Offered {
  readonly ada: TestIdentity;
  readonly scout: TestIdentity;
}

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function quietFor(wait: "1 days" | "29 days"): Effect.Effect<void> {
  return Effect.andThen(Effect.andThen(settled, TestClock.adjust(wait)), settled);
}

function inboxOpenFor(client: CookoutClient): Effect.Effect<void, never, Scope.Scope> {
  return Effect.gen(function* openInbox() {
    const { live, stream } = watched(client);
    openAt({ client, hash: "#/inbox", live });
    yield* Effect.acquireRelease(
      answer(() => stream),
      (events: EventStream) => answer(() => events.close()),
    );
    yield* answer(() => screen.findByText("Nothing read yet."));
  });
}

const offeredLive: Effect.Effect<Offered, never, TestCookout | Scope.Scope> = Effect.gen(function* offerToAda() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  const scout = yield* cookout.createIdentity("ada/scout", { owner: "ada" });
  yield* answer(() => ada.client.createChannel({ name: "grill" }));
  yield* quietFor("29 days");
  yield* inboxOpenFor(ada.client);
  yield* quietFor("1 days");
  yield* answer(() => inPane().findByText(OFFER));
  return { ada, scout };
});

const offeredToAdmins: Effect.Effect<TestIdentity, never, TestCookout | Scope.Scope> = Effect.gen(
  function* offerToAdmins() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("ada/scout", { owner: "ada" });
    const cy = yield* cookout.createIdentity("cy", ADMIN);
    yield* answer(() => cookout.client.deactivateIdentity(ada.identity.name));
    yield* quietFor("29 days");
    yield* inboxOpenFor(cookout.client);
    yield* quietFor("1 days");
    yield* answer(() => inPane().findByText(OFFER));
    return cy;
  },
);

function textsOf(elements: Iterable<Readonly<{ textContent: string }>>): readonly string[] {
  const texts: string[] = [];
  for (const element of elements) {
    texts.push(element.textContent);
  }
  return texts;
}

function inboxCounts(): readonly string[] {
  const link = inSidebar().getByRole("link", { name: /^Inbox/u });
  return textsOf(within(link).queryAllByText(/^\d+ (?:unread|for you)$/u));
}

function forYouRows(): readonly string[] {
  const list = screen.queryByRole("list", { name: "For you" });
  if (list === null) {
    return [];
  }
  return textsOf(within(list).getAllByRole("listitem"));
}

function earlierOffers(): readonly string[] {
  const list = screen.queryByRole("list", { name: EARLIER });
  if (list === null) {
    return [];
  }
  return textsOf(within(list).getAllByRole("listitem"));
}

function clickInForYou(name: string): void {
  fireEvent.click(within(screen.getByRole("list", { name: "For you" })).getByRole("button", { name }));
}

function openOfferIds(client: CookoutClient): Effect.Effect<readonly DeactivationOfferId[]> {
  return Effect.map(
    answer(() => client.inbox()),
    ({ deactivationOffers }) => Arr.map(deactivationOffers, ({ id }) => id),
  );
}

const caughtUp = answer(() => inPane().findByText("You're all caught up."));

const earlierShown = answer(() => screen.findByRole("list", { name: EARLIER }));

it.effect("after 30 quiet days the owner's inbox shows the offer under For you and counts it, with no reload", () =>
  Effect.gen(function* offerShows() {
    yield* offeredLive;
    const name = within(screen.getByRole("list", { name: "For you" })).getByRole("link", { name: "ada/scout" });

    expect([
      screen.getByRole("heading", { level: 2, name: "For you 1" }).textContent,
      forYouRows(),
      inboxCounts(),
      name.getAttribute("href"),
    ]).toStrictEqual([
      "For you 1",
      [expect.stringMatching(/@ada\/scout has had no activity for 30 days\. Deactivate it\?.*ada\/scout/u)],
      ["1 for you"],
      "#/inbox?profile=ada/scout",
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Deactivate in an offer row asks first, then deactivates the agent and moves the row to Earlier", () =>
  Effect.gen(function* deactivateInRow() {
    const { ada } = yield* offeredLive;
    clickInForYou("Deactivate");
    const confirm = yield* answer(() => inDialog().findByRole("button", { name: "Deactivate @ada/scout" }));
    const asked = inDialog().getByRole("heading", { name: "Deactivate @ada/scout?" }).textContent;
    fireEvent.click(confirm);
    yield* earlierShown;
    const { identities } = yield* answer(() => ada.client.listIdentities({ include: "deactivated" }));
    const scout = Arr.findFirst(identities, ({ name }) => name === "ada/scout");

    expect([
      asked,
      Option.map(scout, ({ deactivated }) => deactivated),
      forYouRows(),
      inboxCounts(),
      earlierOffers(),
    ]).toStrictEqual(["Deactivate @ada/scout?", Option.some(true), [], [], [expect.stringContaining(OFFER)]]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Keep in an offer row answers Keep, moves the row to Earlier and drops the count", () =>
  Effect.gen(function* keepInRow() {
    const { ada } = yield* offeredLive;
    clickInForYou("Keep");
    yield* caughtUp;
    const open = yield* openOfferIds(ada.client);

    expect([forYouRows(), inboxCounts(), earlierOffers(), open]).toStrictEqual([
      [],
      [],
      [expect.stringContaining(OFFER)],
      [],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Mark all as read clears the offer as Keep does, moving it to Earlier", () =>
  Effect.gen(function* markAll() {
    const { ada } = yield* offeredLive;
    fireEvent.click(inPane().getByRole("button", { name: "Mark all as read" }));
    yield* caughtUp;
    const open = yield* openOfferIds(ada.client);

    expect([forYouRows(), inboxCounts(), earlierOffers(), open]).toStrictEqual([
      [],
      [],
      [expect.stringContaining(OFFER)],
      [],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("the agent posting clears its offer row live", () =>
  Effect.gen(function* postClears() {
    const { scout } = yield* offeredLive;
    yield* TestClock.adjust("1 minute");
    yield* answer(() => scout.client.createMessage({ channel: "grill", text: "Still here" }));
    yield* earlierShown;

    expect([forYouRows(), earlierOffers()]).toStrictEqual([[], [expect.stringContaining(OFFER)]]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect(
  "an admin sees the shared offer about an agent whose owner is Deactivated, and another admin's Keep clears it live",
  () =>
    Effect.gen(function* sharedOffer() {
      const cy = yield* offeredToAdmins;
      const counted = inboxCounts();
      const [id = null] = yield* openOfferIds(cy.client);
      if (id !== null) {
        yield* answer(() => cy.client.keepDeactivationOffer(id));
      }
      yield* caughtUp;

      expect([counted, forYouRows(), inboxCounts(), earlierOffers()]).toStrictEqual([
        ["1 for you"],
        [],
        [],
        [expect.stringContaining(OFFER)],
      ]);
    }).pipe(Effect.scoped, Effect.provide(testCookout())),
);
