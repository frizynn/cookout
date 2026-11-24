import { Array as Arr, Effect, Option } from "effect";
import type { CookoutClient, DeactivatedQuietAgentId, EventStream } from "../../../sdk/index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { inDialog, inPane, inSidebar } from "../regions.ts";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { cuttable } from "../cuttable.ts";
import { openAt } from "../render.tsx";
import { watched } from "../watched.ts";

const ENTRY = "@triage-agent was deactivated after 90 days with no activity.";
const EARLIER = "Earlier deactivated agents";
const FOR_YOU = "For you";
const SETTLE = "30 millis";
const HUMAN = { kind: "human" } as const;
const ZERO = 0;

const settled: Effect.Effect<void> = TestClock.withLive(Effect.sleep(SETTLE));

function quietFor(wait: "1 hour" | "2159 hours"): Effect.Effect<void> {
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

const deactivatedLive: Effect.Effect<TestIdentity, never, TestCookout | Scope.Scope> = Effect.gen(
  function* deactivateQuietAgent() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("triage-agent", { owner: "ada" });
    yield* answer(() => ada.client.createChannel({ name: "grill" }));
    yield* quietFor("2159 hours");
    yield* inboxOpenFor(ada.client);
    yield* quietFor("1 hour");
    yield* answer(() => inPane().findByText(ENTRY));
    return ada;
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

function rowsIn(label: string): readonly string[] {
  const list = screen.queryByRole("list", { name: label });
  if (list === null) {
    return [];
  }
  return textsOf(within(list).getAllByRole("listitem"));
}

function clickInForYou(name: string): void {
  fireEvent.click(within(screen.getByRole("list", { name: FOR_YOU })).getByRole("button", { name }));
}

function unreadIds(client: CookoutClient): Effect.Effect<readonly DeactivatedQuietAgentId[]> {
  return Effect.map(
    answer(() => client.inbox()),
    ({ deactivatedQuietAgents }) => Arr.map(deactivatedQuietAgents, ({ id }) => id),
  );
}

function activeOf(client: CookoutClient): Effect.Effect<Option.Option<boolean>> {
  return Effect.map(
    answer(() => client.listIdentities({ include: "deactivated" })),
    ({ identities }) =>
      Option.map(
        Arr.findFirst(identities, ({ name }) => name === "triage-agent"),
        ({ deactivated }) => deactivated !== true,
      ),
  );
}

const caughtUp = answer(() => inPane().findByText("You're all caught up."));

it.effect("after 90 quiet days the owner's inbox shows the entry under For you and counts it, with no reload", () =>
  Effect.gen(function* entryShows() {
    yield* deactivatedLive;
    const name = within(screen.getByRole("list", { name: FOR_YOU })).getByRole("link", { name: "triage-agent" });

    expect([
      screen.getByRole("heading", { level: 2, name: "For you 1" }).textContent,
      rowsIn(FOR_YOU),
      inboxCounts(),
      name.getAttribute("href"),
    ]).toStrictEqual([
      "For you 1",
      [expect.stringMatching(/^@triage-agent was deactivated after 90 days with no activity\..*triage-agent/u)],
      ["1 for you"],
      "#/inbox?profile=triage-agent",
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

function buttonsIn(label: string): readonly string[] {
  return textsOf(within(screen.getByRole("list", { name: label })).getAllByRole("button"));
}

function reactivatedInRow(client: CookoutClient): Effect.Effect<HTMLElement> {
  return Effect.gen(function* reactivateInRow() {
    clickInForYou("Reactivate");
    const confirm = yield* answer(() => inDialog().findByRole("button", { name: "Reactivate @triage-agent" }));
    fireEvent.click(confirm);
    const token = yield* answer(() => inPane().findByRole("button", { name: "Copy token" }));
    yield* Effect.repeat(unreadIds(client), { until: (ids) => ids.length === ZERO });
    yield* settled;
    return token;
  });
}

it.effect("Reactivate in the row asks first, shows a fresh token once and keeps the row in For you, uncounted", () =>
  Effect.gen(function* reactivateInRow() {
    const ada = yield* deactivatedLive;
    const token = yield* reactivatedInRow(ada.client);
    const active = yield* activeOf(ada.client);

    expect([
      token.textContent,
      active,
      rowsIn(FOR_YOU),
      buttonsIn(FOR_YOU),
      inboxCounts(),
      screen.getByRole("heading", { level: 2, name: /^For you/u }).textContent,
      rowsIn(EARLIER),
    ]).toStrictEqual([
      "Copy token",
      Option.some(true),
      [expect.stringMatching(/^@triage-agent was deactivated.*cookout_test_\w+Copy it now: it isn't shown again/u)],
      ["Copy token", "Done"],
      [],
      "For you",
      [],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Done after Reactivate moves the row to Earlier without the token", () =>
  Effect.gen(function* doneAfterReactivate() {
    const ada = yield* deactivatedLive;
    yield* reactivatedInRow(ada.client);
    clickInForYou("Done");
    yield* caughtUp;

    expect([
      rowsIn(FOR_YOU),
      inboxCounts(),
      rowsIn(EARLIER),
      inPane().queryByRole("button", { name: "Copy token" }),
    ]).toStrictEqual([[], [], [expect.stringContaining(ENTRY)], null]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Mark read in the row moves it to Earlier and drops the count", () =>
  Effect.gen(function* markReadInRow() {
    const ada = yield* deactivatedLive;
    clickInForYou("Mark read");
    yield* caughtUp;
    const unread = yield* unreadIds(ada.client);

    expect([rowsIn(FOR_YOU), inboxCounts(), rowsIn(EARLIER), unread]).toStrictEqual([
      [],
      [],
      [expect.stringContaining(ENTRY)],
      [],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("Mark all as read reads the entry, moving it to Earlier", () =>
  Effect.gen(function* markAll() {
    const ada = yield* deactivatedLive;
    fireEvent.click(inPane().getByRole("button", { name: "Mark all as read" }));
    yield* caughtUp;
    const unread = yield* unreadIds(ada.client);

    expect([rowsIn(FOR_YOU), inboxCounts(), rowsIn(EARLIER), unread]).toStrictEqual([
      [],
      [],
      [expect.stringContaining(ENTRY)],
      [],
    ]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

it.effect("a second tab drops the row from For you as soon as another session's Reactivate reads the entry", () =>
  Effect.gen(function* reactivateElsewhere() {
    const ada = yield* deactivatedLive;
    yield* answer(() => ada.client.reactivateIdentity("triage-agent"));
    yield* caughtUp;

    expect([rowsIn(FOR_YOU), inboxCounts(), rowsIn(EARLIER)]).toStrictEqual([[], [], [expect.stringContaining(ENTRY)]]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);

const deactivated: Effect.Effect<TestIdentity, never, TestCookout> = Effect.gen(function* deactivateUnwatched() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* cookout.createIdentity("triage-agent", { owner: "ada" });
  yield* Effect.andThen(quietFor("2159 hours"), quietFor("1 hour"));
  yield* Effect.repeat(unreadIds(ada.client), { until: (ids) => ids.length > ZERO });
  return ada;
});

function readOldest(client: CookoutClient): Effect.Effect<void> {
  return Effect.gen(function* readFirst() {
    const [oldest = null] = yield* unreadIds(client);
    if (oldest !== null) {
      yield* answer(() => client.markDeactivatedQuietAgentRead(oldest));
    }
  });
}

function refusingMarkRead(client: CookoutClient): CookoutClient {
  return { ...client, markDeactivatedQuietAgentRead: () => Promise.reject(new Error("refused")) };
}

it.effect("an entry read in another session while the live link was down leaves For you once it is back", () =>
  Effect.gen(function* readWhileDown() {
    const ada = yield* deactivated;
    const { live, report } = cuttable();
    openAt({ client: ada.client, hash: "#/inbox", live });
    yield* answer(() => inPane().findByText(ENTRY));
    report("down");
    yield* readOldest(ada.client);
    report("up");
    yield* caughtUp;

    expect([rowsIn(FOR_YOU), inboxCounts()]).toStrictEqual([[], []]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a refused Mark read keeps the row in For you", () =>
  Effect.gen(function* refusedMarkRead() {
    const ada = yield* deactivated;
    openAt({ client: refusingMarkRead(ada.client), hash: "#/inbox" });
    yield* answer(() => inPane().findByText(ENTRY));
    clickInForYou("Mark read");
    yield* settled;

    expect([rowsIn(FOR_YOU), inboxCounts(), rowsIn(EARLIER)]).toStrictEqual([
      [expect.stringContaining(ENTRY)],
      ["1 for you"],
      [],
    ]);
  }).pipe(Effect.provide(testCookout())),
);

const TWO = 2;

const twoDeactivated: Effect.Effect<TestIdentity, never, TestCookout> = Effect.gen(function* deactivateTwo() {
  const cookout = yield* TestCookout;
  const ada = yield* cookout.createIdentity("ada", HUMAN);
  yield* cookout.createIdentity("triage-agent", { owner: "ada" });
  yield* TestClock.adjust("1 minute");
  yield* cookout.createIdentity("ada/helper", { owner: "ada" });
  yield* Effect.andThen(quietFor("2159 hours"), quietFor("1 hour"));
  yield* Effect.repeat(unreadIds(ada.client), { until: (ids) => ids.length >= TWO });
  return ada;
});

it.effect("two deactivated agents give two rows, newest first", () =>
  Effect.gen(function* twoRows() {
    const ada = yield* twoDeactivated;
    openAt({ client: ada.client, hash: "#/inbox" });
    yield* answer(() => inPane().findByText(ENTRY));

    expect([rowsIn(FOR_YOU), inboxCounts()]).toStrictEqual([
      [expect.stringContaining("@ada/helper was deactivated"), expect.stringContaining(ENTRY)],
      ["2 for you"],
    ]);
  }).pipe(Effect.provide(testCookout())),
);
