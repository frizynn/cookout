import { Array as Arr, Effect } from "effect";
import type { CookoutClient, DeactivatedQuietAgentId, EventStream } from "../../../sdk/index.ts";
import { TestCookout, answer } from "../../../testing/server.ts";
import { fireEvent, screen, within } from "@testing-library/react";
import { inPane, inSidebar } from "../regions.ts";
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

function deactivatedLiveIn(
  shown: (client: CookoutClient) => CookoutClient,
): Effect.Effect<TestIdentity, never, TestCookout | Scope.Scope> {
  return Effect.gen(function* deactivateQuietAgent() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", HUMAN);
    yield* cookout.createIdentity("triage-agent", { owner: "ada" });
    yield* answer(() => ada.client.createChannel({ name: "grill" }));
    yield* quietFor("2159 hours");
    yield* inboxOpenFor(shown(ada.client));
    yield* quietFor("1 hour");
    yield* answer(() => inPane().findByText(ENTRY));
    return ada;
  });
}

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

function buttonsIn(label: string): readonly string[] {
  return textsOf(within(screen.getByRole("list", { name: label })).getAllByRole("button"));
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

function readOldest(client: CookoutClient): Effect.Effect<void> {
  return Effect.gen(function* readFirst() {
    const [oldest = null] = yield* unreadIds(client);
    if (oldest !== null) {
      yield* answer(() => client.markDeactivatedQuietAgentRead(oldest));
    }
  });
}

const caughtUp = answer(() => inPane().findByText("You're all caught up."));

export {
  EARLIER,
  ENTRY,
  FOR_YOU,
  HUMAN,
  buttonsIn,
  caughtUp,
  clickInForYou,
  deactivatedLiveIn,
  inboxCounts,
  quietFor,
  readOldest,
  rowsIn,
  settled,
  unreadIds,
};
