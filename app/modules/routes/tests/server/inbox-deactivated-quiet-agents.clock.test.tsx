import { Array as Arr, Effect, Option } from "effect";
import type { CookoutClient, DeactivatedQuietAgentId, EventStream } from "../../../sdk/index.ts";
import { TestCookout, answer, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { inDialog, inPane, inSidebar } from "../regions.ts";
import type { Scope } from "effect";
import { TestClock } from "effect/testing";
import type { TestIdentity } from "../../../testing/server.ts";
import { openAt } from "../render.tsx";
import { watched } from "../watched.ts";

const ENTRY = "@triage-agent was deactivated after 90 days with no activity.";
const EARLIER = "Earlier deactivated agents";
const FOR_YOU = "For you";
const SETTLE = "30 millis";
const HUMAN = { kind: "human" } as const;

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

it.effect("Reactivate in the row asks first, shows a fresh token once, reactivates the agent and moves the row", () =>
  Effect.gen(function* reactivateInRow() {
    const ada = yield* deactivatedLive;
    clickInForYou("Reactivate");
    const confirm = yield* answer(() => inDialog().findByRole("button", { name: "Reactivate @triage-agent" }));
    fireEvent.click(confirm);
    const token = yield* answer(() => inPane().findByRole("button", { name: "Copy token" }));
    yield* caughtUp;
    const active = yield* activeOf(ada.client);
    const shown = rowsIn(EARLIER);
    fireEvent.click(inPane().getByRole("button", { name: "Done" }));

    expect([
      token.textContent,
      active,
      rowsIn(FOR_YOU),
      inboxCounts(),
      shown,
      inPane().queryByRole("button", { name: "Copy token" }),
      rowsIn(EARLIER),
    ]).toStrictEqual([
      "Copy token",
      Option.some(true),
      [],
      [],
      [expect.stringMatching(/cookout_test_\w+Copy it now: it isn't shown again/u)],
      null,
      [expect.stringContaining(ENTRY)],
    ]);
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

it.effect("reactivating the agent through the SDK clears the row live", () =>
  Effect.gen(function* reactivateElsewhere() {
    const ada = yield* deactivatedLive;
    yield* answer(() => ada.client.reactivateIdentity("triage-agent"));
    yield* caughtUp;

    expect([rowsIn(FOR_YOU), inboxCounts(), rowsIn(EARLIER)]).toStrictEqual([[], [], [expect.stringContaining(ENTRY)]]);
  }).pipe(Effect.scoped, Effect.provide(testCookout())),
);
